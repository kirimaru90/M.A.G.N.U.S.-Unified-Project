import type { SortOrder, mongo } from 'mongoose';

/**
 * Italian, case- and accent-insensitive collation for alphabetical sorting.
 *
 * A plain Mongo `.sort({ name: 1 })` orders by raw byte value: uppercase before
 * lowercase, and accented letters (à, è, ù) after `z`. Sorting under this
 * collation folds case and accents so names interleave the way a reader expects
 * (`àncora` < `Pistola` < `pistola` < `Zaino`), matching the client's
 * `localeCompare`.
 */
export const IT_COLLATION: mongo.CollationOptions = { locale: 'it', strength: 1 };

/**
 * Parse an optional `?orderBy` query value into a Mongoose sort spec.
 *
 * Lenient by design (mirroring how `?starter` tolerates any non-`'true'` value):
 * an absent, empty, or non-whitelisted field yields `null`, leaving the caller
 * to return results in natural storage order rather than raising an error. Only
 * ascending order on a whitelisted field is supported today.
 *
 * @param orderBy  the raw query-param value (e.g. `'name'`)
 * @param allowed  the fields a caller permits sorting on (e.g. `['name']`)
 * @returns a sort spec like `{ name: 1 }`, or `null` for natural order
 */
export function parseOrderBy(
  orderBy: string | undefined | null,
  allowed: readonly string[],
): Record<string, SortOrder> | null {
  if (!orderBy) return null;
  const field = orderBy.trim();
  if (!field || !allowed.includes(field)) return null;
  return { [field]: 1 };
}
