import type { CodexEntry } from '../../core/codex/codex.types';

/** Test fixtures shared by the codex specs. */
export function makeEntry(over: Partial<CodexEntry> = {}): CodexEntry {
  return {
    id: 'e1',
    type: 'luogo',
    name: 'Diamond City',
    description: null,
    secretDescription: null,
    imageUrl: null,
    isPublic: false,
    visibleToCharacterIds: [],
    isEditable: false,
    mapPlaceSlug: null,
    createdByCharacterId: null,
    isDeleted: false,
    deletedAt: null,
    deletedByCharacterId: null,
    characters: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    ...over,
  };
}
