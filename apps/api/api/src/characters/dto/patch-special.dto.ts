import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Partial-merge of the seven S.P.E.C.I.A.L. attributes (each 0–8 when present).
 *
 * The narrower 18-point / 1..4 build rule is a character-creation constraint
 * enforced client-side by the creation wizard, not an invariant of the stored
 * document — a GM granting a stat increase legitimately leaves that range.
 */
export class PatchSpecialDto {
  @ApiPropertyOptional({ minimum: 0, maximum: 8 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(8)
  strength?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 8 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(8)
  perception?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 8 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(8)
  endurance?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 8 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(8)
  charisma?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 8 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(8)
  intelligence?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 8 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(8)
  agility?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 8 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(8)
  luck?: number;
}
