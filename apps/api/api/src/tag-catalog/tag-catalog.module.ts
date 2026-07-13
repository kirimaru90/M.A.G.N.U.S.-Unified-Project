import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TagCatalogService } from './tag-catalog.service';
import { TagCatalogController } from './tag-catalog.controller';
import { TagCatalogBootstrapService } from './tag-catalog-bootstrap.service';
import {
  TagCatalogEntry,
  TagCatalogEntrySchema,
} from './schemas/tag-catalog-entry.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TagCatalogEntry.name, schema: TagCatalogEntrySchema },
    ]),
  ],
  providers: [TagCatalogService, TagCatalogBootstrapService],
  controllers: [TagCatalogController],
})
export class TagCatalogModule {}
