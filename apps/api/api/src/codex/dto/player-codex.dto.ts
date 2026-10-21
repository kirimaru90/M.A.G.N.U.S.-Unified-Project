import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CODEX_TYPES, CodexType } from '../schemas/codex-entry.schema';
import { IMAGE_URL_OPTIONS, NON_BLANK } from './codex-entry.dto';

/**
 * An entry written from the Pip-Boy. Master-only fields (`secretDescription`,
 * `visibleToCharacterIds`, `isEditable`) are absent, so sending one is a 400.
 */
export class CreatePlayerCodexEntryDto {
  @ApiProperty({ enum: CODEX_TYPES })
  @IsIn(CODEX_TYPES)
  type: CodexType;

  @ApiProperty()
  @IsString()
  @Matches(NON_BLANK, { message: 'name must not be blank' })
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'An http(s) URL',
  })
  @IsOptional()
  @IsUrl(IMAGE_URL_OPTIONS)
  imageUrl?: string | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'A place slug of the campaign map',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  mapPlaceSlug?: string | null;
}

/** Partial update from the Pip-Boy; provided fields are merged. */
export class UpdatePlayerCodexEntryDto {
  @ApiPropertyOptional({ enum: CODEX_TYPES })
  @IsOptional()
  @IsIn(CODEX_TYPES)
  type?: CodexType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(NON_BLANK, { message: 'name must not be blank' })
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'An http(s) URL, or null to clear',
  })
  @IsOptional()
  @IsUrl(IMAGE_URL_OPTIONS)
  imageUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'A place slug, or null to clear',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  mapPlaceSlug?: string | null;
}
