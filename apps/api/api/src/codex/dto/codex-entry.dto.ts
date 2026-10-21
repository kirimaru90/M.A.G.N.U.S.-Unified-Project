import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CODEX_TYPES, CodexType } from '../schemas/codex-entry.schema';

export const IMAGE_URL_OPTIONS = {
  protocols: ['http', 'https'],
  require_protocol: true,
};

/** Rejects a name made only of whitespace. */
export const NON_BLANK = /\S/;

/** Body for an entry authored by the master. */
export class CreateCodexEntryDto {
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

  @ApiPropertyOptional({ description: 'Visible only to the master' })
  @IsOptional()
  @IsString()
  secretDescription?: string;

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

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  visibleToCharacterIds?: string[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isEditable?: boolean;

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

/**
 * Partial update by the master. `isDeleted: false` restores the entry and
 * clears the deletion fields; `isDeleted: true` soft-deletes it as the master.
 */
export class UpdateCodexEntryDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  secretDescription?: string;

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

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  visibleToCharacterIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isEditable?: boolean;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'A place slug, or null to clear',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  mapPlaceSlug?: string | null;

  @ApiPropertyOptional({ description: 'false restores, true soft-deletes' })
  @IsOptional()
  @IsBoolean()
  isDeleted?: boolean;
}

/** Body for `POST …/codex/import`: items are validated one by one by the planner. */
export class ImportCodexDto {
  @ApiProperty({ type: 'array', items: { type: 'object' } })
  @IsArray()
  entries: unknown[];
}
