import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CodexService } from './codex.service';
import { CodexController } from './codex.controller';
import { CharacterCodexController } from './character-codex.controller';
import { CodexEntry, CodexEntrySchema } from './schemas/codex-entry.schema';
import {
  Character,
  CharacterSchema,
} from '../characters/schemas/character.schema';
import { Campaign, CampaignSchema } from '../campaigns/schemas/campaign.schema';
import { CampaignAccessGuard } from '../common/guards/campaign-access.guard';
import { CharacterOwnerGuard } from '../common/guards/character-owner.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CodexEntry.name, schema: CodexEntrySchema },
      // Visibility validation, import id filtering and CharacterOwnerGuard read characters.
      { name: Character.name, schema: CharacterSchema },
      // CampaignAccessGuard injects the Campaign model, so it has to resolve here.
      { name: Campaign.name, schema: CampaignSchema },
    ]),
  ],
  providers: [CodexService, CampaignAccessGuard, CharacterOwnerGuard],
  controllers: [CodexController, CharacterCodexController],
})
export class CodexModule {}
