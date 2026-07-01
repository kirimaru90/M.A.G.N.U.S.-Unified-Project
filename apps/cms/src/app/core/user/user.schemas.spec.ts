import { describe, it, expect } from 'vitest';
import { CreateUserSchema, EditUserSchema } from './user.schemas';

// Seed spec for the enable-cms-testing harness: exercises real src/ code
// (the user zod schemas) so the coverage report is non-empty.
describe('user.schemas', () => {
  describe('CreateUserSchema', () => {
    it('accepts a valid payload', () => {
      const result = CreateUserSchema.safeParse({
        username: 'vault101',
        role: 'admin',
        password: 'pip-boy',
      });
      expect(result.success).toBe(true);
    });

    it('rejects an empty username', () => {
      const result = CreateUserSchema.safeParse({
        username: '',
        role: 'player',
        password: 'pip-boy',
      });
      expect(result.success).toBe(false);
    });

    it('rejects an unknown role', () => {
      const result = CreateUserSchema.safeParse({
        username: 'overseer',
        role: 'vault-dweller',
        password: 'pip-boy',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('EditUserSchema', () => {
    it('does not require a password', () => {
      const result = EditUserSchema.safeParse({ username: 'vault101', role: 'player' });
      expect(result.success).toBe(true);
    });
  });
});
