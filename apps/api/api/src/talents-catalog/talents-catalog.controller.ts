import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { TalentsCatalogService } from './talents-catalog.service';
import { TalentsCatalogPatchDto } from './dto/talents-catalog-patch.dto';
import { JwtRequiredGuard } from '../common/guards/jwt-required.guard';
import { JwtOptionalGuard } from '../common/guards/jwt-optional.guard';
import { AdminGuard } from '../common/guards/admin.guard';

@ApiTags('talents-catalog')
@ApiBearerAuth()
@Controller('talents-catalog')
export class TalentsCatalogController {
  constructor(private readonly talentsCatalogService: TalentsCatalogService) {}

  @Get()
  @UseGuards(JwtRequiredGuard)
  @ApiOperation({ summary: 'Read the global talents catalog (authenticated)' })
  @ApiQuery({
    name: 'orderBy',
    required: false,
    description:
      'When "name", sort entries alphabetically (Italian, case/accent-insensitive). Any other value → natural order.',
  })
  list(@Query('orderBy') orderBy?: string) {
    return this.talentsCatalogService.findAll(orderBy);
  }

  @Patch()
  @HttpCode(200)
  @UseGuards(JwtOptionalGuard, AdminGuard)
  @ApiOperation({
    summary: 'Batched add/update/rename/delete of talents catalog (admin)',
  })
  @ApiResponse({ status: 200, description: 'Ops applied; returns ignored ops' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin required' })
  @ApiResponse({ status: 409, description: 'Duplicate slug on add or rename' })
  patchSchema(@Body() dto: TalentsCatalogPatchDto) {
    return this.talentsCatalogService.patchSchema(dto.ops);
  }
}
