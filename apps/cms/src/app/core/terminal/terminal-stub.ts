import { TerminalContent, TerminalContentSchema } from '../../domain/terminal-schema';

export function buildTerminalStub(opts: { title: string; public: boolean }): TerminalContent {
  // No meta.id: it is server-owned and assigned by the API on create.
  const stub = {
    meta: { title: opts.title, public: opts.public },
    state: { local: {}, global: {} },
    login: { users: [] },
    nodes: {
      start: { text: 'Inserisci il testo del nodo di partenza...', choices: [] },
    },
  };

  const result = TerminalContentSchema.safeParse(stub);
  if (!result.success) {
    throw new Error('buildTerminalStub: schema validation failed — ' + JSON.stringify(result.error.issues));
  }
  return result.data;
}
