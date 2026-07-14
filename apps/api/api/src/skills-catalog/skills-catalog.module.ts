import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SkillsCatalogService } from './skills-catalog.service';
import { SkillsCatalogController } from './skills-catalog.controller';
import { SkillsCatalogBootstrapService } from './skills-catalog-bootstrap.service';
import {
  SkillCatalogEntry,
  SkillCatalogEntrySchema,
} from './schemas/skill-catalog-entry.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SkillCatalogEntry.name, schema: SkillCatalogEntrySchema },
    ]),
  ],
  providers: [SkillsCatalogService, SkillsCatalogBootstrapService],
  controllers: [SkillsCatalogController],
  // CharactersModule's personal-terminal generator resolves skill slugs to names.
  exports: [SkillsCatalogService],
})
export class SkillsCatalogModule {}
