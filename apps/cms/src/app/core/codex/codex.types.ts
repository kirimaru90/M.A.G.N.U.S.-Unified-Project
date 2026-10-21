import type { components } from '../../../api/generated/openapi-types';
import type { PlaceType } from '../campaign-map/campaign-map.types';

export type CodexType = 'personaggio' | 'luogo' | 'fazione' | 'creatura';

export const CODEX_TYPES: CodexType[] = ['personaggio', 'luogo', 'fazione', 'creatura'];

export const CODEX_TYPE_LABELS: Record<CodexType, string> = {
  personaggio: 'Personaggio',
  luogo: 'Luogo',
  fazione: 'Fazione',
  creatura: 'Creatura',
};

/** A referenced character resolved by the admin read; `deleted` marks a soft-deleted one. */
export interface CodexCharacterRef {
  id: string;
  name: string;
  deleted: boolean;
}

// TODO(openapi-gap): the codex endpoints declare request DTOs but no response schemas.
// The response shapes below are hand-typed to match specs/api-codex/spec.md.
export interface CodexEntry {
  id: string;
  type: CodexType;
  name: string;
  description: string | null;
  /** Visible only to the master. */
  secretDescription: string | null;
  imageUrl: string | null;
  isPublic: boolean;
  visibleToCharacterIds: string[];
  isEditable: boolean;
  mapPlaceSlug: string | null;
  /** The character that created the entry from the Pip-Boy; `null` when the master did. */
  createdByCharacterId: string | null;
  isDeleted: boolean;
  deletedAt: string | null;
  /** The character that soft-deleted the entry; `null` when the master did. */
  deletedByCharacterId: string | null;
  /** Every character id referenced above, resolved. */
  characters: CodexCharacterRef[];
  createdAt: string;
  updatedAt: string;
}

/** One item of the export file: the authored fields only. */
export type CodexExportItem = Omit<CodexEntry, 'characters' | 'createdAt' | 'updatedAt'>;

export type CodexImportSkipReason = 'invalid' | 'collision' | 'duplicate_in_file';

export interface CodexImportResult {
  added: number;
  skipped: { index: number; name: string; reason: CodexImportSkipReason }[];
}

/** A campaign character as offered by the visibility multi-select. */
export interface CodexCharacterOption {
  id: string;
  name: string;
}

/** A map place as offered by the place select. */
export interface CodexPlaceOption {
  slug: string;
  name: string;
  type: PlaceType;
}

export type CreateCodexEntryBody = components['schemas']['CreateCodexEntryDto'];
export type UpdateCodexEntryBody = components['schemas']['UpdateCodexEntryDto'];
