import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsMongoId,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QUEST_KINDS, QuestKind } from '../schemas/quest.schema';
import { CreateStageDto } from './stage.dto';

/**
 * Body for creating a quest: the header plus its required first stage, so a
 * quest never exists without one. Kind-dependent rules (characters for
 * `personal`, `isPublic` for `story`) are enforced by the service.
 */
export class CreateQuestDto {
  @ApiProperty({ enum: QUEST_KINDS })
  @IsIn(QUEST_KINDS)
  kind: QuestKind;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  characterIds?: string[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiProperty({ type: CreateStageDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => CreateStageDto)
  stage: CreateStageDto;
}

/** Body for updating a quest header; validated against the resulting kind. */
export class UpdateQuestDto {
  @ApiPropertyOptional({ enum: QUEST_KINDS })
  @IsOptional()
  @IsIn(QUEST_KINDS)
  kind?: QuestKind;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  characterIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
