import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SpeciesCatalogService } from './species-catalog.service';
import { SpeciesCatalogController } from './species-catalog.controller';
import { SpeciesCatalogBootstrapService } from './species-catalog-bootstrap.service';
import {
  SpeciesCatalogEntry,
  SpeciesCatalogEntrySchema,
} from './schemas/species-catalog-entry.schema';
import {
  Character,
  CharacterSchema,
} from '../characters/schemas/character.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SpeciesCatalogEntry.name, schema: SpeciesCatalogEntrySchema },
      // Read-only: needed to reject deleting/renaming a species still in use.
      { name: Character.name, schema: CharacterSchema },
    ]),
  ],
  providers: [SpeciesCatalogService, SpeciesCatalogBootstrapService],
  controllers: [SpeciesCatalogController],
  // CharactersService validates `character.species` against the catalog on write.
  exports: [SpeciesCatalogService],
})
export class SpeciesCatalogModule {}
