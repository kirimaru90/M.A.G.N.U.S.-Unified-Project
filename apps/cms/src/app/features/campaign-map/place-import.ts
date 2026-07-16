import {
  PLACE_TYPE_OPTIONS,
  type MapPlace,
  type PlaceType,
} from '../../core/campaign-map/campaign-map.types';

export interface MergeResult {
  places: MapPlace[];
  /** Newly inserted. */
  added: number;
  /** Recognised as already present and left untouched. */
  dup: number;
  /** Discarded for want of a name or finite coordinates. */
  skipped: number;
  /** Inserted, but with a parent the file named that could not stand. */
  reparented: number;
}

const VALID_TYPES = new Set<string>(PLACE_TYPE_OPTIONS.map((o) => o.value));

/**
 * Identity for duplicate detection: the name, normalised, plus the coordinates
 * at 4 decimal places (~11 m). Coarser than exact equality on purpose — the
 * same place exported and re-imported must match itself, and float noise or a
 * nudge below the tolerance should not mint a second copy.
 */
export function dedupKey(p: { name: string; lat: number; lng: number }): string {
  const name = p.name.trim().toLowerCase().replace(/\s+/g, ' ');
  return `${name}@${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
}

export function slugify(value: string): string {
  const base = value
    .normalize('NFD')
    // Strip the combining marks NFD just split off, so "Città" slugs as "citta".
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'place';
}

function isFiniteCoord(v: unknown, max: number): v is number {
  return typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= max;
}

/** A free slug near `desired`, never colliding with anything already taken. */
function uniqueSlug(desired: string, taken: Set<string>): string {
  if (!taken.has(desired)) return desired;
  let n = 2;
  while (taken.has(`${desired}-${n}`)) n++;
  return `${desired}-${n}`;
}

type Plan =
  | { kind: 'skip' }
  /** Already present: `slug` names the *existing* place, which is not touched. */
  | { kind: 'dup'; slug: string }
  | { kind: 'add'; slug: string; source: Record<string, unknown> };

/**
 * Merge an imported places array into the authored one, additively.
 *
 * Import decides every entry's fate **by index** before it writes anything, and
 * keeps parent resolution in a separate slug lookup where first occurrence
 * wins. The naive shape — a single map keyed by incoming slug — loses data:
 * incoming slugs can collide with existing ones, collide with each other
 * (concatenate two exports and see), or be absent entirely, and a later entry
 * then overwrites an earlier one's decision.
 *
 * Existing places are never modified. A duplicate is skipped, never overwritten.
 */
export function mergePlaces(existing: MapPlace[], incoming: unknown): MergeResult {
  const list: unknown[] = Array.isArray(incoming) ? incoming : [];

  const taken = new Set<string>(existing.map((p) => p.slug));
  const byDedup = new Map<string, string>();
  for (const p of existing) byDedup.set(dedupKey(p), p.slug);

  // incoming slug -> final slug, first occurrence wins. Separate from the plan
  // precisely because several entries can claim the same incoming slug.
  const slugRemap = new Map<string, string>();

  const plans: Plan[] = [];
  let skipped = 0;
  let dup = 0;

  for (const raw of list) {
    const entry = (raw ?? {}) as Record<string, unknown>;
    const name = typeof entry['name'] === 'string' ? entry['name'].trim() : '';
    const lat = entry['lat'];
    const lng = entry['lng'];

    if (!name || !isFiniteCoord(lat, 90) || !isFiniteCoord(lng, 180)) {
      plans.push({ kind: 'skip' });
      skipped++;
      continue;
    }

    const key = dedupKey({ name, lat, lng });
    const hit = byDedup.get(key);
    const incomingSlug =
      typeof entry['slug'] === 'string' && entry['slug'].trim()
        ? entry['slug'].trim()
        : '';

    if (hit) {
      plans.push({ kind: 'dup', slug: hit });
      dup++;
      if (incomingSlug && !slugRemap.has(incomingSlug)) {
        // The payoff case: a file carrying a zone we already have plus new
        // children. The children's parent resolves to the zone we kept.
        slugRemap.set(incomingSlug, hit);
      }
      continue;
    }

    const slug = uniqueSlug(slugify(incomingSlug || name), taken);
    taken.add(slug);
    byDedup.set(key, slug);
    plans.push({ kind: 'add', slug, source: { ...entry, name, lat, lng } });
    if (incomingSlug && !slugRemap.has(incomingSlug)) {
      slugRemap.set(incomingSlug, slug);
    }
  }

  // Insert, rewriting parents from the plan.
  const added: MapPlace[] = [];
  const existingSlugs = new Set(existing.map((p) => p.slug));
  let reparented = 0;

  for (const plan of plans) {
    if (plan.kind !== 'add') continue;
    const e = plan.source;

    const rawType = e['type'];
    // An unknown type would make the whole PUT 400 on save, with nothing on
    // screen to explain why. Fall back rather than strand the import.
    const type: PlaceType =
      typeof rawType === 'string' && VALID_TYPES.has(rawType)
        ? (rawType as PlaceType)
        : 'poi';

    const hasLocalMap = e['hasLocalMap'] === true;
    const radius =
      hasLocalMap && typeof e['radius'] === 'number' && Number.isFinite(e['radius']) && e['radius'] > 0
        ? (e['radius'] as number)
        : undefined;

    added.push({
      slug: plan.slug,
      name: e['name'] as string,
      type,
      lat: e['lat'] as number,
      lng: e['lng'] as number,
      hasLocalMap,
      ...(radius !== undefined ? { radius } : {}),
      // Absent means hidden. A place wrongly hidden is a nuisance the author
      // fixes with one click; a place wrongly public leaks the GM's secrets.
      isPublic: e['isPublic'] === true,
      parent: typeof e['parent'] === 'string' && e['parent'] ? e['parent'] : null,
      ...(typeof e['desc'] === 'string' ? { desc: e['desc'] } : {}),
      ...(typeof e['icon'] === 'string' && e['icon'] ? { icon: e['icon'] } : {}),
    });
  }

  const merged = [...existing, ...added];
  const bySlug = new Map(merged.map((p) => [p.slug, p]));

  for (const place of added) {
    const ref = place.parent;
    if (!ref) continue;

    // Resolve through the plan first; a parent may also name an existing place
    // directly, in a file authored against this map.
    const resolved = slugRemap.get(ref) ?? (existingSlugs.has(ref) ? ref : undefined);
    const target = resolved ? bySlug.get(resolved) : undefined;

    if (!target || target.slug === place.slug || !target.hasLocalMap) {
      // Dangling, self-referential, or naming a pin — a pin has no interior to
      // contain anything. Detach rather than leave the tree unsaveable.
      place.parent = null;
      reparented++;
      continue;
    }
    place.parent = target.slug;
  }

  // Cycles can only come from a malformed file, but they make the tree
  // unsaveable and every ancestry walk a hang risk, so break them here.
  for (const place of added) {
    if (!place.parent) continue;
    const seen = new Set<string>([place.slug]);
    let cur: string | null | undefined = place.parent;
    while (cur) {
      if (seen.has(cur)) {
        place.parent = null;
        reparented++;
        break;
      }
      seen.add(cur);
      cur = bySlug.get(cur)?.parent ?? null;
    }
  }

  return { places: merged, added: added.length, dup, skipped, reparented };
}

/** Export covers places only: the framing is the campaign's, not the places'. */
export function exportPlaces(places: MapPlace[]): string {
  return JSON.stringify(places, null, 2);
}
