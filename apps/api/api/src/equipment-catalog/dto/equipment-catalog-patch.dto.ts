import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
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
import {
  EQUIPMENT_KINDS,
  TAG_TYPES,
} from '../schemas/equipment-catalog-entry.schema';

export class EquipmentTagDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: TAG_TYPES })
  @IsIn(TAG_TYPES)
  type: 'core' | 'extra';
}

export class EquipmentCatalogEntryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ enum: EQUIPMENT_KINDS })
  @IsOptional()
  @IsIn(EQUIPMENT_KINDS)
  kind?: 'weapon' | 'armor' | 'consumable';

  @ApiPropertyOptional({ type: [EquipmentTagDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EquipmentTagDto)
  tags?: EquipmentTagDto[];

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  defaultQuantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isStarter?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class EquipmentCatalogOpDto {
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

  @ApiPropertyOptional({ type: EquipmentCatalogEntryDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EquipmentCatalogEntryDto)
  entry?: EquipmentCatalogEntryDto;
}

export class EquipmentCatalogPatchDto {
  @ApiProperty({ type: [EquipmentCatalogOpDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => EquipmentCatalogOpDto)
  ops: EquipmentCatalogOpDto[];
}
