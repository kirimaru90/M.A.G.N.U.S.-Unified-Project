/**
 * Own enumerable keys whose value is not `undefined`.
 *
 * A DTO instance produced by ValidationPipe carries every declared property as
 * an own key, `undefined` for those the caller omitted. Spreading it straight
 * over a stored entry would therefore erase fields the caller never mentioned,
 * turning a partial `update` op into a destructive one.
 */
export function definedOnly<T extends object>(
  source: T | undefined,
): Partial<T> {
  if (!source) return {};
  const out: Partial<T> = {};
  for (const key of Object.keys(source) as Array<keyof T>) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}
