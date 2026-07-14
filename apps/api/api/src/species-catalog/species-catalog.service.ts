import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  SpeciesCatalogEntry,
  SpeciesCatalogEntryDocument,
} from './schemas/species-catalog-entry.schema';
import { SpeciesCatalogOpDto } from './dto/species-catalog-patch.dto';
import {
  Character,
  CharacterDocument,
} from '../characters/schemas/character.schema';
import { definedOnly } from '../common/utils/defined-only';

export type IgnoredCatalogOp = { slug: string; reason: 'unknown_slug' };

export interface CatalogEntry {
  name: string;
  permesso: string;
  svantaggio: string;
  tagSkillBudget: number;
  margin: number;
  description?: string;
}

/** `tagSkillBudget` is a maestria allowance, so it must be a positive integer. */
function assertValidBudget(budget: unknown) {
  if (budget === undefined) return;
  if (!Number.isInteger(budget) || (budget as number) < 1) {
    throw new BadRequestException(
      'entry.tagSkillBudget must be a positive integer',
    );
  }
}

/** `margin` is a starting health margin, so it must be a positive integer. */
function assertValidMargin(margin: unknown) {
  if (margin === undefined) return;
  if (!Number.isInteger(margin) || (margin as number) < 1) {
    throw new BadRequestException('entry.margin must be a positive integer');
  }
}

@Injectable()
export class SpeciesCatalogService {
  constructor(
    @InjectModel(SpeciesCatalogEntry.name)
    private entryModel: Model<SpeciesCatalogEntryDocument>,
    @InjectModel(Character.name)
    private characterModel: Model<CharacterDocument>,
  ) {}

  async findAll(): Promise<Array<CatalogEntry & { slug: string }>> {
    const entries = await this.entryModel.find().lean();
    return entries.map((e) => ({
      slug: e.slug,
      name: e.name,
      permesso: e.permesso,
      svantaggio: e.svantaggio,
      tagSkillBudget: e.tagSkillBudget,
      margin: e.margin,
      description: e.description,
    }));
  }

  /** True when `slug` names an entry in the catalog — used to validate `character.species`. */
  async slugExists(slug: string): Promise<boolean> {
    const found = await this.entryModel.exists({ slug });
    return found !== null;
  }

  /** True when a live character still points at `slug`; such a species may not be dropped. */
  private async isInUse(slug: string): Promise<boolean> {
    const found = await this.characterModel.exists({
      species: slug,
      isDeleted: { $ne: true },
    });
    return found !== null;
  }

  async patchSchema(ops: SpeciesCatalogOpDto[]) {
    const docs = await this.entryModel.find().lean();
    const map = new Map<string, CatalogEntry>(
      docs.map((d) => [
        d.slug,
        {
          name: d.name,
          permesso: d.permesso,
          svantaggio: d.svantaggio,
          tagSkillBudget: d.tagSkillBudget,
          margin: d.margin,
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
        if (!e.permesso)
          throw new BadRequestException('entry.permesso is required');
        if (!e.svantaggio)
          throw new BadRequestException('entry.svantaggio is required');
        if (e.tagSkillBudget === undefined)
          throw new BadRequestException('entry.tagSkillBudget is required');
        assertValidBudget(e.tagSkillBudget);
        if (e.margin === undefined)
          throw new BadRequestException('entry.margin is required');
        assertValidMargin(e.margin);

        const entry: CatalogEntry = {
          name: e.name,
          permesso: e.permesso,
          svantaggio: e.svantaggio,
          tagSkillBudget: e.tagSkillBudget,
          margin: e.margin,
          description: e.description,
        };
        map.set(op.slug, entry);
        toUpsert.set(op.slug, entry);
      } else if (op.action === 'update') {
        const existing = map.get(op.slug);
        if (!existing) {
          ignored.push({ slug: op.slug, reason: 'unknown_slug' });
          continue;
        }
        assertValidBudget(op.entry?.tagSkillBudget);
        assertValidMargin(op.entry?.margin);
        const merged: CatalogEntry = { ...existing, ...definedOnly(op.entry) };
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
        if (await this.isInUse(op.slug)) {
          throw new ConflictException(
            `Species "${op.slug}" is in use by a character and cannot be renamed`,
          );
        }
        map.delete(op.slug);
        map.set(op.rename, existing);
        toDelete.add(op.slug);
        toUpsert.delete(op.slug);
        toUpsert.set(op.rename, existing);
      } else if (op.action === 'delete') {
        if (!map.has(op.slug)) {
          ignored.push({ slug: op.slug, reason: 'unknown_slug' });
          continue;
        }
        if (await this.isInUse(op.slug)) {
          throw new ConflictException(
            `Species "${op.slug}" is in use by a character and cannot be deleted`,
          );
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
