import { isURL } from 'class-validator';
import { nanoid } from 'nanoid';
import { CODEX_TYPES, CodexType } from './schemas/codex-entry.schema';
import { IMAGE_URL_OPTIONS } from './dto/codex-entry.dto';

export type ImportSkipReason = 'invalid' | 'collision' | 'duplicate_in_file';

export interface ImportSkip {
  index: number;
  name: string;
  reason: ImportSkipReason;
}

/** What the planner needs to know about an entry already in the campaign. */
export interface ExistingEntryKey {
  id: string;
  type: string;
  name: string;
}

/** An entry ready to insert, minus `campaignId`; character ids are strings. */
export interface PlannedEntry {
  id: string;
  type: CodexType;
  name: string;
  description?: string;
  secretDescription?: string;
  imageUrl?: string;
  isPublic: boolean;
  visibleToCharacterIds: string[];
  isEditable: boolean;
  mapPlaceSlug: string | null;
  createdByCharacterId: string | null;
  isDeleted: boolean;
  deletedAt: Date | null;
  deletedByCharacterId: string | null;
}

export interface CodexImportPlan {
  toInsert: PlannedEntry[];
  skipped: ImportSkip[];
}

/**
 * The name half of the collision key: trimmed, whitespace collapsed, case and
 * accents folded, so `Diamond  City` and `diamond city` collide.
 */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

const nameKey = (type: string, name: string) =>
  `${type}\u0000${normalizeName(name)}`;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const nonEmptyString = (v: unknown): v is string =>
  typeof v === 'string' && v.trim() !== '';

const optionalString = (v: unknown) => (typeof v === 'string' ? v : undefined);

/**
 * Decide each incoming item independently, in file order. Append-only: an item
 * colliding with an existing entry (deleted or not) by `id` or by type plus
 * normalized name is skipped, never merged. Character ids are kept only when
 * they name a character of the target campaign.
 */
export function planCodexImport(
  existing: ExistingEntryKey[],
  incoming: unknown[],
  campaignCharacterIds: Iterable<string>,
  mintId: () => string = () => nanoid(8),
): CodexImportPlan {
  const characters = new Set([...campaignCharacterIds].map(String));
  const existingIds = new Set(existing.map((e) => e.id));
  const existingNames = new Set(existing.map((e) => nameKey(e.type, e.name)));
  const acceptedIds = new Set<string>();
  const acceptedNames = new Set<string>();

  const toInsert: PlannedEntry[] = [];
  const skipped: ImportSkip[] = [];

  const ownCharacter = (v: unknown): string | null =>
    typeof v === 'string' && characters.has(v) ? v : null;

  incoming.forEach((item, index) => {
    const label =
      isObject(item) && typeof item.name === 'string' ? item.name : '';
    if (
      !isObject(item) ||
      !nonEmptyString(item.name) ||
      !CODEX_TYPES.includes(item.type as CodexType)
    ) {
      skipped.push({ index, name: label, reason: 'invalid' });
      return;
    }

    const type = item.type as CodexType;
    const incomingId = nonEmptyString(item.id) ? item.id.trim() : null;
    const key = nameKey(type, item.name);

    if ((incomingId && existingIds.has(incomingId)) || existingNames.has(key)) {
      skipped.push({ index, name: label, reason: 'collision' });
      return;
    }
    if ((incomingId && acceptedIds.has(incomingId)) || acceptedNames.has(key)) {
      skipped.push({ index, name: label, reason: 'duplicate_in_file' });
      return;
    }

    let id = incomingId;
    while (!id || existingIds.has(id) || acceptedIds.has(id)) id = mintId();
    acceptedIds.add(id);
    acceptedNames.add(key);

    const visible = Array.isArray(item.visibleToCharacterIds)
      ? [
          ...new Set(
            item.visibleToCharacterIds
              .map(ownCharacter)
              .filter((c): c is string => c !== null),
          ),
        ]
      : [];
    const isDeleted = item.isDeleted === true;
    const deletedAt =
      isDeleted &&
      (typeof item.deletedAt === 'string' || typeof item.deletedAt === 'number')
        ? new Date(item.deletedAt)
        : null;

    toInsert.push({
      id,
      type,
      name: item.name.trim(),
      description: optionalString(item.description),
      secretDescription: optionalString(item.secretDescription),
      imageUrl:
        typeof item.imageUrl === 'string' &&
        isURL(item.imageUrl, IMAGE_URL_OPTIONS)
          ? item.imageUrl
          : undefined,
      isPublic: item.isPublic === true,
      visibleToCharacterIds: visible,
      isEditable: item.isEditable === true,
      mapPlaceSlug: nonEmptyString(item.mapPlaceSlug)
        ? item.mapPlaceSlug
        : null,
      createdByCharacterId: ownCharacter(item.createdByCharacterId),
      isDeleted,
      deletedAt: isDeleted
        ? deletedAt && !isNaN(deletedAt.getTime())
          ? deletedAt
          : new Date()
        : null,
      deletedByCharacterId: isDeleted
        ? ownCharacter(item.deletedByCharacterId)
        : null,
    });
  });

  return { toInsert, skipped };
}
