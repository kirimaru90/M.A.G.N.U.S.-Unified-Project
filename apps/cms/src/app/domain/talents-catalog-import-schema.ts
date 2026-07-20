import { z } from 'zod';

export const TalentCatalogImportEntrySchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  specialRequirement: z.array(z.number().int().min(0).max(5)).length(7).optional(),
});

export const TalentsCatalogImportSchema = z.array(TalentCatalogImportEntrySchema);

export type TalentCatalogImportEntry = z.infer<typeof TalentCatalogImportEntrySchema>;
