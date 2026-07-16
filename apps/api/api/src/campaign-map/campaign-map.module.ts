import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CampaignMapService } from './campaign-map.service';
import { CampaignMapController } from './campaign-map.controller';
import { CampaignMap, CampaignMapSchema } from './schemas/campaign-map.schema';
import { Campaign, CampaignSchema } from '../campaigns/schemas/campaign.schema';
import { CampaignAccessGuard } from '../common/guards/campaign-access.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CampaignMap.name, schema: CampaignMapSchema },
      // CampaignAccessGuard injects the Campaign model, so it has to resolve here.
      { name: Campaign.name, schema: CampaignSchema },
    ]),
  ],
  providers: [CampaignMapService, CampaignAccessGuard],
  controllers: [CampaignMapController],
  exports: [CampaignMapService],
})
export class CampaignMapModule {}
