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
import { CharacterOwnerGuard } from '../common/guards/character-owner.guard';
import {
  CreatePlayerQuestDto,
  CreatePlayerStageDto,
  UpdatePlayerStageDto,
} from './dto/player-quest.dto';

/**
 * A character's quest log, projected to what it may see, plus the writes a
 * player makes on their personal quests. Writes touch public stages only and
 * answer with the same projection as the read.
 */
@ApiTags('quests')
@ApiBearerAuth()
@Controller('campaigns/:campaignId/characters/:characterId/quests')
@UseGuards(JwtRequiredGuard, CampaignAccessGuard, CharacterOwnerGuard)
export class CharacterQuestsController {
  constructor(private readonly questsService: QuestsService) {}

  @Get()
  @ApiOperation({
    summary: 'List the quests a character sees (owner or admin, same view)',
  })
  list(
    @Param('campaignId') campaignId: string,
    @Param('characterId') characterId: string,
  ) {
    return this.questsService.listForCharacter(campaignId, characterId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a personal quest for the character' })
  create(
    @Param('campaignId') campaignId: string,
    @Param('characterId') characterId: string,
    @Body() dto: CreatePlayerQuestDto,
  ) {
    return this.questsService.createForCharacter(campaignId, characterId, dto);
  }

  @Delete(':questId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a personal quest the character created' })
  @ApiResponse({ status: 403, description: 'Quest assigned by the master' })
  remove(
    @Param('campaignId') campaignId: string,
    @Param('characterId') characterId: string,
    @Param('questId') questId: string,
  ) {
    return this.questsService.removeForCharacter(
      campaignId,
      characterId,
      questId,
    );
  }

  @Post(':questId/stages')
  @ApiOperation({
    summary: 'Add a public stage to a personal quest of the character',
  })
  addStage(
    @Param('campaignId') campaignId: string,
    @Param('characterId') characterId: string,
    @Param('questId') questId: string,
    @Body() dto: CreatePlayerStageDto,
  ) {
    return this.questsService.addStageForCharacter(
      campaignId,
      characterId,
      questId,
      dto,
    );
  }

  @Patch(':questId/stages/:stageId')
  @ApiOperation({
    summary: 'Edit a public stage of a personal quest of the character',
  })
  updateStage(
    @Param('campaignId') campaignId: string,
    @Param('characterId') characterId: string,
    @Param('questId') questId: string,
    @Param('stageId') stageId: string,
    @Body() dto: UpdatePlayerStageDto,
  ) {
    return this.questsService.updateStageForCharacter(
      campaignId,
      characterId,
      questId,
      stageId,
      dto,
    );
  }

  @Delete(':questId/stages/:stageId')
  @ApiOperation({ summary: 'Delete the last public stage of a personal quest' })
  @ApiResponse({
    status: 409,
    description: 'Not the last public stage, or the only one',
  })
  removeStage(
    @Param('campaignId') campaignId: string,
    @Param('characterId') characterId: string,
    @Param('questId') questId: string,
    @Param('stageId') stageId: string,
  ) {
    return this.questsService.removeStageForCharacter(
      campaignId,
      characterId,
      questId,
      stageId,
    );
  }
}
