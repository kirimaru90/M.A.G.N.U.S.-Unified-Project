import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Sets or clears the character background. An empty string clears the stored
 * value; omitting `background` entirely is a no-op set (treated as clear here,
 * since PATCH targets this single field).
 */
export class PatchBackgroundDto {
  @ApiPropertyOptional({
    description: 'Narrative background prose; empty string clears it',
  })
  @IsOptional()
  @IsString()
  background?: string;
}
