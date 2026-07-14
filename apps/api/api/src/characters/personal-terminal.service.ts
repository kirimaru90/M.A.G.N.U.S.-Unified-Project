import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Character, CharacterDocument } from './schemas/character.schema';
import {
  CharacterNote,
  CharacterNoteDocument,
} from './schemas/character-note.schema';
import { SpeciesCatalogService } from '../species-catalog/species-catalog.service';
import { SkillsCatalogService } from '../skills-catalog/skills-catalog.service';

// ─── Generated terminal content types (a subset of the api-terminals shape) ──

interface TerminalChoice {
  label: string;
  target: string;
}
interface TerminalNode {
  text: string;
  choices?: TerminalChoice[];
}
export interface PersonalTerminalContent {
  meta: { id: string; title: string; public: false };
  nodes: Record<string, TerminalNode>;
}
export interface PersonalTerminalPayload {
  content: PersonalTerminalContent;
  localState: Record<string, never>;
  globalState: Record<string, never>;
}

/** Minimal character shape the builder reads (a `.lean()` doc with background). */
export interface TerminalCharacter {
  name: string;
  species: string;
  special?: Record<string, number>;
  skills?: { id: string; level: string }[];
  paMax?: number;
  paCurrent?: number;
  positiveConditions?: { severity: string }[];
  negativeConditions?: { severity: string }[];
  margin?: number;
  perks?: { name: string; description?: string }[];
  resources?: { caps?: number; scraps?: number; bobbleheads?: number };
  background?: string;
}

export interface TerminalNoteView {
  id: string;
  title: string;
  note: string;
}

// ─── Static display maps (no catalog: these are engine-fixed) ──────────────

const SPECIAL_LABELS: Record<string, string> = {
  strength: 'FORZA',
  perception: 'PERCEZIONE',
  endurance: 'RESISTENZA',
  charisma: 'CARISMA',
  intelligence: 'INTELLIGENZA',
  agility: 'AGILITÀ',
  luck: 'FORTUNA',
};
const SPECIAL_ORDER = [
  'strength',
  'perception',
  'endurance',
  'charisma',
  'intelligence',
  'agility',
  'luck',
];

const MAESTRIA_LABELS: Record<string, string> = {
  competent: 'Competente',
  expert: 'Esperto',
  master: 'Maestro',
};

/** Condition weight for the health readout: a major condition costs 2, a minor 1. */
function conditionWeight(conds?: { severity: string }[]): number {
  return (conds ?? []).reduce(
    (sum, c) => sum + (c.severity === 'major' ? 2 : 1),
    0,
  );
}

/** `## <NOME> / <CRUMB> / …` — the static breadcrumb banner opening each node. */
function crumbHeader(nome: string, ...crumbs: string[]): string {
  return `## ${[nome.toUpperCase(), ...crumbs].join(' / ')}`;
}

/**
 * Build the read-only personal-terminal `content` from a character, its notes,
 * and slug→display-name maps. Pure: no I/O, deterministic for the same inputs.
 */
export function buildPersonalTerminal(
  character: TerminalCharacter,
  notes: TerminalNoteView[],
  speciesNames: Map<string, string>,
  skillNames: Map<string, string>,
): PersonalTerminalContent {
  const nome = character.name;
  const resolve = (map: Map<string, string>, slug: string) =>
    map.get(slug) ?? slug; // unresolved slug falls back to itself, never throws

  const nodes: Record<string, TerminalNode> = {};

  // start — menu
  nodes.start = {
    text: `## SCHEDA PERSONALE — ${nome.toUpperCase()}\n\nSeleziona una sezione.`,
    choices: [
      { label: 'Riepilogo scheda', target: 'summary' },
      { label: 'Background', target: 'background' },
      { label: 'Note', target: 'notes' },
    ],
  };

  // summary — curated digest
  const special = character.special ?? {};
  const specialLine = SPECIAL_ORDER.map(
    (k) => `${SPECIAL_LABELS[k]}: ${special[k] ?? '-'}`,
  ).join('   ');

  const skills = character.skills ?? [];
  const skillsBlock = skills.length
    ? skills
        .map(
          (s) =>
            `- ${resolve(skillNames, s.id)} — ${MAESTRIA_LABELS[s.level] ?? s.level}`,
        )
        .join('\n')
    : '- Nessuna abilità.';

  const netWear =
    conditionWeight(character.negativeConditions) -
    conditionWeight(character.positiveConditions);
  const margin = character.margin ?? 4;
  const health = margin - netWear;

  const res = character.resources ?? {};
  const talents = character.perks ?? [];
  const talentsBlock = talents.length
    ? talents.map((p) => `- ${p.name}`).join('\n')
    : '- Nessun talento.';

  nodes.summary = {
    text: [
      crumbHeader(nome, 'RIEPILOGO'),
      '',
      `SPECIE: ${resolve(speciesNames, character.species)}`,
      '',
      '### S.P.E.C.I.A.L.',
      specialLine,
      '',
      '### ABILITÀ',
      skillsBlock,
      '',
      '### STATO',
      `PA: ${character.paCurrent ?? '-'} / ${character.paMax ?? '-'}`,
      `SALUTE: ${health} / ${margin}`,
      '',
      '### RISORSE',
      `TAPPI: ${res.caps ?? 0}   ROTTAMI: ${res.scraps ?? 0}   BOBBLEHEAD: ${res.bobbleheads ?? 0}`,
      '',
      '### TALENTI',
      talentsBlock,
    ].join('\n'),
  };

  // background
  const backgroundText =
    character.background && character.background.trim()
      ? character.background
      : 'Nessun background registrato.';
  nodes.background = {
    text: `${crumbHeader(nome, 'BACKGROUND')}\n\n${backgroundText}`,
  };

  // notes index
  nodes.notes = notes.length
    ? {
        text: `${crumbHeader(nome, 'NOTE')}\n\nSeleziona una nota.`,
        choices: notes.map((n) => ({ label: n.title, target: `note_${n.id}` })),
      }
    : {
        text: `${crumbHeader(nome, 'NOTE')}\n\nNessuna nota.`,
      };

  // one node per note
  for (const n of notes) {
    nodes[`note_${n.id}`] = {
      text: `${crumbHeader(nome, 'NOTE', n.title.toUpperCase())}\n\n${n.note ?? ''}`,
    };
  }

  return {
    meta: { id: '', title: `SCHEDA PERSONALE — ${nome}`, public: false },
    nodes,
  };
}

@Injectable()
export class PersonalTerminalService {
  constructor(
    @InjectModel(Character.name)
    private characterModel: Model<CharacterDocument>,
    @InjectModel(CharacterNote.name)
    private noteModel: Model<CharacterNoteDocument>,
    private speciesCatalog: SpeciesCatalogService,
    private skillsCatalog: SkillsCatalogService,
  ) {}

  /**
   * Generate the `{ content, localState, globalState }` payload for a character.
   * Read-only: loads the character (with its hidden `background`), its notes, and
   * the species/skills catalogs, then delegates to the pure builder. No writes.
   */
  async getPersonalTerminal(
    campaignId: string,
    characterId: string,
  ): Promise<PersonalTerminalPayload> {
    if (!Types.ObjectId.isValid(characterId)) throw new NotFoundException();

    const character = await this.characterModel
      .findOne({
        _id: new Types.ObjectId(characterId),
        campaignId: new Types.ObjectId(campaignId),
        isDeleted: { $ne: true },
      })
      .select('+background')
      .lean<TerminalCharacter & { _id: Types.ObjectId }>();
    if (!character) throw new NotFoundException();

    const [notes, speciesEntries, skillEntries] = await Promise.all([
      this.noteModel
        .find({ characterId: new Types.ObjectId(characterId) })
        .sort({ createdAt: 1 })
        .lean<TerminalNoteView[]>(),
      this.speciesCatalog.findAll(),
      this.skillsCatalog.findAll(),
    ]);

    const speciesNames = new Map(speciesEntries.map((e) => [e.slug, e.name]));
    const skillNames = new Map(skillEntries.map((e) => [e.slug, e.name]));

    const content = buildPersonalTerminal(
      character,
      notes.map((n) => ({ id: n.id, title: n.title, note: n.note })),
      speciesNames,
      skillNames,
    );
    // meta.id is the character id — a stable synthetic value never used for a write.
    content.meta.id = characterId;

    return { content, localState: {}, globalState: {} };
  }
}
