import { z } from 'zod';

export const CreateCampaignSchema = z.object({
  name: z.string().min(1, 'Il nome è obbligatorio'),
  isActive: z.boolean().default(false),
  isPublic: z.boolean().default(false),
});

export const EditCampaignSchema = z.object({
  name: z.string().min(1, 'Il nome è obbligatorio'),
  isPublic: z.boolean(),
});

export type CreateCampaignDto = z.infer<typeof CreateCampaignSchema>;
export type EditCampaignDto = z.infer<typeof EditCampaignSchema>;
