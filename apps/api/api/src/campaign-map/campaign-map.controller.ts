import { Body, Controller, Get, Param, Put, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CampaignMapService } from './campaign-map.service';
import { PutCampaignMapDto } from './dto/campaign-map.dto';
import { JwtOptionalGuard } from '../common/guards/jwt-optional.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CampaignAccessGuard } from '../common/guards/campaign-access.guard';
import { AuthenticatedUser } from '../auth/jwt.strategy';

@ApiTags('campaign-map')
@Controller()
export class CampaignMapController {
  constructor(private readonly campaignMapService: CampaignMapService) {}

  @Get('campaigns/:id/map')
  @UseGuards(JwtOptionalGuard, CampaignAccessGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Read campaign map (projected by role)' })
  get(@Param('id') id: string, @Request() req: { user?: AuthenticatedUser }) {
    return this.campaignMapService.get(id, req.user);
  }

  @Put('campaigns/:id/map')
  @UseGuards(JwtOptionalGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Replace campaign map (admin)' })
  replace(@Param('id') id: string, @Body() dto: PutCampaignMapDto) {
    return this.campaignMapService.replace(id, dto);
  }
}
