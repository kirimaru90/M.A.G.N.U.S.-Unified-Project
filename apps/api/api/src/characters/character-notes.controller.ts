import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CharacterNotesService } from './character-notes.service';
import { JwtRequiredGuard } from '../common/guards/jwt-required.guard';
import { CampaignAccessGuard } from '../common/guards/campaign-access.guard';
import { CharacterOwnerGuard } from '../common/guards/character-owner.guard';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';

@ApiTags('character-notes')
@ApiBearerAuth()
@Controller('campaigns/:campaignId/characters/:characterId/notes')
@UseGuards(JwtRequiredGuard, CampaignAccessGuard, CharacterOwnerGuard)
export class CharacterNotesController {
  constructor(private readonly notesService: CharacterNotesService) {}

  @Get()
  @ApiOperation({ summary: 'List a character notes (owner or admin)' })
  list(@Param('characterId') characterId: string) {
    return this.notesService.list(characterId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a character note (owner or admin)' })
  create(
    @Param('campaignId') campaignId: string,
    @Param('characterId') characterId: string,
    @Body() dto: CreateNoteDto,
  ) {
    return this.notesService.create(campaignId, characterId, dto);
  }

  @Patch(':noteId')
  @ApiOperation({ summary: 'Update a character note (owner or admin)' })
  update(
    @Param('characterId') characterId: string,
    @Param('noteId') noteId: string,
    @Body() dto: UpdateNoteDto,
  ) {
    return this.notesService.update(characterId, noteId, dto);
  }

  @Delete(':noteId')
  @ApiOperation({ summary: 'Delete a character note (owner or admin)' })
  remove(
    @Param('characterId') characterId: string,
    @Param('noteId') noteId: string,
  ) {
    return this.notesService.remove(characterId, noteId);
  }
}
