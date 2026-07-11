import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { SpeciesCatalogService } from './species-catalog.service';
import { SpeciesCatalogPatchDto } from './dto/species-catalog-patch.dto';
import { JwtRequiredGuard } from '../common/guards/jwt-required.guard';
import { JwtOptionalGuard } from '../common/guards/jwt-optional.guard';
import { AdminGuard } from '../common/guards/admin.guard';

@ApiTags('species-catalog')
@ApiBearerAuth()
@Controller('species-catalog')
export class SpeciesCatalogController {
  constructor(private readonly speciesCatalogService: SpeciesCatalogService) {}

  @Get()
  @UseGuards(JwtRequiredGuard)
  @ApiOperation({ summary: 'Read the global species catalog (authenticated)' })
  list() {
    return this.speciesCatalogService.findAll();
  }

  @Patch()
  @HttpCode(200)
  @UseGuards(JwtOptionalGuard, AdminGuard)
  @ApiOperation({
    summary: 'Batched add/update/rename/delete of species catalog (admin)',
  })
  @ApiResponse({ status: 200, description: 'Ops applied; returns ignored ops' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin required' })
  @ApiResponse({
    status: 409,
    description: 'Duplicate slug, or species still in use by a character',
  })
  patchSchema(@Body() dto: SpeciesCatalogPatchDto) {
    return this.speciesCatalogService.patchSchema(dto.ops);
  }
}
