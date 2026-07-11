import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCharacterDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name: string;

  /**
   * A species-catalog slug. Not a fixed enum — CharactersService rejects an
   * unknown slug with HTTP 400 against the live catalog. Defaults to `human`.
   */
  @ApiPropertyOptional({ description: 'Species catalog slug (default: human)' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  species?: string;

  @ApiPropertyOptional({
    description: 'Owner user id — required for admins, ignored for players',
  })
  @IsOptional()
  @IsString()
  userId?: string;
}
