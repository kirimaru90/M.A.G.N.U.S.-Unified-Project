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
import { TagCatalogService } from './tag-catalog.service';
import { TagCatalogPatchDto } from './dto/tag-catalog-patch.dto';
import { JwtRequiredGuard } from '../common/guards/jwt-required.guard';
import { JwtOptionalGuard } from '../common/guards/jwt-optional.guard';
import { AdminGuard } from '../common/guards/admin.guard';

@ApiTags('tag-catalog')
@ApiBearerAuth()
@Controller('tag-catalog')
export class TagCatalogController {
  constructor(private readonly tagCatalogService: TagCatalogService) {}

  @Get()
  @UseGuards(JwtRequiredGuard)
  @ApiOperation({ summary: 'Read the global tag catalog (authenticated)' })
  list() {
    return this.tagCatalogService.findAll();
  }

  @Patch()
  @HttpCode(200)
  @UseGuards(JwtOptionalGuard, AdminGuard)
  @ApiOperation({
    summary: 'Batched add/update/rename/delete of tag catalog (admin)',
  })
  @ApiResponse({ status: 200, description: 'Ops applied; returns ignored ops' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin required' })
  @ApiResponse({ status: 409, description: 'Duplicate slug on add or rename' })
  patchSchema(@Body() dto: TagCatalogPatchDto) {
    return this.tagCatalogService.patchSchema(dto.ops);
  }
}
