import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TalentCatalogEntryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(7)
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(5, { each: true })
  specialRequirement?: number[];
}

export class TalentsCatalogOpDto {
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

  @ApiPropertyOptional({ type: TalentCatalogEntryDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TalentCatalogEntryDto)
  entry?: TalentCatalogEntryDto;
}

export class TalentsCatalogPatchDto {
  @ApiProperty({ type: [TalentsCatalogOpDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => TalentsCatalogOpDto)
  ops: TalentsCatalogOpDto[];
}
