import { DEFAULT_PLACE_RADIUS_M, type MapPlace } from '../../core/campaign-map/campaign-map.types';

/**
 * The tree and geometry rules, as pure functions over a places array.
 *
 * `effectiveRadius` here MUST agree with `effectiveRadius` in the API's
 * `campaign-map.service.ts` and with the Pip-Boy's `map-geometry.js`: the CMS
 * draws the circle, the Pip-Boy decides what the circle opens, and the API's
 * specs pin the rule. Three implementations, one rule — if you change it here,
 * change it in all three or the author sees a lie.
 */

const EARTH_RADIUS_M = 6_371_008.8;

/** Great-circle distance in metres. */
export function distanceMetres(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function indexBySlug(places: MapPlace[]): Map<string, MapPlace> {
  const map = new Map<string, MapPlace>();
  for (const p of places) map.set(p.slug, p);
  return map;
}

/** Direct children of `slug`, in authored order. */
export function kids(places: MapPlace[], slug: string): MapPlace[] {
  return places.filter((p) => p.parent === slug);
}

/**
 * Ancestors of `slug`, nearest first. Cycle-guarded: a malformed chain stops
 * at the repeat rather than looping. The API rejects cycles, but the CMS holds
 * unsaved edits that can transiently be cyclic, so this cannot assume a DAG.
 */
export function ancestors(places: MapPlace[], slug: string): MapPlace[] {
  const bySlug = indexBySlug(places);
  const out: MapPlace[] = [];
  const seen = new Set<string>([slug]);
  let cur = bySlug.get(slug)?.parent;
  while (cur && !seen.has(cur)) {
    const next = bySlug.get(cur);
    if (!next) break;
    out.push(next);
    seen.add(cur);
    cur = next.parent ?? undefined;
  }
  return out;
}

/** Every descendant of `slug`, depth-first, cycle-guarded. */
export function descendants(places: MapPlace[], slug: string): MapPlace[] {
  const out: MapPlace[] = [];
  const seen = new Set<string>([slug]);
  const walk = (parent: string) => {
    for (const child of places) {
      if (child.parent !== parent) continue;
      if (seen.has(child.slug)) continue;
      seen.add(child.slug);
      out.push(child);
      walk(child.slug);
    }
  };
  walk(slug);
  return out;
}

/** 0 for a root place. */
export function depth(places: MapPlace[], slug: string): number {
  return ancestors(places, slug).length;
}

/** A place with an interior can contain things; a pin cannot. */
export function canParent(place: MapPlace): boolean {
  return place.hasLocalMap;
}

/**
 * A place that is itself public but sits under a hidden ancestor — the third
 * visibility state. It reads as `Ereditato` rather than `Pubblico`, because a
 * player will never receive it: the API's cascade strips the whole subtree.
 */
export function cascaded(places: MapPlace[], slug: string): boolean {
  const place = places.find((p) => p.slug === slug);
  if (!place?.isPublic) return false;
  return ancestors(places, slug).some((a) => !a.isPublic);
}

/** The slugs a player would actually receive: public, with every ancestor public. */
export function visibleToPlayer(places: MapPlace[]): Set<string> {
  const out = new Set<string>();
  for (const p of places) {
    if (!p.isPublic) continue;
    if (ancestors(places, p.slug).some((a) => !a.isPublic)) continue;
    out.add(p.slug);
  }
  return out;
}

/**
 * The smallest radius each place's children force on it:
 *
 *   floor(p) = max over children c of ( dist(p, c) + R(c) )
 *
 * This is the part of the effective radius the author cannot dial below — the
 * map clamps the drag handle to it. 0 when a place has no children.
 */
export function floorR(places: MapPlace[]): Map<string, number> {
  const r = effectiveRadius(places);
  const out = new Map<string, number>();
  for (const p of places) {
    let floor = 0;
    for (const child of kids(places, p.slug)) {
      floor = Math.max(floor, distanceMetres(p, child) + (r.get(child.slug) ?? 0));
    }
    out.set(p.slug, floor);
  }
  return out;
}

/**
 * Every place's effective radius, keyed by slug:
 *
 *   R(p) = 0                                            when p.hasLocalMap is false
 *   R(p) = max( p.radius, max over children c of ( dist(p,c) + R(c) ) )
 *
 * Extends over each child's *circle*, not its point — containing a child zone's
 * centre still lets the child poke out of its parent.
 *
 * Seeding the memo with 0 before recursing is what makes a cyclic chain
 * terminate: a place reached again mid-computation reads as 0 and the walk
 * unwinds instead of recursing without bound.
 */
export function effectiveRadius(places: MapPlace[]): Map<string, number> {
  const bySlug = indexBySlug(places);

  const childrenOf = new Map<string, MapPlace[]>();
  for (const p of places) {
    if (!p.parent || !bySlug.has(p.parent)) continue;
    const list = childrenOf.get(p.parent);
    if (list) list.push(p);
    else childrenOf.set(p.parent, [p]);
  }

  const memo = new Map<string, number>();

  const compute = (p: MapPlace): number => {
    const cached = memo.get(p.slug);
    if (cached !== undefined) return cached;
    if (!p.hasLocalMap) {
      memo.set(p.slug, 0);
      return 0;
    }
    memo.set(p.slug, 0);
    let r = p.radius ?? DEFAULT_PLACE_RADIUS_M;
    for (const child of childrenOf.get(p.slug) ?? []) {
      r = Math.max(r, distanceMetres(p, child) + compute(child));
    }
    memo.set(p.slug, r);
    return r;
  };

  for (const p of places) compute(p);
  return memo;
}

/**
 * The zoom at which a place opens on a reference viewport — the `≈zN` the
 * selection card shows. Approximate by construction: the real threshold is
 * `vr <= R(p)` and `vr` depends on the player's screen, so a tablet opens a
 * zone a beat later than a phone. There is no single true answer, which is why
 * this is shown with a `≈`.
 */
export function approxOpenZoom(
  radiusM: number,
  lat: number,
  referenceSizePx = 400,
): number {
  if (radiusM <= 0) return 0;
  // Web Mercator: metres per pixel = 156543.03392 * cos(lat) / 2^zoom.
  // The place opens once half the viewport's short side fits inside R, i.e.
  // (referenceSizePx / 2) * mpp <= R  →  solve for zoom.
  const mppAtZoom0 = (156543.03392 * Math.cos((lat * Math.PI) / 180));
  const zoom = Math.log2((mppAtZoom0 * (referenceSizePx / 2)) / radiusM);
  return Math.max(0, Math.round(zoom));
}
