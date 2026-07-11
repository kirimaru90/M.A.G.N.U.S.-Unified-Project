import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  EquipmentCatalogEntry,
  EquipmentCatalogEntryDocument,
  EQUIPMENT_KINDS,
  TAG_TYPES,
} from './schemas/equipment-catalog-entry.schema';
import { EquipmentCatalogOpDto } from './dto/equipment-catalog-patch.dto';
import { definedOnly } from '../common/utils/defined-only';

export type IgnoredCatalogOp = { slug: string; reason: 'unknown_slug' };

interface CatalogTag {
  name: string;
  type: string;
}

interface CatalogEntry {
  name: string;
  kind: string;
  tags: CatalogTag[];
  defaultQuantity?: number;
  isStarter: boolean;
  description?: string;
}

/**
 * Validate the entry as it will be stored, not just the fields the op supplied.
 * An `update` that flips `kind` to `consumable` on a tagged weapon is as invalid
 * as an `add` that supplies tags for a consumable outright.
 */
function assertValidEntry(entry: CatalogEntry) {
  if (!EQUIPMENT_KINDS.includes(entry.kind as (typeof EQUIPMENT_KINDS)[number]))
    throw new BadRequestException(
      `entry.kind must be one of ${EQUIPMENT_KINDS.join(' | ')}`,
    );

  for (const tag of entry.tags ?? []) {
    if (!TAG_TYPES.includes(tag.type as (typeof TAG_TYPES)[number]))
      throw new BadRequestException(
        `tag.type must be one of ${TAG_TYPES.join(' | ')}`,
      );
  }

  if (entry.kind === 'consumable' && (entry.tags?.length ?? 0) > 0)
    throw new BadRequestException('a consumable may not carry tags');

  if (entry.defaultQuantity !== undefined) {
    if (!Number.isInteger(entry.defaultQuantity) || entry.defaultQuantity < 0)
      throw new BadRequestException(
        'entry.defaultQuantity must be a non-negative integer',
      );
  }
}

@Injectable()
export class EquipmentCatalogService {
  constructor(
    @InjectModel(EquipmentCatalogEntry.name)
    private entryModel: Model<EquipmentCatalogEntryDocument>,
  ) {}

  /** `starterOnly` backs the wizard's `GET /equipment-catalog?starter=true`. */
  async findAll(starterOnly = false) {
    const filter = starterOnly ? { isStarter: true } : {};
    const entries = await this.entryModel.find(filter).lean();
    return entries.map((e) => ({
      slug: e.slug,
      name: e.name,
      kind: e.kind,
      tags: e.tags ?? [],
      defaultQuantity: e.defaultQuantity,
      isStarter: e.isStarter ?? false,
      description: e.description,
    }));
  }

  async patchSchema(ops: EquipmentCatalogOpDto[]) {
    const docs = await this.entryModel.find().lean();
    const map = new Map<string, CatalogEntry>(
      docs.map((d) => [
        d.slug,
        {
          name: d.name,
          kind: d.kind,
          tags: (d.tags ?? []).map((t) => ({ name: t.name, type: t.type })),
          defaultQuantity: d.defaultQuantity,
          isStarter: d.isStarter ?? false,
          description: d.description,
        },
      ]),
    );

    const ignored: IgnoredCatalogOp[] = [];
    const toDelete = new Set<string>();
    const toUpsert = new Map<string, CatalogEntry>();

    for (const op of ops) {
      if (op.action === 'add') {
        if (map.has(op.slug)) {
          throw new ConflictException(`Slug "${op.slug}" already exists`);
        }
        const e = op.entry;
        if (!e?.name) throw new BadRequestException('entry.name is required');
        if (!e.kind) throw new BadRequestException('entry.kind is required');

        const entry: CatalogEntry = {
          name: e.name,
          kind: e.kind,
          tags: e.tags ?? [],
          defaultQuantity: e.defaultQuantity,
          isStarter: e.isStarter ?? false,
          description: e.description,
        };
        assertValidEntry(entry);
        map.set(op.slug, entry);
        toUpsert.set(op.slug, entry);
      } else if (op.action === 'update') {
        const existing = map.get(op.slug);
        if (!existing) {
          ignored.push({ slug: op.slug, reason: 'unknown_slug' });
          continue;
        }
        const merged: CatalogEntry = { ...existing, ...definedOnly(op.entry) };
        assertValidEntry(merged);
        map.set(op.slug, merged);
        toUpsert.set(op.slug, merged);
      } else if (op.action === 'rename') {
        const existing = map.get(op.slug);
        if (!existing) {
          ignored.push({ slug: op.slug, reason: 'unknown_slug' });
          continue;
        }
        if (!op.rename) {
          throw new BadRequestException(
            'rename is required for action "rename"',
          );
        }
        if (map.has(op.rename)) {
          throw new ConflictException(`Slug "${op.rename}" already exists`);
        }
        map.delete(op.slug);
        map.set(op.rename, existing);
        toDelete.add(op.slug);
        toUpsert.delete(op.slug);
        toUpsert.set(op.rename, existing);
      } else if (op.action === 'delete') {
        // Always permitted: characters hold copies, never references, so a
        // deleted template can not orphan anyone's inventory.
        if (!map.has(op.slug)) {
          ignored.push({ slug: op.slug, reason: 'unknown_slug' });
          continue;
        }
        map.delete(op.slug);
        toDelete.add(op.slug);
        toUpsert.delete(op.slug);
      }
    }

    for (const slug of toDelete) {
      await this.entryModel.deleteOne({ slug });
    }
    for (const [slug, entry] of toUpsert) {
      await this.entryModel.updateOne(
        { slug },
        { $set: { slug, ...entry } },
        { upsert: true },
      );
    }

    return { ignored };
  }
}
