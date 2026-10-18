import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { QuestsService } from './quests.service';
import { JwtRequiredGuard } from '../common/guards/jwt-required.guard';
import { CampaignAccessGuard } from '../common/guards/campaign-access.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CreateQuestDto, UpdateQuestDto } from './dto/quest.dto';
import { CreateStageDto, UpdateStageDto } from './dto/stage.dto';

/** Admin authoring of campaign quests and their stages. */
@ApiTags('quests')
@ApiBearerAuth()
@Controller('campaigns/:campaignId/quests')
@UseGuards(JwtRequiredGuard, CampaignAccessGuard, AdminGuard)
export class QuestsController {
  constructor(private readonly questsService: QuestsService) {}

  @Get()
  @ApiOperation({ summary: 'List campaign quests with all stages (admin)' })
  list(@Param('campaignId') campaignId: string) {
    return this.questsService.list(campaignId);
  }

  @Get(':questId')
  @ApiOperation({ summary: 'Get a quest with all stages (admin)' })
  @ApiResponse({ status: 404, description: 'Quest not in this campaign' })
  get(
    @Param('campaignId') campaignId: string,
    @Param('questId') questId: string,
  ) {
    return this.questsService.get(campaignId, questId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a quest with its first stage (admin)' })
  @ApiResponse({ status: 400, description: 'Invalid header for its kind' })
  create(@Param('campaignId') campaignId: string, @Body() dto: CreateQuestDto) {
    return this.questsService.create(campaignId, dto);
  }

  @Patch(':questId')
  @ApiOperation({ summary: 'Update a quest header (admin)' })
  @ApiResponse({ status: 400, description: 'Invalid header for its kind' })
  update(
    @Param('campaignId') campaignId: string,
    @Param('questId') questId: string,
    @Body() dto: UpdateQuestDto,
  ) {
    return this.questsService.update(campaignId, questId, dto);
  }

  @Delete(':questId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a quest (admin)' })
  remove(
    @Param('campaignId') campaignId: string,
    @Param('questId') questId: string,
  ) {
    return this.questsService.remove(campaignId, questId);
  }

  @Post(':questId/stages')
  @ApiOperation({ summary: 'Append a stage to a quest (admin)' })
  addStage(
    @Param('campaignId') campaignId: string,
    @Param('questId') questId: string,
    @Body() dto: CreateStageDto,
  ) {
    return this.questsService.addStage(campaignId, questId, dto);
  }

  @Patch(':questId/stages/:stageId')
  @ApiOperation({ summary: 'Update a stage at any position (admin)' })
  updateStage(
    @Param('campaignId') campaignId: string,
    @Param('questId') questId: string,
    @Param('stageId') stageId: string,
    @Body() dto: UpdateStageDto,
  ) {
    return this.questsService.updateStage(campaignId, questId, stageId, dto);
  }

  @Delete(':questId/stages/:stageId')
  @ApiOperation({ summary: 'Delete the last stage of a quest (admin)' })
  @ApiResponse({
    status: 409,
    description: 'Not the last stage, or the only stage',
  })
  removeStage(
    @Param('campaignId') campaignId: string,
    @Param('questId') questId: string,
    @Param('stageId') stageId: string,
  ) {
    return this.questsService.removeStage(campaignId, questId, stageId);
  }
}
