import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  TalentCatalogEntry,
  TalentCatalogEntryDocument,
} from './schemas/talent-catalog-entry.schema';
import { TalentsCatalogOpDto } from './dto/talents-catalog-patch.dto';
import { IT_COLLATION, parseOrderBy } from '../common/utils/order-by';

export type IgnoredCatalogOp = { slug: string; reason: 'unknown_slug' };

interface CatalogEntry {
  name: string;
  description?: string;
  specialRequirement?: number[];
}

@Injectable()
export class TalentsCatalogService {
  constructor(
    @InjectModel(TalentCatalogEntry.name)
    private entryModel: Model<TalentCatalogEntryDocument>,
  ) {}

  /** `orderBy=name` sorts alphabetically (Italian collation); else natural order. */
  async findAll(orderBy?: string) {
    const sort = parseOrderBy(orderBy, ['name']);
    const query = this.entryModel.find();
    if (sort) query.sort(sort).collation(IT_COLLATION);
    const entries = await query.lean();
    return entries.map((e) => ({
      slug: e.slug,
      name: e.name,
      description: e.description,
      specialRequirement: e.specialRequirement,
    }));
  }

  async patchSchema(ops: TalentsCatalogOpDto[]) {
    const docs = await this.entryModel.find().lean();
    const map = new Map<string, CatalogEntry>(
      docs.map((d) => [
        d.slug,
        {
          name: d.name,
          description: d.description,
          specialRequirement: d.specialRequirement,
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
        if (!op.entry?.name) {
          throw new BadRequestException('entry.name is required');
        }
        const entry: CatalogEntry = {
          name: op.entry.name,
          description: op.entry.description,
          specialRequirement: op.entry.specialRequirement,
        };
        map.set(op.slug, entry);
        toUpsert.set(op.slug, entry);
      } else if (op.action === 'update') {
        const existing = map.get(op.slug);
        if (!existing) {
          ignored.push({ slug: op.slug, reason: 'unknown_slug' });
          continue;
        }
        const merged: CatalogEntry = { ...existing, ...op.entry };
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
        // Always permitted: characters hold copies of talents, never references,
        // so a deleted template can not orphan anyone's talents.
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
