import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SpeciesCatalogEntryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ description: "The species' permanent benefit copy" })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  permesso?: string;

  @ApiPropertyOptional({ description: "The species' drawback copy" })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  svantaggio?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  tagSkillBudget?: number;

  @ApiPropertyOptional({
    minimum: 1,
    description: 'Starting health margin (positive integer)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  margin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class SpeciesCatalogOpDto {
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

  @ApiPropertyOptional({ type: SpeciesCatalogEntryDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SpeciesCatalogEntryDto)
  entry?: SpeciesCatalogEntryDto;
}

export class SpeciesCatalogPatchDto {
  @ApiProperty({ type: [SpeciesCatalogOpDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => SpeciesCatalogOpDto)
  ops: SpeciesCatalogOpDto[];
}
