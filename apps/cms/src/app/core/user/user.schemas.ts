import { z } from 'zod';

export const CreateUserSchema = z.object({
  username: z.string().min(1, 'Il nome utente è obbligatorio'),
  role: z.enum(['admin', 'player'], { message: 'Il ruolo è obbligatorio' }),
  password: z.string().min(1, 'La password è obbligatoria'),
});

export const EditUserSchema = z.object({
  username: z.string().min(1, 'Il nome utente è obbligatorio'),
  role: z.enum(['admin', 'player']),
});

export const ResetPasswordSchema = z.object({
  password: z.string().min(1, 'La password è obbligatoria'),
});

export type CreateUserDto = z.infer<typeof CreateUserSchema>;
export type EditUserDto = z.infer<typeof EditUserSchema>;
export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;
