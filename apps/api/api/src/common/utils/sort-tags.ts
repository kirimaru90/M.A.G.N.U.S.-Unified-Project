/**
 * Canonical tag ordering, shared by the equipment catalog and character
 * inventory: all `core` tags first, then all `extra` tags, and within each
 * group alphabetical by `name` (case-insensitive).
 *
 * Applied on every write so the stored array is always canonical, and defensively
 * on reads so any legacy/unsorted document reads back sorted. Returns a new array;
 * the input is not mutated. Extra fields on each tag (e.g. `damaged`) are preserved.
 */
const TAG_TYPE_ORDER: Record<string, number> = { core: 0, extra: 1 };

export function sortTags<T extends { name: string; type: string }>(
  tags: T[],
): T[] {
  return [...tags].sort((a, b) => {
    const ra = TAG_TYPE_ORDER[a?.type] ?? 99;
    const rb = TAG_TYPE_ORDER[b?.type] ?? 99;
    if (ra !== rb) return ra - rb;
    return String(a?.name ?? '').localeCompare(String(b?.name ?? ''), undefined, {
      sensitivity: 'base',
    });
  });
}
