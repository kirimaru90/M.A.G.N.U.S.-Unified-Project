import { BadRequestException } from '@nestjs/common';
import { nanoid } from 'nanoid';
import { AuthenticatedUser } from '../auth/jwt.strategy';

/** An element of a server-minted nanoid collection (perks, conditions, items). */
export interface Identified {
  id: string;
}

/**
 * Return a copy of `obj` with every key whose value is `undefined` removed.
 *
 * Guards the shallow-merge sites where a partial patch meets a stored record.
 * The global `ValidationPipe` (`transform: true`) materialises each request body
 * as a DTO class instance, and with `useDefineForClassFields` (ES2023) every
 * *declared* field exists as an own, enumerable property — `undefined` for the
 * fields the client never sent. Spreading that instance over the stored record
 * lets those `undefined`s clobber stored values. Pruning them first encodes the
 * real contract: an omitted field means *unchanged*.
 *
 * Only strictly-`undefined` values are dropped; `false`, `0`, `''`, and `[]` are
 * real values and survive, so intentional clears (e.g. `tags: []`) still apply.
 */
export function pruneUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

/** An incoming patch item: `id` optional (absent = create). */
export type PatchItem<T extends Identified> = Partial<T> & { id?: string };

/**
 * An entry describing something the server silently dropped during a section PATCH.
 *
 * `unauthorized_field` and `disallowed_section` are no longer emitted for any
 * currently-specified section — every section is owner-writable, and a caller
 * who may not write one is rejected by ownership (404) rather than partially
 * applied. Both are retained, reserved for future field-level restrictions, so
 * the `{ section, ignored }` envelope contract stays stable for consumers.
 */
export type IgnoredEntry =
  | { section: string; reason: 'disallowed_section' }
  | { section: string; key: string; reason: 'unauthorized_field' }
  | { section: string; id: string; reason: 'unknown_id' };

/** Options controlling the id-less and unknown-id behaviour of patchCollectionArray. */
export type PatchCollectionOptions = {
  /** What to do when an item arrives without an `id`. */
  onIdless: 'create' | 'reject400';
  /** What to do when an `id` is present but not found in the existing array. */
  onUnknownId: 'skip' | 'insert';
  /**
   * Optional global pool of already-used ids. When `onIdless === 'create'`,
   * newly minted nanoids are checked against this set and regenerated on
   * collision. Updated in-place as new ids are minted.
   */
  idPool?: Set<string>;
};

/** Result of a patchCollectionArray call. */
export type PatchCollectionResult<T> = {
  result: T[];
  /** Ids present in `items` but not found — only populated when `onUnknownId === 'skip'`. */
  unknownIds: string[];
};

/**
 * Unified collection diff engine for nanoid and catalog-slug collections.
 *
 * Removes `deletedIds`, then for each item:
 *  - `id` present & found     → shallow-merge
 *  - `id` present & not found → `onUnknownId: 'skip'` tracks id in unknownIds; `'insert'` inserts as-is
 *  - `id` absent              → `onIdless: 'create'` mints nanoid(8); `'reject400'` throws 400
 *
 * nanoid collections (perks, conditions, inventory): `{ onIdless: 'create', onUnknownId: 'skip' }`
 * Catalog-slug collections (skills):                 `{ onIdless: 'reject400', onUnknownId: 'insert' }`
 */
export function patchCollectionArray<T extends Identified>(
  existing: T[],
  items: PatchItem<T>[] = [],
  deletedIds: string[] = [],
  options: PatchCollectionOptions,
): PatchCollectionResult<T> {
  const deleted = new Set(deletedIds);
  const result = existing.filter((el) => !deleted.has(el.id));
  const unknownIds: string[] = [];

  for (const item of items) {
    if (item.id) {
      const idx = result.findIndex((el) => el.id === item.id);
      if (idx === -1) {
        if (options.onUnknownId === 'insert') {
          result.push({ ...item } as T);
        } else {
          unknownIds.push(item.id);
        }
      } else {
        result[idx] = { ...result[idx], ...pruneUndefined(item) };
      }
    } else {
      if (options.onIdless === 'reject400') {
        throw new BadRequestException(
          'Each skill item must carry a catalog slug id',
        );
      }
      let id: string;
      do {
        id = nanoid(8);
      } while (options.idPool?.has(id));
      if (options.idPool) options.idPool.add(id);
      result.push({ ...item, id } as T);
    }
  }
  return { result, unknownIds };
}

/**
 * Per-section whitelist of fields a non-admin (player) may write on a character
 * they own. Non-owners never reach this point — `CharacterOwnerGuard` 404s them.
 *  - `[]`  → nothing writable (admin-only section)
 *  - `'*'` → the whole section is writable
 *  - list  → only those top-level keys are writable
 *
 * Every section is currently owner-writable: the reference design's `✎` editor
 * toggle lets the player holding the sheet edit S.P.E.C.I.A.L., skills, perks,
 * PA source/max, and all three resource counters. The mechanism is kept for
 * future per-field restrictions.
 */
export const PLAYER_UPDATABLE_FIELDS: Record<string, string[] | '*'> = {
  special: '*',
  skills: '*',
  perks: '*',
  actionPoints: '*',
  resources: '*',
  status: '*',
  inventory: '*',
};

/** Result of a scrubPayload call. */
export type ScrubResult<T> = {
  scrubbed: Partial<T>;
  ignored: IgnoredEntry[];
};

/**
 * Drop any section/field a non-admin may not write (no 403 — silent purge).
 * Returns the scrubbed payload and ignored entries describing what was dropped.
 * Admins bypass entirely.
 */
export function scrubPayload<T extends Record<string, unknown>>(
  section: string,
  payload: T,
  actor: AuthenticatedUser,
): ScrubResult<T> {
  if (actor.role === 'admin') return { scrubbed: payload, ignored: [] };

  const allowed = PLAYER_UPDATABLE_FIELDS[section];
  if (allowed === '*') return { scrubbed: payload, ignored: [] };
  if (!allowed || allowed.length === 0) {
    return {
      scrubbed: {},
      ignored: [{ section, reason: 'disallowed_section' }],
    };
  }

  const scrubbed: Partial<T> = {};
  const ignored: IgnoredEntry[] = [];
  for (const key of Object.keys(payload)) {
    if (allowed.includes(key)) {
      scrubbed[key as keyof T] = payload[key as keyof T];
    } else {
      ignored.push({ section, key, reason: 'unauthorized_field' });
    }
  }
  return { scrubbed, ignored };
}
