import { FormArray } from '@angular/forms';
import { describe, it, expect } from 'vitest';
import { toForm, toContent } from './terminal-form';
import { TerminalContentSchema } from '../../../domain/terminal-schema';
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

    it('hydrates content with no login block (API strips login for user-less terminals)', () => {
      // The API's stripContent deletes content.login when a terminal has no
      // fictional users, so the served content omits the key entirely.
      const { login, ...rest } = baseContent();
      void login;
      const content = rest as TerminalContent;

      let form!: ReturnType<typeof toForm>;
      expect(() => {
        form = toForm(content, []);
      }).not.toThrow();

      expect((form.get('users') as FormArray).length).toBe(0);
      expect(form.get('loginGateOnBoot')?.value).toBe(true);
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

  describe('rich round-trip through toForm → toContent → schema', () => {
    // Exercises the full serialization surface (mutations, conditions, choices,
    // variants, input components with branches, all state-var kinds) so the real
    // save path is covered end-to-end, not just the login fields.
    function richContent(): TerminalContent {
      return {
        meta: { title: 'Rich', public: true },
        state: {
          local: {
            flag: { type: 'boolean', default: true },
            count: { type: 'number', default: 3 },
            name: { type: 'string', default: 'ada' },
            tier: { type: 'enum', values: ['a', 'b'], default: 'a' },
          },
          global: {},
        },
        login: { users: [{ username: 'tecnico' }] },
        nodes: {
          start: {
            text: 'hi',
            on_enter: [{ key: 'local.count', op: 'increment', by: 1 }],
            choices: [
              {
                label: 'go',
                target: 'n2',
                when: { var: 'local.flag', op: 'eq', value: true },
                set: [{ key: 'local.name', op: 'set', value: 'grace' }],
              },
              { label: 'toggle', target: 'start', set: [{ key: 'local.flag', op: 'toggle' }] },
            ],
          },
          n2: {
            variants: [
              { default: true, text: 'default variant', choices: [] },
              { when: { var: 'local.count', op: 'gt', value: 2 }, text: 'many' },
            ],
          },
          n3: {
            components: [
              {
                type: 'input',
                placeholder: 'code?',
                set: 'local.name',
                branches: [
                  { when: { var: 'local.name', op: 'eq', value: 'ada' }, target: 'start' },
                  { default: true, target: 'n2' },
                ],
              },
            ],
          },
          deposito: { text: 'x', login: { users: ['tecnico'] } },
        },
      } as TerminalContent;
    }

    it('serializes back to schema-valid content preserving the salient fields', () => {
      const form = toForm(richContent(), [{ username: 'tecnico', password: 'robco123' }]);
      const serialized = toContent(form.getRawValue());
      const parsed = TerminalContentSchema.safeParse(serialized);

      expect(parsed.success).toBe(true);
      if (!parsed.success) return;
      const nodes = parsed.data.nodes as Record<string, any>;

      expect(nodes['start'].on_enter[0]).toEqual({ key: 'local.count', op: 'increment', by: 1 });
      expect(nodes['start'].choices[0].when).toEqual({ var: 'local.flag', op: 'eq', value: true });
      expect(nodes['start'].choices[1].set[0]).toEqual({ key: 'local.flag', op: 'toggle' });
      expect(nodes['n2'].variants.some((v: any) => v.default === true)).toBe(true);
      expect(nodes['n3'].components[0].branches.some((b: any) => b.default === true)).toBe(true);
      expect(nodes['deposito'].login.users).toEqual(['tecnico']);
      expect(parsed.data.state.local['tier']).toEqual({ type: 'enum', values: ['a', 'b'], default: 'a' });
    });
  });

  describe('save order (toContent then safeParse) preserves node login', () => {
    it('keeps nodes.<id>.login.users through the real save path', () => {
      const content = {
        ...baseContent(),
        nodes: { deposito: { text: 'riservato', login: { users: ['tecnico'] } } },
      } as TerminalContent;
      const form = toForm(content, []);

      // The real save() runs toContent then TerminalContentSchema.safeParse on the result.
      const serialized = toContent(form.getRawValue());
      const parsed = TerminalContentSchema.safeParse(serialized);

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(
          (parsed.data.nodes['deposito'] as { login?: { users: string[] } }).login?.users,
        ).toEqual(['tecnico']);
      }
    });
  });
});
