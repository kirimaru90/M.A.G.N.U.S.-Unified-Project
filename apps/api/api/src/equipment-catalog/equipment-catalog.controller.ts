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
import { EquipmentCatalogService } from './equipment-catalog.service';
import { EquipmentCatalogPatchDto } from './dto/equipment-catalog-patch.dto';
import { JwtRequiredGuard } from '../common/guards/jwt-required.guard';
import { JwtOptionalGuard } from '../common/guards/jwt-optional.guard';
import { AdminGuard } from '../common/guards/admin.guard';

@ApiTags('equipment-catalog')
@ApiBearerAuth()
@Controller('equipment-catalog')
export class EquipmentCatalogController {
  constructor(
    private readonly equipmentCatalogService: EquipmentCatalogService,
  ) {}

  @Get()
  @UseGuards(JwtRequiredGuard)
  @ApiOperation({
    summary: 'Read the global equipment catalog (authenticated)',
  })
  @ApiQuery({
    name: 'starter',
    required: false,
    description: 'When "true", return only templates flagged isStarter',
  })
  @ApiQuery({
    name: 'orderBy',
    required: false,
    description:
      'When "name", sort entries alphabetically (Italian, case/accent-insensitive). Any other value → natural order.',
  })
  list(
    @Query('starter') starter?: string,
    @Query('orderBy') orderBy?: string,
  ) {
    return this.equipmentCatalogService.findAll(starter === 'true', orderBy);
  }

  @Patch()
  @HttpCode(200)
  @UseGuards(JwtOptionalGuard, AdminGuard)
  @ApiOperation({
    summary: 'Batched add/update/rename/delete of equipment catalog (admin)',
  })
  @ApiResponse({ status: 200, description: 'Ops applied; returns ignored ops' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin required' })
  @ApiResponse({ status: 409, description: 'Duplicate slug on add or rename' })
  patchSchema(@Body() dto: EquipmentCatalogPatchDto) {
    return this.equipmentCatalogService.patchSchema(dto.ops);
  }
}
