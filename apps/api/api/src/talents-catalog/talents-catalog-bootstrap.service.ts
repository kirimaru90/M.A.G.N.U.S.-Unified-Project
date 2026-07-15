import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  TalentCatalogEntry,
  TalentCatalogEntryDocument,
} from './schemas/talent-catalog-entry.schema';

/**
 * Default talents seed. Empty for now: unlike the skills catalog there is no
 * canonical talent list yet, so the catalog ships empty and is populated via
 * `PATCH /talents-catalog` (CMS authoring). The bootstrap follows the same
 * once-against-an-empty-collection convention as the skills/admin bootstrap;
 * with an empty seed it simply performs no insert and never fails startup.
 */
export const DEFAULT_TALENTS_CATALOG: Array<{
  slug: string;
  name: string;
  description: string;
}> = [];

@Injectable()
export class TalentsCatalogBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TalentsCatalogBootstrapService.name);

  constructor(
    @InjectModel(TalentCatalogEntry.name)
    private entryModel: Model<TalentCatalogEntryDocument>,
  ) {}

  async onApplicationBootstrap() {
    const count = await this.entryModel.estimatedDocumentCount();
    if (count > 0) {
      this.logger.log('Talents catalog already seeded — skipping.');
      return;
    }

    if (DEFAULT_TALENTS_CATALOG.length === 0) {
      // Empty default seed — leave the (empty) catalog untouched, don't fail startup.
      return;
    }

    await this.entryModel.insertMany(DEFAULT_TALENTS_CATALOG);
    this.logger.log(
      `Seeded ${DEFAULT_TALENTS_CATALOG.length} default talents catalog entries.`,
    );
  }
}
