import { Body, Controller, Put, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtRequiredGuard } from '../common/guards/jwt-required.guard';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { LastSelectionDto } from './dto/last-selection.dto';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtRequiredGuard)
@Controller('users/me/last-selection')
export class UserLastSelectionController {
  constructor(private readonly usersService: UsersService) {}

  @Put()
  @ApiOperation({
    summary: 'Set own last-used campaign + character (authenticated)',
  })
  setLastSelection(
    @Request() req: { user: AuthenticatedUser },
    @Body() dto: LastSelectionDto,
  ) {
    return this.usersService.setLastSelection(req.user, dto);
  }
}
