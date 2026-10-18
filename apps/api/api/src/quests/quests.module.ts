import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { QuestsService } from './quests.service';
import { QuestsController } from './quests.controller';
import { CharacterQuestsController } from './character-quests.controller';
import { Quest, QuestSchema } from './schemas/quest.schema';
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
      { name: Quest.name, schema: QuestSchema },
      // Assignee validation/resolution and CharacterOwnerGuard read characters.
      { name: Character.name, schema: CharacterSchema },
      // CampaignAccessGuard injects the Campaign model, so it has to resolve here.
      { name: Campaign.name, schema: CampaignSchema },
    ]),
  ],
  providers: [QuestsService, CampaignAccessGuard, CharacterOwnerGuard],
  controllers: [QuestsController, CharacterQuestsController],
})
export class QuestsModule {}
