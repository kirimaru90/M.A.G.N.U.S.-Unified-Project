import { describe, it, expect } from 'vitest';
import { LoginBlockSchema, TerminalContentSchema } from './terminal-schema';

describe('LoginBlockSchema gateOnBoot', () => {
  it('accepts a login block with gateOnBoot: false', () => {
    const result = LoginBlockSchema.safeParse({
      users: [{ username: 'tec', password: 'robco123' }],
      gateOnBoot: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gateOnBoot).toBe(false);
    }
  });

  it('accepts a login block with gateOnBoot: true', () => {
    const result = LoginBlockSchema.safeParse({
      users: [{ username: 'tec' }],
      gateOnBoot: true,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a login block that omits gateOnBoot', () => {
    const result = LoginBlockSchema.safeParse({
      users: [{ username: 'tec' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gateOnBoot).toBeUndefined();
    }
  });

  it('rejects a non-boolean gateOnBoot with an issue at path login.gateOnBoot', () => {
    const result = TerminalContentSchema.safeParse({
      meta: { title: 'T', public: true },
      state: { local: {}, global: {} },
      login: { users: [{ username: 'tec' }], gateOnBoot: 'yes' },
      nodes: { start: { text: 'ok' } },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) => issue.path.join('.') === 'login.gateOnBoot',
        ),
      ).toBe(true);
    }
  });

  it('round-trips a full terminal content example carrying gateOnBoot', () => {
    const example = {
      meta: { title: 'Guida', public: true },
      state: { local: {}, global: {} },
      login: {
        gateOnBoot: false,
        users: [{ username: 'Tecnico_Addetto', password: 'robco123' }],
      },
      nodes: { start: { text: 'Benvenuto.', choices: [] } },
    };
    const parsed = TerminalContentSchema.parse(example);
    expect(parsed.login.gateOnBoot).toBe(false);
    expect(parsed.login.users[0].username).toBe('Tecnico_Addetto');
  });
});
