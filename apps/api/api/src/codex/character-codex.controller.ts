import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { CodexService } from './codex.service';
import { JwtRequiredGuard } from '../common/guards/jwt-required.guard';
import { CampaignAccessGuard } from '../common/guards/campaign-access.guard';
import { CharacterOwnerGuard } from '../common/guards/character-owner.guard';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import {
  CreatePlayerCodexEntryDto,
  UpdatePlayerCodexEntryDto,
} from './dto/player-codex.dto';

type AuthedRequest = { user?: AuthenticatedUser };

/**
 * A character's codex, projected to what it may see, plus the writes a player
 * makes: create, edit visible editable entries, and soft delete.
 */
@ApiTags('codex')
@ApiBearerAuth()
@Controller('campaigns/:campaignId/characters/:characterId/codex')
@UseGuards(JwtRequiredGuard, CampaignAccessGuard, CharacterOwnerGuard)
export class CharacterCodexController {
  constructor(private readonly codexService: CodexService) {}

  @Get()
  @ApiOperation({
    summary: 'List the codex entries a character sees (owner or admin)',
  })
  list(
    @Param('campaignId') campaignId: string,
    @Param('characterId') characterId: string,
  ) {
    return this.codexService.listForCharacter(campaignId, characterId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a codex entry as the character' })
  create(
    @Param('campaignId') campaignId: string,
    @Param('characterId') characterId: string,
    @Body() dto: CreatePlayerCodexEntryDto,
  ) {
    return this.codexService.createForCharacter(campaignId, characterId, dto);
  }

  @Patch(':entryId')
  @ApiOperation({ summary: 'Edit a visible, editable codex entry' })
  @ApiResponse({
    status: 204,
    description: 'Stored, but no longer visible to the character',
  })
  @ApiResponse({ status: 403, description: 'Entry not editable' })
  async update(
    @Param('campaignId') campaignId: string,
    @Param('characterId') characterId: string,
    @Param('entryId') entryId: string,
    @Body() dto: UpdatePlayerCodexEntryDto,
    @Request() req: AuthedRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const projected = await this.codexService.updateForCharacter(
      campaignId,
      characterId,
      entryId,
      dto,
      req.user?.role === 'admin',
    );
    if (projected === null) {
      reply.status(204);
      return;
    }
    return projected;
  }

  @Delete(':entryId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft-delete a visible, editable codex entry' })
  @ApiResponse({ status: 403, description: 'Entry not editable' })
  remove(
    @Param('campaignId') campaignId: string,
    @Param('characterId') characterId: string,
    @Param('entryId') entryId: string,
    @Request() req: AuthedRequest,
  ) {
    return this.codexService.removeForCharacter(
      campaignId,
      characterId,
      entryId,
      req.user?.role === 'admin',
    );
  }
}
