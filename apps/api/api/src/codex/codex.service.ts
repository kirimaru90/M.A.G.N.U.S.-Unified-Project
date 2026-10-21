import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { nanoid } from 'nanoid';
import { CodexEntry, CodexEntryDocument } from './schemas/codex-entry.schema';
import {
  Character,
  CharacterDocument,
} from '../characters/schemas/character.schema';
import {
  CreateCodexEntryDto,
  UpdateCodexEntryDto,
} from './dto/codex-entry.dto';
import {
  CreatePlayerCodexEntryDto,
  UpdatePlayerCodexEntryDto,
} from './dto/player-codex.dto';
import {
  canWrite,
  isVisibleTo,
  PlayerCodexEntry,
  projectForCharacter,
} from './codex-projection';
import { ImportSkip, planCodexImport } from './codex-import';
import { IT_COLLATION } from '../common/utils/order-by';

/** An entry loaded via `.lean()` — plain object with an ObjectId `_id`. */
type LeanEntry = CodexEntry & { _id: Types.ObjectId };

type LeanCharacterRef = {
  _id: Types.ObjectId;
  name?: string;
  isDeleted?: boolean;
  campaignId: Types.ObjectId;
};

/** A referenced character as the CMS shows it; `deleted` marks a soft-deleted one. */
export interface CodexCharacterRef {
  id: string;
  name: string;
  deleted: boolean;
}

type CharacterRefs = ReadonlyMap<string, { name: string; isDeleted: boolean }>;

const idOrNull = (v: Types.ObjectId | string | null | undefined) =>
  v ? String(v) : null;

/** Every authored field, as the export file carries it. */
function toExportItem(e: LeanEntry) {
  return {
    id: e.id,
    type: e.type,
    name: e.name,
    description: e.description ?? null,
    secretDescription: e.secretDescription ?? null,
    imageUrl: e.imageUrl ?? null,
    isPublic: !!e.isPublic,
    visibleToCharacterIds: (e.visibleToCharacterIds ?? []).map(String),
    isEditable: !!e.isEditable,
    mapPlaceSlug: e.mapPlaceSlug ?? null,
    createdByCharacterId: idOrNull(e.createdByCharacterId),
    isDeleted: !!e.isDeleted,
    deletedAt: e.deletedAt ?? null,
    deletedByCharacterId: idOrNull(e.deletedByCharacterId),
  };
}

/** Every character id an entry references: listed, author, deleter. */
function referencedIds(e: LeanEntry): string[] {
  return [
    ...(e.visibleToCharacterIds ?? []),
    e.createdByCharacterId,
    e.deletedByCharacterId,
  ]
    .filter((id): id is Types.ObjectId => id != null)
    .map(String);
}

/**
 * Admin shape: every field, never `_id`/`__v`/`campaignId`, plus `characters`
 * resolving every referenced id for the CMS, since the characters list it
 * otherwise reads omits soft-deleted ones.
 */
function toEntryResponse(e: LeanEntry, refs: CharacterRefs) {
  return {
    ...toExportItem(e),
    characters: [...new Set(referencedIds(e))].map((id): CodexCharacterRef => {
      const ref = refs.get(id);
      return { id, name: ref?.name ?? '', deleted: !ref || ref.isDeleted };
    }),
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

export type CodexEntryResponse = ReturnType<typeof toEntryResponse>;
export type CodexExportItem = ReturnType<typeof toExportItem>;

/** The player-writable fields copied into a `$set`. */
const PLAYER_FIELDS = [
  'type',
  'name',
  'description',
  'imageUrl',
  'isPublic',
  'mapPlaceSlug',
] as const;

const ADMIN_FIELDS = [
  ...PLAYER_FIELDS,
  'secretDescription',
  'isEditable',
] as const;

@Injectable()
export class CodexService {
  constructor(
    @InjectModel(CodexEntry.name) private entryModel: Model<CodexEntryDocument>,
    @InjectModel(Character.name)
    private characterModel: Model<CharacterDocument>,
  ) {}

  // --- Admin ---

  /** Every entry of the campaign, deleted ones included, by name. */
  async list(campaignId: string): Promise<CodexEntryResponse[]> {
    const entries = await this.entryModel
      .find({ campaignId: oid(campaignId) })
      .sort({ name: 1 })
      .collation(IT_COLLATION)
      .lean<LeanEntry[]>();
    return this.respond(entries);
  }

  async get(campaignId: string, entryId: string): Promise<CodexEntryResponse> {
    return this.respondOne(await this.findOrThrow(campaignId, entryId));
  }

  /** A master entry: not editable by players unless said so. */
  async create(
    campaignId: string,
    dto: CreateCodexEntryDto,
  ): Promise<CodexEntryResponse> {
    const visible = dto.visibleToCharacterIds ?? [];
    await this.assertCharactersAddable(campaignId, visible, []);
    const created = await this.entryModel.create({
      id: nanoid(8),
      campaignId: oid(campaignId),
      type: dto.type,
      name: dto.name,
      description: dto.description,
      secretDescription: dto.secretDescription,
      imageUrl: dto.imageUrl ?? undefined,
      isPublic: dto.isPublic ?? false,
      visibleToCharacterIds: visible.map(oid),
      isEditable: dto.isEditable ?? false,
      mapPlaceSlug: dto.mapPlaceSlug ?? null,
      createdByCharacterId: null,
    });
    return this.respondOne(created.toObject() as LeanEntry);
  }

  /**
   * Merge authored fields. `isDeleted: false` restores (clearing who and
   * when); `isDeleted: true` soft-deletes as the master. Ids newly added to
   * `visibleToCharacterIds` must be live characters of this campaign; ids
   * already listed are kept even if since soft-deleted.
   */
  async update(
    campaignId: string,
    entryId: string,
    dto: UpdateCodexEntryDto,
  ): Promise<CodexEntryResponse> {
    const existing = await this.findOrThrow(campaignId, entryId);
    const set = pick(dto, ADMIN_FIELDS);

    if (dto.visibleToCharacterIds !== undefined) {
      await this.assertCharactersAddable(
        campaignId,
        dto.visibleToCharacterIds,
        existing.visibleToCharacterIds.map(String),
      );
      set.visibleToCharacterIds = dto.visibleToCharacterIds.map(oid);
    }
    if (dto.isDeleted === false) {
      Object.assign(set, {
        isDeleted: false,
        deletedAt: null,
        deletedByCharacterId: null,
      });
    } else if (dto.isDeleted === true && !existing.isDeleted) {
      Object.assign(set, {
        isDeleted: true,
        deletedAt: new Date(),
        deletedByCharacterId: null,
      });
    }

    const updated = await this.entryModel
      .findOneAndUpdate(
        { id: entryId, campaignId: oid(campaignId) },
        { $set: set },
        { returnDocument: 'after' },
      )
      .lean<LeanEntry>();
    if (!updated) throw new NotFoundException();
    return this.respondOne(updated);
  }

  /** Permanent delete. */
  async remove(campaignId: string, entryId: string): Promise<void> {
    const deleted = await this.entryModel.findOneAndDelete({
      id: entryId,
      campaignId: oid(campaignId),
    });
    if (!deleted) throw new NotFoundException();
  }

  async export(campaignId: string): Promise<CodexExportItem[]> {
    const entries = await this.entryModel
      .find({ campaignId: oid(campaignId) })
      .sort({ name: 1 })
      .collation(IT_COLLATION)
      .lean<LeanEntry[]>();
    return entries.map(toExportItem);
  }

  /** Append-only import; see `planCodexImport` for the per-item rules. */
  async import(
    campaignId: string,
    items: unknown[],
  ): Promise<{ added: number; skipped: ImportSkip[] }> {
    const existing = await this.entryModel
      .find({ campaignId: oid(campaignId) })
      .select({ id: 1, type: 1, name: 1 })
      .lean<Array<Pick<LeanEntry, 'id' | 'type' | 'name'>>>();
    const characters = await this.characterModel
      .find({ campaignId: oid(campaignId) })
      .select({ _id: 1 })
      .lean<LeanCharacterRef[]>();

    const plan = planCodexImport(
      existing,
      items,
      characters.map((c) => String(c._id)),
    );
    if (plan.toInsert.length > 0) {
      await this.entryModel.insertMany(
        plan.toInsert.map((e) => ({
          ...e,
          campaignId: oid(campaignId),
          visibleToCharacterIds: e.visibleToCharacterIds.map(oid),
          createdByCharacterId: e.createdByCharacterId
            ? oid(e.createdByCharacterId)
            : null,
          deletedByCharacterId: e.deletedByCharacterId
            ? oid(e.deletedByCharacterId)
            : null,
        })),
      );
    }
    return { added: plan.toInsert.length, skipped: plan.skipped };
  }

  // --- Player ---

  /** The entries `characterId` sees, projected, by name. */
  async listForCharacter(
    campaignId: string,
    characterId: string,
  ): Promise<PlayerCodexEntry[]> {
    await this.assertCharacterInCampaign(campaignId, characterId);
    const entries = await this.entryModel
      .find({
        campaignId: oid(campaignId),
        isDeleted: { $ne: true },
        $or: [{ isPublic: true }, { visibleToCharacterIds: oid(characterId) }],
      })
      .sort({ name: 1 })
      .collation(IT_COLLATION)
      .lean<LeanEntry[]>();
    // The query already filters; the projection still decides, so a drifting
    // query can never leak an entry.
    return entries
      .map((e) => projectForCharacter(e, characterId))
      .filter((e): e is PlayerCodexEntry => e !== null);
  }

  /** A player entry: visible to its creator, editable, private unless said so. */
  async createForCharacter(
    campaignId: string,
    characterId: string,
    dto: CreatePlayerCodexEntryDto,
  ): Promise<PlayerCodexEntry> {
    await this.assertCharacterInCampaign(campaignId, characterId);
    const created = await this.entryModel.create({
      id: nanoid(8),
      campaignId: oid(campaignId),
      type: dto.type,
      name: dto.name,
      description: dto.description,
      imageUrl: dto.imageUrl ?? undefined,
      isPublic: dto.isPublic ?? false,
      visibleToCharacterIds: [oid(characterId)],
      isEditable: true,
      mapPlaceSlug: dto.mapPlaceSlug ?? null,
      createdByCharacterId: oid(characterId),
    });
    return projectForCharacter(
      created.toObject() as LeanEntry,
      characterId,
    ) as PlayerCodexEntry;
  }

  /**
   * Merge player fields. 404 when the entry is not visible to the character,
   * 403 when visible but locked (admins bypass the lock). Returns `null` when
   * the update leaves the entry invisible to the character: the caller answers
   * 204 rather than a projection the character may no longer see.
   */
  async updateForCharacter(
    campaignId: string,
    characterId: string,
    entryId: string,
    dto: UpdatePlayerCodexEntryDto,
    isAdmin: boolean,
  ): Promise<PlayerCodexEntry | null> {
    await this.findWritableForCharacter(
      campaignId,
      characterId,
      entryId,
      isAdmin,
    );
    const updated = await this.entryModel
      .findOneAndUpdate(
        { id: entryId, campaignId: oid(campaignId), isDeleted: { $ne: true } },
        { $set: pick(dto, PLAYER_FIELDS) },
        { returnDocument: 'after' },
      )
      .lean<LeanEntry>();
    if (!updated) throw new NotFoundException();
    return projectForCharacter(updated, characterId);
  }

  /** Soft delete, stamped with the character; the master can restore it. */
  async removeForCharacter(
    campaignId: string,
    characterId: string,
    entryId: string,
    isAdmin: boolean,
  ): Promise<void> {
    await this.findWritableForCharacter(
      campaignId,
      characterId,
      entryId,
      isAdmin,
    );
    const res = await this.entryModel.updateOne(
      { id: entryId, campaignId: oid(campaignId), isDeleted: { $ne: true } },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedByCharacterId: oid(characterId),
        },
      },
    );
    if (res.matchedCount === 0) throw new NotFoundException();
  }

  // --- Helpers ---

  private async respond(entries: LeanEntry[]): Promise<CodexEntryResponse[]> {
    const refs = await this.characterRefs(entries.flatMap(referencedIds));
    return entries.map((e) => toEntryResponse(e, refs));
  }

  private async respondOne(entry: LeanEntry): Promise<CodexEntryResponse> {
    return (await this.respond([entry]))[0];
  }

  /** Names and deletion flags for the given character ids, keyed by id. */
  private async characterRefs(ids: string[]): Promise<CharacterRefs> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const chars = await this.characterModel
      .find({ _id: { $in: unique.map(oid) } })
      .select({ name: 1, isDeleted: 1 })
      .lean<LeanCharacterRef[]>();
    return new Map(
      chars.map((c) => [
        String(c._id),
        { name: c.name ?? '', isDeleted: !!c.isDeleted },
      ]),
    );
  }

  /** 404 unless visible to the character; 403 unless also writable. */
  private async findWritableForCharacter(
    campaignId: string,
    characterId: string,
    entryId: string,
    isAdmin: boolean,
  ): Promise<LeanEntry> {
    await this.assertCharacterInCampaign(campaignId, characterId);
    const entry = await this.entryModel
      .findOne({ id: entryId, campaignId: oid(campaignId) })
      .lean<LeanEntry>();
    if (!entry || !isVisibleTo(entry, characterId))
      throw new NotFoundException();
    if (!canWrite(entry, characterId, isAdmin))
      throw new ForbiddenException('This entry is not editable');
    return entry;
  }

  /** 404 unless the character exists, is not deleted and is in this campaign. */
  private async assertCharacterInCampaign(
    campaignId: string,
    characterId: string,
  ): Promise<void> {
    const character = await this.characterModel
      .findById(characterId)
      .lean<LeanCharacterRef>();
    if (
      !character ||
      character.isDeleted ||
      String(character.campaignId) !== campaignId
    )
      throw new NotFoundException();
  }

  /** 400 unless every id not in `kept` is a live character of this campaign. */
  private async assertCharactersAddable(
    campaignId: string,
    ids: string[],
    kept: string[],
  ): Promise<void> {
    const keptSet = new Set(kept);
    const added = [...new Set(ids)].filter((id) => !keptSet.has(id));
    if (added.length === 0) return;
    const found = await this.characterModel.countDocuments({
      _id: { $in: added.map(oid) },
      campaignId: oid(campaignId),
      isDeleted: { $ne: true },
    });
    if (found !== added.length)
      throw new BadRequestException(
        'Every character must belong to this campaign',
      );
  }

  private async findOrThrow(
    campaignId: string,
    entryId: string,
  ): Promise<LeanEntry> {
    const entry = await this.entryModel
      .findOne({ id: entryId, campaignId: oid(campaignId) })
      .lean<LeanEntry>();
    if (!entry) throw new NotFoundException();
    return entry;
  }
}

function oid(id: string | Types.ObjectId): Types.ObjectId {
  return new Types.ObjectId(String(id));
}

/** The provided (non-undefined) keys of `dto` among `keys`. */
function pick<T extends object>(
  dto: T,
  keys: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const value = (dto as Record<string, unknown>)[key];
    if (value !== undefined) out[key] = value;
  }
  return out;
}
