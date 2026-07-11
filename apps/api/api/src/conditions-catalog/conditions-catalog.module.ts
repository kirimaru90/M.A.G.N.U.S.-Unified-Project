import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConditionsCatalogService } from './conditions-catalog.service';
import { ConditionsCatalogController } from './conditions-catalog.controller';
import {
  ConditionCatalogEntry,
  ConditionCatalogEntrySchema,
} from './schemas/condition-catalog-entry.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: ConditionCatalogEntry.name,
        schema: ConditionCatalogEntrySchema,
      },
    ]),
  ],
  providers: [ConditionsCatalogService],
  controllers: [ConditionsCatalogController],
})
export class ConditionsCatalogModule {}
