import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TalentsCatalogService } from './talents-catalog.service';
import { TalentsCatalogController } from './talents-catalog.controller';
import { TalentsCatalogBootstrapService } from './talents-catalog-bootstrap.service';
import {
  TalentCatalogEntry,
  TalentCatalogEntrySchema,
} from './schemas/talent-catalog-entry.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TalentCatalogEntry.name, schema: TalentCatalogEntrySchema },
    ]),
  ],
  providers: [TalentsCatalogService, TalentsCatalogBootstrapService],
  controllers: [TalentsCatalogController],
  exports: [TalentsCatalogService],
})
export class TalentsCatalogModule {}
