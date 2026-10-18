import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QUEST_STATUSES, QuestStatus } from '../schemas/quest.schema';

/** Body for appending a stage. `title` is required; the rest is free text or flags. */
export class CreateStageDto {
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

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

/** Body for updating a stage at any position; provided fields are merged. */
export class UpdateStageDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
