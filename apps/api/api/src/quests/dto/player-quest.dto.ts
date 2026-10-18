import {
  IsBoolean,
  IsDefined,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QUEST_STATUSES, QuestStatus } from '../schemas/quest.schema';

/**
 * A stage written from the Pip-Boy. There is no `isPublic`: a player's stage
 * is always public, since a player has no drafts.
 */
export class CreatePlayerStageDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reward?: string;

  @ApiPropertyOptional({ enum: QUEST_STATUSES, default: 'in_corso' })
  @IsOptional()
  @IsIn(QUEST_STATUSES)
  status?: QuestStatus;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isMilestone?: boolean;
}

/** Body for editing a public stage from the Pip-Boy; provided fields are merged. */
export class UpdatePlayerStageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reward?: string;

  @ApiPropertyOptional({ enum: QUEST_STATUSES })
  @IsOptional()
  @IsIn(QUEST_STATUSES)
  status?: QuestStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isMilestone?: boolean;
}

/** Body for a personal quest created by a player: just its first stage. */
export class CreatePlayerQuestDto {
  @ApiProperty({ type: CreatePlayerStageDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => CreatePlayerStageDto)
  stage: CreatePlayerStageDto;
}
