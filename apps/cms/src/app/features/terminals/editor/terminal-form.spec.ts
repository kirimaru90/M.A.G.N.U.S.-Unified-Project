import { FormArray } from '@angular/forms';
import { describe, it, expect } from 'vitest';
import { toForm, toContent } from './terminal-form';
import type { TerminalContent } from '../../../domain/terminal-schema';

function baseContent(): TerminalContent {
  return {
    meta: { title: 'Terminal', public: true },
    state: { local: {}, global: {} },
    login: { users: [{ username: 'tecnico' }, { username: 'ospite' }] },
    nodes: { start: { text: 'hi' } },
  } as TerminalContent;
}

describe('terminal-form', () => {
  describe('toForm', () => {
    it('hydrates password fields from fictionalUsers matched by username', () => {
      const form = toForm(baseContent(), [{ username: 'tecnico', password: 'robco123' }]);
      const users = form.get('users') as FormArray;

      expect(users.at(0).get('username')?.value).toBe('tecnico');
      expect(users.at(0).get('password')?.value).toBe('robco123');
      // "ospite" has no matching fictionalUsers entry -> blank, not undefined
      expect(users.at(1).get('username')?.value).toBe('ospite');
      expect(users.at(1).get('password')?.value).toBe('');
    });

    it('does not read passwords from content.login.users', () => {
      const content = {
        ...baseContent(),
        login: { users: [{ username: 'tecnico', password: 'leaked-if-read' }] },
      } as TerminalContent;
      const form = toForm(content, []);
      const users = form.get('users') as FormArray;
      expect(users.at(0).get('password')?.value).toBe('');
    });
  });

  describe('toContent', () => {
    it('includes the password key for a filled row and omits it for a blank row', () => {
      const form = toForm(baseContent(), [{ username: 'tecnico', password: 'robco123' }]);
      const content = toContent(form.getRawValue()) as { login: { users: { username: string; password?: string }[] } };

      expect(content.login.users).toEqual([
        { username: 'tecnico', password: 'robco123' },
        { username: 'ospite' },
      ]);
    });

    it('omits the password key when the field is whitespace-only', () => {
      const form = toForm(baseContent(), [{ username: 'tecnico', password: 'robco123' }]);
      const users = form.get('users') as FormArray;
      users.at(0).get('password')?.setValue('   ');

      const content = toContent(form.getRawValue()) as { login: { users: { username: string; password?: string }[] } };
      expect(content.login.users[0]).toEqual({ username: 'tecnico' });
    });
  });
});
