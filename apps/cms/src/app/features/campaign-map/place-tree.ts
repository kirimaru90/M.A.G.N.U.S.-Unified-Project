import type { MapPlace } from '../../core/campaign-map/campaign-map.types';
import { distanceMetres, effectiveRadius } from '../../shared/map-core/geometry.js';

/**
 * The tree and geometry rules, as pure functions over a places array.
 *
 * `effectiveRadius` and `distanceMetres` are the shared map core's
 * (apps/packages/map-core/geometry.js), re-exported: the circle the CMS draws
 * and the level of detail both maps render come from one function, so they
 * cannot disagree. The API's `campaign-map.service.ts` is the only other
 * implementation.
 */
export { distanceMetres, effectiveRadius };

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
 * The zoom at which a place opens on a reference viewport — the `≈zN` the
 * selection card shows. Approximate by construction: the real threshold is
 * `vr <= R(p)` and `vr` depends on the player's screen, so a tablet opens a
 * zone a beat later than a phone. There is no single true answer, which is why
 * this is shown with a `≈`.
 */
export function approxOpenZoom(radiusM: number, lat: number, referenceSizePx = 400): number {
  if (radiusM <= 0) return 0;
  // Web Mercator: metres per pixel = 156543.03392 * cos(lat) / 2^zoom.
  // The place opens once half the viewport's short side fits inside R, i.e.
  // (referenceSizePx / 2) * mpp <= R  →  solve for zoom.
  const mppAtZoom0 = 156543.03392 * Math.cos((lat * Math.PI) / 180);
  const zoom = Math.log2((mppAtZoom0 * (referenceSizePx / 2)) / radiusM);
  return Math.max(0, Math.round(zoom));
}
