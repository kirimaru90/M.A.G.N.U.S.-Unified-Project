import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PatchSpecialDto } from './patch-special.dto';
import { SkillItemDto } from './patch-skills.dto';
import { PerkItemDto } from './patch-perks.dto';
import { ConditionItemDto } from './patch-status.dto';
import { PatchResourcesDto } from './patch-resources.dto';
import { PatchActionPointsDto } from './patch-action-points.dto';
import {
  WeaponEquipItemDto,
  ConsumableGenericItemDto,
} from './patch-inventory.dto';

/** Inventory as direct arrays (full replace), distinct from the PATCH envelope. */
export class UpdateInventoryDto {
  @ApiPropertyOptional({ type: [WeaponEquipItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WeaponEquipItemDto)
  weapons?: WeaponEquipItemDto[];

  @ApiPropertyOptional({ type: [WeaponEquipItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WeaponEquipItemDto)
  equip?: WeaponEquipItemDto[];

  @ApiPropertyOptional({ type: [ConsumableGenericItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConsumableGenericItemDto)
  consumables?: ConsumableGenericItemDto[];

  @ApiPropertyOptional({ type: [ConsumableGenericItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConsumableGenericItemDto)
  other?: ConsumableGenericItemDto[];
}

/** Status as direct condition arrays + scalar (full replace). */
export class UpdateStatusDto {
  @ApiPropertyOptional({ type: [ConditionItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConditionItemDto)
  positiveConditions?: ConditionItemDto[];

  @ApiPropertyOptional({ type: [ConditionItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConditionItemDto)
  negativeConditions?: ConditionItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  criticalState?: boolean;
}

/**
 * Full mutable character body for `PUT`. Sections mirror the GET response
 * shape. The per-section whitelist scrub still runs for non-admins; every
 * section is currently owner-writable, so nothing is dropped in practice.
 */
export class UpdateCharacterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  /** A species-catalog slug; validated against the live catalog on write. */
  @ApiPropertyOptional({ description: 'Species catalog slug' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  species?: string;

  @ApiPropertyOptional({ type: PatchSpecialDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PatchSpecialDto)
  special?: PatchSpecialDto;

  @ApiPropertyOptional({ type: [SkillItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SkillItemDto)
  skills?: SkillItemDto[];

  @ApiPropertyOptional({ type: PatchActionPointsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PatchActionPointsDto)
  actionPoints?: PatchActionPointsDto;

  @ApiPropertyOptional({ type: UpdateStatusDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateStatusDto)
  status?: UpdateStatusDto;

  @ApiPropertyOptional({ type: [PerkItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PerkItemDto)
  perks?: PerkItemDto[];

  @ApiPropertyOptional({ type: PatchResourcesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PatchResourcesDto)
  resources?: PatchResourcesDto;

  @ApiPropertyOptional({ type: UpdateInventoryDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateInventoryDto)
  inventory?: UpdateInventoryDto;
}
