import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const SEVERITIES = ['minor', 'major'] as const;
const POLARITIES = ['positive', 'negative'] as const;

export class ConditionCatalogEntryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ enum: SEVERITIES })
  @IsOptional()
  @IsIn(SEVERITIES)
  defaultSeverity?: 'minor' | 'major';

  @ApiPropertyOptional({ enum: POLARITIES })
  @IsOptional()
  @IsIn(POLARITIES)
  polarity?: 'positive' | 'negative';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class ConditionsCatalogOpDto {
  @ApiProperty({ enum: ['add', 'update', 'rename', 'delete'] })
  @IsIn(['add', 'update', 'rename', 'delete'])
  action: 'add' | 'update' | 'rename' | 'delete';

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiPropertyOptional({ description: 'New slug (rename only)' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  rename?: string;

  @ApiPropertyOptional({ type: ConditionCatalogEntryDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ConditionCatalogEntryDto)
  entry?: ConditionCatalogEntryDto;
}

export class ConditionsCatalogPatchDto {
  @ApiProperty({ type: [ConditionsCatalogOpDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ConditionsCatalogOpDto)
  ops: ConditionsCatalogOpDto[];
}
