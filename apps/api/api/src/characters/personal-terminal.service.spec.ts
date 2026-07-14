import {
  buildPersonalTerminal,
  TerminalCharacter,
  TerminalNoteView,
} from './personal-terminal.service';

function makeChar(
  overrides: Partial<TerminalCharacter> = {},
): TerminalCharacter {
  return {
    name: 'Ada',
    species: 'super_mutant',
    special: {
      strength: 3,
      perception: 2,
      endurance: 2,
      charisma: 1,
      intelligence: 3,
      agility: 2,
      luck: 1,
    },
    skills: [{ id: 'lockpick', level: 'expert' }],
    paMax: 10,
    paCurrent: 8,
    positiveConditions: [],
    negativeConditions: [],
    margin: 4,
    perks: [{ name: 'Occhio di Lince' }],
    resources: { caps: 100, scraps: 5, bobbleheads: 1 },
    background: 'Nata nel Vault 88.',
    ...overrides,
  };
}

const speciesNames = new Map([['super_mutant', 'Super Mutante']]);
const skillNames = new Map([['lockpick', 'Scasso']]);

describe('buildPersonalTerminal', () => {
  it('produces start/summary/background/notes + one note_<id> per note', () => {
    const notes: TerminalNoteView[] = [
      { id: 'n1', title: 'Contatti', note: 'Parlare con Ada.' },
      { id: 'n2', title: 'Missioni', note: 'Trovare il chip.' },
    ];
    const content = buildPersonalTerminal(
      makeChar(),
      notes,
      speciesNames,
      skillNames,
    );
    expect(Object.keys(content.nodes).sort()).toEqual(
      ['background', 'note_n1', 'note_n2', 'notes', 'start', 'summary'].sort(),
    );
    // start links the three sections
    expect(content.nodes.start.choices?.map((c) => c.target)).toEqual([
      'summary',
      'background',
      'notes',
    ]);
    // notes index lists a choice per note
    expect(content.nodes.notes.choices).toEqual([
      { label: 'Contatti', target: 'note_n1' },
      { label: 'Missioni', target: 'note_n2' },
    ]);
  });

  it('opens each node with its static breadcrumb header', () => {
    const content = buildPersonalTerminal(
      makeChar(),
      [],
      speciesNames,
      skillNames,
    );
    expect(content.nodes.summary.text.startsWith('## ADA / RIEPILOGO')).toBe(
      true,
    );
    expect(
      content.nodes.background.text.startsWith('## ADA / BACKGROUND'),
    ).toBe(true);
    expect(content.nodes.notes.text.startsWith('## ADA / NOTE')).toBe(true);
    expect(
      content.nodes.start.text.startsWith('## SCHEDA PERSONALE — ADA'),
    ).toBe(true);
  });

  it('note nodes carry the note title in the breadcrumb', () => {
    const content = buildPersonalTerminal(
      makeChar(),
      [{ id: 'n1', title: 'Contatti', note: 'corpo' }],
      speciesNames,
      skillNames,
    );
    expect(content.nodes.note_n1.text).toContain('## ADA / NOTE / CONTATTI');
    expect(content.nodes.note_n1.text).toContain('corpo');
  });

  it('resolves species and skill slugs to display names', () => {
    const content = buildPersonalTerminal(
      makeChar(),
      [],
      speciesNames,
      skillNames,
    );
    expect(content.nodes.summary.text).toContain('Super Mutante');
    expect(content.nodes.summary.text).toContain('Scasso');
    expect(content.nodes.summary.text).not.toContain('super_mutant');
  });

  it('falls back to the raw slug when a skill has no catalog entry', () => {
    const char = makeChar({
      skills: [{ id: 'unknown_skill', level: 'master' }],
    });
    expect(() =>
      buildPersonalTerminal(char, [], speciesNames, new Map()),
    ).not.toThrow();
    const content = buildPersonalTerminal(char, [], speciesNames, new Map());
    expect(content.nodes.summary.text).toContain('unknown_skill');
  });

  it('renders empty states for missing background and notes', () => {
    const content = buildPersonalTerminal(
      makeChar({ background: undefined }),
      [],
      speciesNames,
      skillNames,
    );
    expect(content.nodes.background.text).toContain(
      'Nessun background registrato.',
    );
    expect(content.nodes.notes.text).toContain('Nessuna nota.');
    expect(content.nodes.notes.choices).toBeUndefined();
  });

  it('sets meta with no login and a false public flag', () => {
    const content = buildPersonalTerminal(
      makeChar(),
      [],
      speciesNames,
      skillNames,
    );
    expect(content.meta.public).toBe(false);
    expect(content.meta.title).toBe('SCHEDA PERSONALE — Ada');
    expect(content).not.toHaveProperty('login');
    // No node authors a back/disconnect choice.
    for (const node of Object.values(content.nodes)) {
      const labels = (node.choices ?? []).map((c) => c.label.toLowerCase());
      expect(labels).not.toContain('indietro');
      expect(labels).not.toContain('disconnetti');
    }
  });

  it('renders health as margin minus net condition wear', () => {
    const char = makeChar({
      margin: 5,
      negativeConditions: [{ severity: 'major' }, { severity: 'minor' }], // 3
      positiveConditions: [{ severity: 'minor' }], // 1 → net 2
    });
    const content = buildPersonalTerminal(char, [], speciesNames, skillNames);
    expect(content.nodes.summary.text).toContain('SALUTE: 3 / 5');
  });
});
