import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty()
  @IsString()
  username: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  password: string;

  @ApiPropertyOptional({
    description: 'Issue a 365-day token instead of the default 24h one',
  })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
