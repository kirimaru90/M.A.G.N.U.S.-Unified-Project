import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  TagCatalogEntry,
  TagCatalogEntryDocument,
} from './schemas/tag-catalog-entry.schema';

type SeedEntry = { slug: string; name: string };

/**
 * A small default set of common weapon/armor tag names so a fresh deployment's
 * tag autocomplete is not blank. Seeded only when the collection is empty, so
 * admin edits are never clobbered.
 */
export const DEFAULT_TAG_CATALOG: SeedEntry[] = [
  { slug: 'proiettili', name: 'PROIETTILI' },
  { slug: 'laser', name: 'LASER' },
  { slug: 'affidabile', name: 'AFFIDABILE' },
  { slug: 'automatica', name: 'AUTOMATICA' },
  { slug: 'lunga-gittata', name: 'LUNGA GITTATA' },
  { slug: 'pesante', name: 'PESANTE' },
  { slug: 'cuoio', name: 'CUOIO' },
  { slug: 'metallo', name: 'METALLO' },
  { slug: 'stealth', name: 'STEALTH' },
  { slug: 'anti-radiazioni', name: 'ANTI-RADIAZIONI' },
];

@Injectable()
export class TagCatalogBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TagCatalogBootstrapService.name);

  constructor(
    @InjectModel(TagCatalogEntry.name)
    private entryModel: Model<TagCatalogEntryDocument>,
  ) {}

  async onApplicationBootstrap() {
    const count = await this.entryModel.estimatedDocumentCount();
    if (count > 0) {
      this.logger.log('Tag catalog already seeded — skipping.');
      return;
    }

    await this.entryModel.insertMany(DEFAULT_TAG_CATALOG);
    this.logger.log(
      `Seeded ${DEFAULT_TAG_CATALOG.length} default tag catalog entries.`,
    );
  }
}
