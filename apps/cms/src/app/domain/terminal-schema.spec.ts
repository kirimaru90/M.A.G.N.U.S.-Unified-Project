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

describe('TerminalContentSchema optional fields with neutral defaults', () => {
  it('omitting state parses and yields { local: {}, global: {} }', () => {
    const result = TerminalContentSchema.safeParse({
      meta: { title: 'T' },
      login: { users: [] },
      nodes: { start: { text: 'x', choices: [] } },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.state).toEqual({ local: {}, global: {} });
    }
  });

  it('omitting login parses and yields { users: [] }', () => {
    const result = TerminalContentSchema.safeParse({
      meta: { title: 'T' },
      state: { local: {}, global: {} },
      nodes: { start: { text: 'x', choices: [] } },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.login).toEqual({ users: [] });
    }
  });

  it('omitting meta.public parses and yields public: false', () => {
    const result = TerminalContentSchema.safeParse({
      meta: { title: 'T' },
      state: { local: {}, global: {} },
      login: { users: [] },
      nodes: { start: { text: 'x', choices: [] } },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.meta.public).toBe(false);
    }
  });

  it('parses content omitting meta.id, and content including meta.id (id optional, not required)', () => {
    const without = TerminalContentSchema.safeParse({
      meta: { title: 'T' },
      state: { local: {}, global: {} },
      login: { users: [] },
      nodes: { start: { text: 'x', choices: [] } },
    });
    expect(without.success).toBe(true);
    if (without.success) {
      expect(without.data.meta.id).toBeUndefined();
    }

    const withId = TerminalContentSchema.safeParse({
      meta: { id: 'srv-1', title: 'T' },
      state: { local: {}, global: {} },
      login: { users: [] },
      nodes: { start: { text: 'x', choices: [] } },
    });
    expect(withId.success).toBe(true);
    if (withId.success) {
      expect(withId.data.meta.id).toBe('srv-1');
    }
  });

  it('minimal file (only meta.title + nodes.start) parses with all defaults applied and meta.id absent', () => {
    const result = TerminalContentSchema.safeParse({
      meta: { title: 'Minimo' },
      nodes: { start: { text: 'x', choices: [] } },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.state).toEqual({ local: {}, global: {} });
      expect(result.data.login).toEqual({ users: [] });
      expect(result.data.meta.public).toBe(false);
      expect(result.data.meta.id).toBeUndefined();
    }
  });

  it('regression: a fully-populated file still parses to the same normalized shape', () => {
    const full = {
      meta: { id: 'srv-9', title: 'Completo', public: true },
      state: { local: { flag: { type: 'boolean', default: true } }, global: {} },
      login: { users: [{ username: 'alice', password: 'wonderland' }] },
      nodes: { start: { text: 'hi', choices: [] } },
    };
    const result = TerminalContentSchema.safeParse(full);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(full);
    }
  });

  it('regression: empty meta.title is still rejected', () => {
    const result = TerminalContentSchema.safeParse({
      meta: { title: '' },
      nodes: { start: { text: 'x', choices: [] } },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'meta.title')).toBe(true);
    }
  });
});

describe('TerminalContentSchema partial state (inner sides optional with {} default)', () => {
  const base = {
    meta: { title: 'T' },
    login: { users: [] },
    nodes: { start: { text: 'x', choices: [] } },
  };

  it('state with only local defaults global to {}', () => {
    const result = TerminalContentSchema.safeParse({
      ...base,
      state: { local: { flag: { type: 'boolean', default: false } } },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.state.global).toEqual({});
      expect(result.data.state.local).toEqual({ flag: { type: 'boolean', default: false } });
    }
  });

  it('state with only global defaults local to {}', () => {
    const result = TerminalContentSchema.safeParse({
      ...base,
      state: { global: { tier: { type: 'string', default: '' } } },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.state.local).toEqual({});
      expect(result.data.state.global).toEqual({ tier: { type: 'string', default: '' } });
    }
  });

  it('empty state object defaults both sides to {}', () => {
    const result = TerminalContentSchema.safeParse({ ...base, state: {} });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.state).toEqual({ local: {}, global: {} });
    }
  });

  it('regression: omitting state entirely still yields { local: {}, global: {} }', () => {
    const result = TerminalContentSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.state).toEqual({ local: {}, global: {} });
    }
  });

  it('regression: a fully-populated state with both sides parses to the same normalized shape', () => {
    const state = {
      local: { flag: { type: 'boolean', default: true } },
      global: { tier: { type: 'string', default: 'gold' } },
    };
    const result = TerminalContentSchema.safeParse({ ...base, state });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.state).toEqual(state);
    }
  });

  it('regression: an invalid variable shape inside a declared side is still rejected', () => {
    const result = TerminalContentSchema.safeParse({
      ...base,
      state: { local: { flag: { type: 'boolean', default: 0 } } },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path.join('.').startsWith('state.local')),
      ).toBe(true);
    }
  });
});
