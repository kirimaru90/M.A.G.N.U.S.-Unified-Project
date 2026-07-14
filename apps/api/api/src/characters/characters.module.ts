import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CharactersService } from './characters.service';
import { CharactersController } from './characters.controller';
import { CharacterNotesService } from './character-notes.service';
import { CharacterNotesController } from './character-notes.controller';
import { Character, CharacterSchema } from './schemas/character.schema';
import {
  CharacterNote,
  CharacterNoteSchema,
} from './schemas/character-note.schema';
import { Campaign, CampaignSchema } from '../campaigns/schemas/campaign.schema';
import { CharacterOwnerGuard } from '../common/guards/character-owner.guard';
import { CampaignAccessGuard } from '../common/guards/campaign-access.guard';
import { SpeciesCatalogModule } from '../species-catalog/species-catalog.module';
import { SkillsCatalogModule } from '../skills-catalog/skills-catalog.module';
import { PersonalTerminalService } from './personal-terminal.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Character.name, schema: CharacterSchema },
      { name: CharacterNote.name, schema: CharacterNoteSchema },
      { name: Campaign.name, schema: CampaignSchema },
    ]),
    // Supplies SpeciesCatalogService, which validates `character.species` on write.
    SpeciesCatalogModule,
    // Supplies SkillsCatalogService, used to resolve skill slugs in the personal terminal.
    SkillsCatalogModule,
  ],
  providers: [
    CharactersService,
    CharacterNotesService,
    PersonalTerminalService,
    CharacterOwnerGuard,
    CampaignAccessGuard,
  ],
  controllers: [CharactersController, CharacterNotesController],
})
export class CharactersModule {}
