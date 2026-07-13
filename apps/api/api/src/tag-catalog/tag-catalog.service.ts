import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  TagCatalogEntry,
  TagCatalogEntryDocument,
} from './schemas/tag-catalog-entry.schema';
import { TagCatalogOpDto } from './dto/tag-catalog-patch.dto';

export type IgnoredCatalogOp = { slug: string; reason: 'unknown_slug' };

interface CatalogEntry {
  name: string;
}

@Injectable()
export class TagCatalogService {
  constructor(
    @InjectModel(TagCatalogEntry.name)
    private entryModel: Model<TagCatalogEntryDocument>,
  ) {}

  async findAll() {
    const entries = await this.entryModel.find().lean();
    return entries.map((e) => ({ slug: e.slug, name: e.name }));
  }

  async patchSchema(ops: TagCatalogOpDto[]) {
    const docs = await this.entryModel.find().lean();
    const map = new Map<string, CatalogEntry>(
      docs.map((d) => [d.slug, { name: d.name }]),
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
        const entry: CatalogEntry = { name: op.entry.name };
        map.set(op.slug, entry);
        toUpsert.set(op.slug, entry);
      } else if (op.action === 'update') {
        const existing = map.get(op.slug);
        if (!existing) {
          ignored.push({ slug: op.slug, reason: 'unknown_slug' });
          continue;
        }
        const merged: CatalogEntry = { ...existing };
        if (op.entry?.name !== undefined) merged.name = op.entry.name;
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
        // Always permitted: items hold plain tag names, never references, so a
        // deleted entry can not orphan anyone's inventory.
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
