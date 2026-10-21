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
import { CodexService } from './codex.service';
import { JwtRequiredGuard } from '../common/guards/jwt-required.guard';
import { CampaignAccessGuard } from '../common/guards/campaign-access.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import {
  CreateCodexEntryDto,
  ImportCodexDto,
  UpdateCodexEntryDto,
} from './dto/codex-entry.dto';

/** Admin authoring of the campaign codex, plus export and import. */
@ApiTags('codex')
@ApiBearerAuth()
@Controller('campaigns/:campaignId/codex')
@UseGuards(JwtRequiredGuard, CampaignAccessGuard, AdminGuard)
export class CodexController {
  constructor(private readonly codexService: CodexService) {}

  @Get()
  @ApiOperation({ summary: 'List codex entries, deleted included (admin)' })
  list(@Param('campaignId') campaignId: string) {
    return this.codexService.list(campaignId);
  }

  // Declared before `:entryId` so `export` is never read as an entry id.
  @Get('export')
  @ApiOperation({ summary: 'Export every codex entry as JSON (admin)' })
  export(@Param('campaignId') campaignId: string) {
    return this.codexService.export(campaignId);
  }

  @Post('import')
  @HttpCode(200)
  @ApiOperation({ summary: 'Append-only import of codex entries (admin)' })
  import(@Param('campaignId') campaignId: string, @Body() dto: ImportCodexDto) {
    return this.codexService.import(campaignId, dto.entries);
  }

  @Get(':entryId')
  @ApiOperation({ summary: 'Get a codex entry, deleted or not (admin)' })
  @ApiResponse({ status: 404, description: 'Entry not in this campaign' })
  get(
    @Param('campaignId') campaignId: string,
    @Param('entryId') entryId: string,
  ) {
    return this.codexService.get(campaignId, entryId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a codex entry (admin)' })
  @ApiResponse({ status: 400, description: 'Character outside the campaign' })
  create(
    @Param('campaignId') campaignId: string,
    @Body() dto: CreateCodexEntryDto,
  ) {
    return this.codexService.create(campaignId, dto);
  }

  @Patch(':entryId')
  @ApiOperation({
    summary: 'Update a codex entry; isDeleted false restores it (admin)',
  })
  @ApiResponse({ status: 400, description: 'Character outside the campaign' })
  update(
    @Param('campaignId') campaignId: string,
    @Param('entryId') entryId: string,
    @Body() dto: UpdateCodexEntryDto,
  ) {
    return this.codexService.update(campaignId, entryId, dto);
  }

  @Delete(':entryId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Permanently delete a codex entry (admin)' })
  remove(
    @Param('campaignId') campaignId: string,
    @Param('entryId') entryId: string,
  ) {
    return this.codexService.remove(campaignId, entryId);
  }
}
