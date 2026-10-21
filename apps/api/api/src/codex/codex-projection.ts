import { Types } from 'mongoose';
import type { CodexType } from './schemas/codex-entry.schema';

/** The fields of a stored entry the projection reads. */
export interface CodexEntryLike {
  id: string;
  type: CodexType;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  isPublic: boolean;
  visibleToCharacterIds: Array<Types.ObjectId | string>;
  isEditable: boolean;
  mapPlaceSlug?: string | null;
  createdByCharacterId?: Types.ObjectId | string | null;
  isDeleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlayerCodexEntry {
  id: string;
  type: CodexType;
  name: string;
  description: string | null;
  imageUrl: string | null;
  isPublic: boolean;
  isEditable: boolean;
  mapPlaceSlug: string | null;
  /** Whether the viewer created the entry. */
  isOwn: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 *   visible = ¬isDeleted ∧ (isPublic ∨ characterId ∈ visibleToCharacterIds)
 *
 * Evaluated on every read, so unpublishing takes effect immediately.
 */
export function isVisibleTo(
  entry: CodexEntryLike,
  characterId: string,
): boolean {
  if (entry.isDeleted) return false;
  if (entry.isPublic) return true;
  return entry.visibleToCharacterIds.map(String).includes(String(characterId));
}

/**
 * What `characterId` may see of `entry`, or `null` when nothing. The secret,
 * the access list, the author and the soft-delete fields never leave here.
 */
export function projectForCharacter(
  entry: CodexEntryLike,
  characterId: string,
): PlayerCodexEntry | null {
  if (!isVisibleTo(entry, characterId)) return null;
  return {
    id: entry.id,
    type: entry.type,
    name: entry.name,
    description: entry.description ?? null,
    imageUrl: entry.imageUrl ?? null,
    isPublic: !!entry.isPublic,
    isEditable: !!entry.isEditable,
    mapPlaceSlug: entry.mapPlaceSlug ?? null,
    isOwn:
      entry.createdByCharacterId != null &&
      String(entry.createdByCharacterId) === String(characterId),
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

/** A write through a character route: visible, and editable unless admin. */
export function canWrite(
  entry: CodexEntryLike,
  characterId: string,
  isAdmin: boolean,
): boolean {
  return isVisibleTo(entry, characterId) && (isAdmin || !!entry.isEditable);
}
