import {
  Allow,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'alice' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]{3,32}$/, {
    message: 'username must be 3–32 alphanumeric chars',
  })
  username?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({ enum: ['admin', 'player'] })
  @IsOptional()
  @IsEnum(['admin', 'player'])
  role?: 'admin' | 'player';

  // Server-owned fields: accepted-and-ignored so clients that echo back a full
  // user object do not get a 400 from the global forbidNonWhitelisted pipe.
  // @Allow() whitelists them without validating; the service never reads them.
  @ApiPropertyOptional({ description: 'Server-owned; accepted but ignored.' })
  @Allow()
  lastCampaignId?: string | null;

  @ApiPropertyOptional({
    type: [String],
    description: 'Server-owned; accepted but ignored.',
  })
  @Allow()
  unlockedHiddenIds?: string[];
}
