import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { nanoid } from 'nanoid';
import {
  Quest,
  QuestDocument,
  QuestKind,
  QuestStage,
} from './schemas/quest.schema';
import {
  Character,
  CharacterDocument,
} from '../characters/schemas/character.schema';
import { CreateQuestDto, UpdateQuestDto } from './dto/quest.dto';
import { CreateStageDto, UpdateStageDto } from './dto/stage.dto';
import {
  CreatePlayerQuestDto,
  CreatePlayerStageDto,
  UpdatePlayerStageDto,
} from './dto/player-quest.dto';
import {
  CharacterRef,
  PlayerQuest,
  projectForCharacter,
} from './quest-projection';

/** A quest loaded via `.lean()` — plain object with an ObjectId `_id`. */
type LeanQuest = Quest & { _id: Types.ObjectId };

type LeanCharacterRef = {
  _id: Types.ObjectId;
  name: string;
  isDeleted?: boolean;
  campaignId: Types.ObjectId;
};

function toStageResponse(s: QuestStage) {
  return {
    id: s.id,
    title: s.title,
    description: s.description ?? null,
    reward: s.reward ?? null,
    status: s.status,
    isMilestone: !!s.isMilestone,
    isPublic: !!s.isPublic,
    revealedAt: s.revealedAt ?? null,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

/** Admin shape: never leaks `_id`/`__v`; resolves assignees for the CMS. */
function toQuestResponse(
  q: LeanQuest,
  charactersById: ReadonlyMap<string, CharacterRef>,
) {
  const characterIds = q.characterIds.map(String);
  return {
    id: q.id,
    kind: q.kind,
    characterIds,
    characters: characterIds.map((id) => {
      const ref = charactersById.get(id);
      return { id, name: ref?.name ?? '', deleted: !ref || !!ref.isDeleted };
    }),
    isPublic: q.isPublic,
    createdByCharacterId: q.createdByCharacterId
      ? String(q.createdByCharacterId)
      : null,
    stages: q.stages.map(toStageResponse),
    createdAt: q.createdAt,
    updatedAt: q.updatedAt,
  };
}

export type QuestResponse = ReturnType<typeof toQuestResponse>;

@Injectable()
export class QuestsService {
  constructor(
    @InjectModel(Quest.name) private questModel: Model<QuestDocument>,
    @InjectModel(Character.name)
    private characterModel: Model<CharacterDocument>,
  ) {}

  // --- Admin: quests ---

  /** Every quest of the campaign, all stages, newest quest first. */
  async list(campaignId: string): Promise<QuestResponse[]> {
    const quests = await this.questModel
      .find({ campaignId: oid(campaignId) })
      .sort({ updatedAt: -1 })
      .lean<LeanQuest[]>();
    const refs = await this.characterRefs(
      quests.flatMap((q) => q.characterIds),
    );
    return quests.map((q) => toQuestResponse(q, refs));
  }

  async get(campaignId: string, questId: string): Promise<QuestResponse> {
    return this.respond(await this.findOrThrow(campaignId, questId));
  }

  /** Create a quest with its first stage, validated by kind. */
  async create(campaignId: string, dto: CreateQuestDto) {
    const header = await this.resolveHeader(campaignId, dto.kind, dto, null);
    const created = await this.questModel.create({
      id: nanoid(8),
      campaignId: oid(campaignId),
      ...header,
      stages: [newStage(dto.stage)],
    });
    return this.respond(created.toObject() as LeanQuest);
  }

  /** Merge `kind`/`characterIds`/`isPublic`, validated against the resulting kind. */
  async update(campaignId: string, questId: string, dto: UpdateQuestDto) {
    const existing = await this.findOrThrow(campaignId, questId);
    const kind = dto.kind ?? existing.kind;
    const header = await this.resolveHeader(campaignId, kind, dto, existing);
    const updated = await this.questModel
      .findOneAndUpdate(
        { id: questId, campaignId: oid(campaignId) },
        { $set: header },
        { returnDocument: 'after' },
      )
      .lean<LeanQuest>();
    if (!updated) throw new NotFoundException();
    return this.respond(updated);
  }

  async remove(campaignId: string, questId: string): Promise<void> {
    const deleted = await this.questModel.findOneAndDelete({
      id: questId,
      campaignId: oid(campaignId),
    });
    if (!deleted) throw new NotFoundException();
  }

  // --- Admin: stages ---

  /** Append a stage at the end. `$push` keeps concurrent appends intact. */
  async addStage(campaignId: string, questId: string, dto: CreateStageDto) {
    const updated = await this.questModel
      .findOneAndUpdate(
        { id: questId, campaignId: oid(campaignId) },
        { $push: { stages: newStage(dto) } },
        { returnDocument: 'after' },
      )
      .lean<LeanQuest>();
    if (!updated) throw new NotFoundException();
    return this.respond(updated);
  }

  /**
   * Merge fields into a stage at any position. `revealedAt` is set the first
   * time the stage becomes public and is never rewritten or cleared.
   */
  async updateStage(
    campaignId: string,
    questId: string,
    stageId: string,
    dto: UpdateStageDto,
  ) {
    const quest = await this.findOrThrow(campaignId, questId);
    const stage = quest.stages.find((s) => s.id === stageId);
    if (!stage) throw new NotFoundException();

    const now = new Date();
    const set: Record<string, unknown> = { 'stages.$.updatedAt': now };
    for (const key of [
      'title',
      'description',
      'reward',
      'status',
      'isMilestone',
      'isPublic',
    ] as const) {
      if (dto[key] !== undefined) set[`stages.$.${key}`] = dto[key];
    }
    if (dto.isPublic === true && !stage.revealedAt)
      set['stages.$.revealedAt'] = now;

    const updated = await this.questModel
      .findOneAndUpdate(
        { id: questId, campaignId: oid(campaignId), 'stages.id': stageId },
        { $set: set },
        { returnDocument: 'after' },
      )
      .lean<LeanQuest>();
    if (!updated) throw new NotFoundException();
    return this.respond(updated);
  }

  /**
   * Remove the last stage ("undo the last update"). 409 for a non-last stage
   * or the only stage — the quest itself is deleted instead.
   */
  async removeStage(campaignId: string, questId: string, stageId: string) {
    const quest = await this.findOrThrow(campaignId, questId);
    const index = quest.stages.findIndex((s) => s.id === stageId);
    if (index < 0) throw new NotFoundException();
    if (quest.stages.length === 1)
      throw new ConflictException(
        'Cannot delete the only stage; delete the quest instead',
      );
    if (index !== quest.stages.length - 1)
      throw new ConflictException('Only the last stage can be deleted');

    // Guard on the position so a concurrent append cannot make us drop a non-last stage.
    const updated = await this.questModel
      .findOneAndUpdate(
        {
          id: questId,
          campaignId: oid(campaignId),
          [`stages.${index}.id`]: stageId,
          [`stages.${index + 1}`]: { $exists: false },
        },
        { $pull: { stages: { id: stageId } } },
        { returnDocument: 'after' },
      )
      .lean<LeanQuest>();
    if (!updated)
      throw new ConflictException('Only the last stage can be deleted');
    return this.respond(updated);
  }

  // --- Player ---

  /**
   * The quests `characterId` sees, projected. The same projection is returned
   * to the owner and to an admin. A character outside this campaign is 404.
   */
  async listForCharacter(
    campaignId: string,
    characterId: string,
  ): Promise<PlayerQuest[]> {
    await this.assertCharacterInCampaign(campaignId, characterId);

    const quests = await this.questModel
      .find({
        campaignId: oid(campaignId),
        $or: [
          { kind: 'story', isPublic: true },
          { kind: 'personal', characterIds: oid(characterId) },
        ],
      })
      .lean<LeanQuest[]>();
    const refs = await this.characterRefs(
      quests
        .filter((q) => q.kind === 'personal')
        .flatMap((q) => q.characterIds),
    );
    return quests
      .map((q) => projectForCharacter(q, characterId, refs))
      .filter((q): q is PlayerQuest => q !== null);
  }

  /** A personal quest created by the character, holding only it, first stage public. */
  async createForCharacter(
    campaignId: string,
    characterId: string,
    dto: CreatePlayerQuestDto,
  ): Promise<PlayerQuest> {
    await this.assertCharacterInCampaign(campaignId, characterId);
    const created = await this.questModel.create({
      id: nanoid(8),
      campaignId: oid(campaignId),
      kind: 'personal',
      characterIds: [oid(characterId)],
      isPublic: false,
      createdByCharacterId: oid(characterId),
      stages: [newStage({ ...dto.stage, isPublic: true })],
    });
    return this.project(created.toObject() as LeanQuest, characterId);
  }

  /**
   * Add a public stage right after the last public one, so the master's
   * trailing drafts stay ahead of it. The position is read first, so the
   * update is guarded on the stage count: a concurrent change is a 409.
   */
  async addStageForCharacter(
    campaignId: string,
    characterId: string,
    questId: string,
    dto: CreatePlayerStageDto,
  ): Promise<PlayerQuest> {
    const quest = await this.findPersonalForCharacter(
      campaignId,
      characterId,
      questId,
    );
    const updated = await this.questModel
      .findOneAndUpdate(
        {
          id: questId,
          campaignId: oid(campaignId),
          stages: { $size: quest.stages.length },
        },
        {
          $push: {
            stages: {
              $each: [newStage({ ...dto, isPublic: true })],
              $position: lastPublicIndex(quest) + 1,
            },
          },
        },
        { returnDocument: 'after' },
      )
      .lean<LeanQuest>();
    if (!updated)
      throw new ConflictException('The quest changed meanwhile, retry');
    return this.project(updated, characterId);
  }

  /** Merge fields into a public stage. Hidden stages are invisible, so a 404. */
  async updateStageForCharacter(
    campaignId: string,
    characterId: string,
    questId: string,
    stageId: string,
    dto: UpdatePlayerStageDto,
  ): Promise<PlayerQuest> {
    const quest = await this.findPersonalForCharacter(
      campaignId,
      characterId,
      questId,
    );
    if (!quest.stages.some((s) => s.id === stageId && s.isPublic))
      throw new NotFoundException();

    const set: Record<string, unknown> = { 'stages.$.updatedAt': new Date() };
    for (const key of [
      'title',
      'description',
      'reward',
      'status',
      'isMilestone',
    ] as const) {
      if (dto[key] !== undefined) set[`stages.$.${key}`] = dto[key];
    }
    const updated = await this.questModel
      .findOneAndUpdate(
        {
          id: questId,
          campaignId: oid(campaignId),
          stages: { $elemMatch: { id: stageId, isPublic: true } },
        },
        { $set: set },
        { returnDocument: 'after' },
      )
      .lean<LeanQuest>();
    if (!updated) throw new NotFoundException();
    return this.project(updated, characterId);
  }

  /**
   * Remove the last public stage ("undo the last update"). 409 for an earlier
   * stage or the only public one, since the quest would vanish for the player.
   */
  async removeStageForCharacter(
    campaignId: string,
    characterId: string,
    questId: string,
    stageId: string,
  ): Promise<PlayerQuest> {
    const quest = await this.findPersonalForCharacter(
      campaignId,
      characterId,
      questId,
    );
    const publicStages = quest.stages.filter((s) => s.isPublic);
    if (!publicStages.some((s) => s.id === stageId))
      throw new NotFoundException();
    if (publicStages.length === 1)
      throw new ConflictException(
        'Cannot delete the only stage; delete the quest instead',
      );
    if (publicStages[publicStages.length - 1].id !== stageId)
      throw new ConflictException('Only the last stage can be deleted');

    const updated = await this.questModel
      .findOneAndUpdate(
        {
          id: questId,
          campaignId: oid(campaignId),
          stages: { $size: quest.stages.length },
        },
        { $pull: { stages: { id: stageId } } },
        { returnDocument: 'after' },
      )
      .lean<LeanQuest>();
    if (!updated)
      throw new ConflictException('The quest changed meanwhile, retry');
    return this.project(updated, characterId);
  }

  /** Delete a quest the character created; one assigned by the master is a 403. */
  async removeForCharacter(
    campaignId: string,
    characterId: string,
    questId: string,
  ): Promise<void> {
    const quest = await this.findPersonalForCharacter(
      campaignId,
      characterId,
      questId,
    );
    if (String(quest.createdByCharacterId ?? '') !== String(characterId))
      throw new ForbiddenException('Only quests you created can be deleted');
    await this.questModel.deleteOne({
      id: questId,
      campaignId: oid(campaignId),
    });
  }

  // --- Helpers ---

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

  /**
   * A personal quest the character holds and can see (at least one public
   * stage). Anything else, story quests included, is a 404, exactly as if it
   * were absent from the character's log.
   */
  private async findPersonalForCharacter(
    campaignId: string,
    characterId: string,
    questId: string,
  ): Promise<LeanQuest> {
    await this.assertCharacterInCampaign(campaignId, characterId);
    const quest = await this.questModel
      .findOne({
        id: questId,
        campaignId: oid(campaignId),
        kind: 'personal',
        characterIds: oid(characterId),
      })
      .lean<LeanQuest>();
    if (!quest || lastPublicIndex(quest) < 0) throw new NotFoundException();
    return quest;
  }

  /** The player projection of one quest, with `involved` names resolved. */
  private async project(
    quest: LeanQuest,
    characterId: string,
  ): Promise<PlayerQuest> {
    const projected = projectForCharacter(
      quest,
      characterId,
      await this.characterRefs(quest.characterIds),
    );
    if (!projected) throw new NotFoundException();
    return projected;
  }

  private async findOrThrow(
    campaignId: string,
    questId: string,
  ): Promise<LeanQuest> {
    const quest = await this.questModel
      .findOne({ id: questId, campaignId: oid(campaignId) })
      .lean<LeanQuest>();
    if (!quest) throw new NotFoundException();
    return quest;
  }

  private async respond(quest: LeanQuest) {
    return toQuestResponse(quest, await this.characterRefs(quest.characterIds));
  }

  /** Names and deletion flags for the given character ids, keyed by id. */
  private async characterRefs(
    ids: Array<Types.ObjectId | string>,
  ): Promise<Map<string, CharacterRef>> {
    const unique = [...new Set(ids.map(String))];
    if (unique.length === 0) return new Map();
    const chars = await this.characterModel
      .find({ _id: { $in: unique.map(oid) } })
      .select({ name: 1, isDeleted: 1 })
      .lean<LeanCharacterRef[]>();
    return new Map(
      chars.map((c) => [
        String(c._id),
        { name: c.name, isDeleted: !!c.isDeleted },
      ]),
    );
  }

  /**
   * The stored header for `kind`:
   * - personal ⇒ non-empty `characterIds`, `isPublic` false (true is a 400);
   * - story ⇒ empty `characterIds` (a non-empty one is a 400).
   * Switching to personal requires `characterIds` in the same request. Ids
   * not already assigned must be non-deleted characters of this campaign;
   * already-assigned ids are kept even if since soft-deleted.
   */
  private async resolveHeader(
    campaignId: string,
    kind: QuestKind,
    dto: { characterIds?: string[]; isPublic?: boolean },
    existing: LeanQuest | null,
  ): Promise<Pick<Quest, 'kind' | 'characterIds' | 'isPublic'>> {
    if (kind === 'story') {
      if (dto.characterIds && dto.characterIds.length > 0)
        throw new BadRequestException('A story quest takes no characterIds');
      return {
        kind,
        characterIds: [],
        isPublic: dto.isPublic ?? existing?.isPublic ?? false,
      };
    }

    if (dto.isPublic === true)
      throw new BadRequestException('A personal quest cannot be public');
    const wasPersonal = existing?.kind === 'personal';
    const ids =
      dto.characterIds ??
      (wasPersonal ? existing.characterIds.map(String) : undefined);
    if (!ids || ids.length === 0)
      throw new BadRequestException(
        'A personal quest requires at least one character',
      );
    if (new Set(ids).size !== ids.length)
      throw new BadRequestException('Duplicate characterIds');

    const kept = new Set(wasPersonal ? existing.characterIds.map(String) : []);
    const added = ids.filter((id) => !kept.has(id));
    if (added.length > 0) {
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
    return { kind, characterIds: ids.map(oid), isPublic: false };
  }
}

function oid(id: string | Types.ObjectId): Types.ObjectId {
  return new Types.ObjectId(String(id));
}

/** Index of the last public stage, or -1 when every stage is a draft. */
function lastPublicIndex(quest: Pick<Quest, 'stages'>): number {
  for (let i = quest.stages.length - 1; i >= 0; i--)
    if (quest.stages[i].isPublic) return i;
  return -1;
}

/** A fresh stage from the create DTO; public on creation means revealed now. */
function newStage(dto: CreateStageDto): QuestStage {
  const now = new Date();
  const isPublic = dto.isPublic ?? false;
  return {
    id: nanoid(8),
    title: dto.title,
    description: dto.description,
    reward: dto.reward,
    status: dto.status ?? 'in_corso',
    isMilestone: dto.isMilestone ?? false,
    isPublic,
    revealedAt: isPublic ? now : null,
    createdAt: now,
    updatedAt: now,
  };
}
