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

export class TagCatalogEntryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;
}

export class TagCatalogOpDto {
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

  @ApiPropertyOptional({ type: TagCatalogEntryDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TagCatalogEntryDto)
  entry?: TagCatalogEntryDto;
}

export class TagCatalogPatchDto {
  @ApiProperty({ type: [TagCatalogOpDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => TagCatalogOpDto)
  ops: TagCatalogOpDto[];
}
