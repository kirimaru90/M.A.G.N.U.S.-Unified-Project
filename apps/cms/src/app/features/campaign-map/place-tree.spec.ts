import { describe, it, expect } from 'vitest';
import type { MapPlace } from '../../core/campaign-map/campaign-map.types';
import {
  ancestors,
  approxOpenZoom,
  canParent,
  cascaded,
  depth,
  descendants,
  distanceMetres,
  effectiveRadius,
  floorR,
  kids,
  visibleToPlayer,
} from './place-tree';

const ORIGIN_LAT = 41.9;
const ORIGIN_LNG = 12.5;
const M_PER_DEG_LAT = (6_371_008.8 * Math.PI) / 180;

/** A place `northMetres` due north of the origin — an exact haversine distance. */
function at(slug: string, northMetres: number, over: Partial<MapPlace> = {}): MapPlace {
  return {
    slug,
    name: slug,
    type: 'region',
    lat: ORIGIN_LAT + northMetres / M_PER_DEG_LAT,
    lng: ORIGIN_LNG,
    hasLocalMap: true,
    isPublic: true,
    parent: null,
    ...over,
  };
}

describe('distanceMetres', () => {
  it('measures a meridian offset', () => {
    expect(distanceMetres(at('a', 0), at('b', 900))).toBeCloseTo(900, 3);
  });

  it('is zero for a place against itself', () => {
    expect(distanceMetres(at('a', 0), at('a', 0))).toBe(0);
  });
});

describe('kids / descendants / ancestors / depth', () => {
  const places = [
    at('region', 0),
    at('vault', 100, { parent: 'region' }),
    at('room', 200, { parent: 'vault' }),
    at('other', 300),
  ];

  it('lists direct children only', () => {
    expect(kids(places, 'region').map((p) => p.slug)).toEqual(['vault']);
  });

  it('lists the whole subtree depth-first', () => {
    expect(descendants(places, 'region').map((p) => p.slug)).toEqual(['vault', 'room']);
  });

  it('lists ancestors nearest first', () => {
    expect(ancestors(places, 'room').map((p) => p.slug)).toEqual(['vault', 'region']);
  });

  it('gives a root place depth 0', () => {
    expect(depth(places, 'region')).toBe(0);
    expect(depth(places, 'room')).toBe(2);
  });

  it('returns nothing for an unknown slug', () => {
    expect(ancestors(places, 'ghost')).toEqual([]);
    expect(descendants(places, 'ghost')).toEqual([]);
  });

  it('ignores a parent naming no place', () => {
    expect(ancestors([at('a', 0, { parent: 'gone' })], 'a')).toEqual([]);
  });
});

describe('cycle guards', () => {
  // The API rejects cycles, but the CMS holds unsaved edits that can transiently
  // be cyclic — these must terminate, not hang the authoring screen.
  const cyclic = [at('a', 0, { parent: 'b' }), at('b', 500, { parent: 'a' })];

  it('terminates ancestors on a cycle', () => {
    expect(ancestors(cyclic, 'a').map((p) => p.slug)).toEqual(['b']);
  });

  it('terminates descendants on a cycle', () => {
    expect(descendants(cyclic, 'a').map((p) => p.slug)).toEqual(['b']);
  });

  it('terminates effectiveRadius on a cycle', () => {
    const r = effectiveRadius(cyclic);
    expect(Number.isFinite(r.get('a')!)).toBe(true);
    expect(Number.isFinite(r.get('b')!)).toBe(true);
  });

  it('terminates on a self-parent', () => {
    expect(ancestors([at('a', 0, { parent: 'a' })], 'a')).toEqual([]);
  });
});

describe('canParent', () => {
  it('lets a place with an interior contain things', () => {
    expect(canParent(at('a', 0))).toBe(true);
  });

  it('refuses a pin', () => {
    expect(canParent(at('pin', 0, { hasLocalMap: false }))).toBe(false);
  });
});

describe('cascaded and visibleToPlayer', () => {
  const places = [
    at('open', 0),
    at('bunker', 100, { isPublic: false }),
    at('room', 200, { parent: 'bunker', isPublic: true }),
    at('deep', 300, { parent: 'room', isPublic: true }),
    at('secret', 400, { isPublic: false }),
  ];

  it('calls a public place under a hidden ancestor cascaded', () => {
    expect(cascaded(places, 'room')).toBe(true);
    expect(cascaded(places, 'deep')).toBe(true);
  });

  it('does not call a plainly public place cascaded', () => {
    expect(cascaded(places, 'open')).toBe(false);
  });

  it('does not call a hidden place cascaded — it is hidden, not inherited', () => {
    expect(cascaded(places, 'bunker')).toBe(false);
    expect(cascaded(places, 'secret')).toBe(false);
  });

  it('counts only what a player would actually receive', () => {
    // Must agree with the API's projection: hidden places and their whole
    // subtree are absent, however public the children claim to be.
    expect([...visibleToPlayer(places)]).toEqual(['open']);
  });
});

describe('effectiveRadius', () => {
  it('returns the authored radius for a childless place', () => {
    expect(effectiveRadius([at('zone', 0, { radius: 1000 })]).get('zone')).toBe(1000);
  });

  it('defaults to 250 m with no authored radius', () => {
    expect(effectiveRadius([at('zone', 0)]).get('zone')).toBe(250);
  });

  it("extends over a child's circle, not its centre", () => {
    const r = effectiveRadius([
      at('zone', 0, { radius: 1000 }),
      at('child', 900, { radius: 300, parent: 'zone' }),
    ]);
    expect(r.get('zone')).toBeCloseTo(1200, 3);
  });

  it('lets a pin contribute its distance only', () => {
    const r = effectiveRadius([
      at('zone', 0, { radius: 1000 }),
      at('pin', 1500, { hasLocalMap: false, parent: 'zone' }),
    ]);
    expect(r.get('zone')).toBeCloseTo(1500, 3);
    expect(r.get('pin')).toBe(0);
  });

  it('recurses over grandchildren', () => {
    const r = effectiveRadius([
      at('region', 0, { radius: 100 }),
      at('vault', 1000, { radius: 100, parent: 'region' }),
      at('room', 1200, { radius: 50, parent: 'vault' }),
    ]);
    expect(r.get('vault')).toBeCloseTo(250, 3);
    expect(r.get('region')).toBeCloseTo(1250, 3);
  });

  it('keeps the containment invariant R(child) <= R(parent)', () => {
    const r = effectiveRadius([
      at('region', 0, { radius: 100 }),
      at('vault', 1000, { radius: 800, parent: 'region' }),
    ]);
    expect(r.get('vault')!).toBeLessThanOrEqual(r.get('region')!);
  });
});

describe('floorR', () => {
  it('is 0 for a childless place — nothing forces a radius on it', () => {
    expect(floorR([at('zone', 0, { radius: 1000 })]).get('zone')).toBe(0);
  });

  it("is the reach to the far edge of a child's circle", () => {
    const f = floorR([
      at('zone', 0, { radius: 100 }),
      at('child', 900, { radius: 300, parent: 'zone' }),
    ]);
    expect(f.get('zone')).toBeCloseTo(1200, 3);
  });

  it('ignores the authored radius — it is the floor, not the value', () => {
    const f = floorR([
      at('zone', 0, { radius: 99_999 }),
      at('child', 900, { radius: 300, parent: 'zone' }),
    ]);
    expect(f.get('zone')).toBeCloseTo(1200, 3);
  });

  it('is only the distance for a pin child', () => {
    const f = floorR([
      at('zone', 0, { radius: 100 }),
      at('pin', 1500, { hasLocalMap: false, parent: 'zone' }),
    ]);
    expect(f.get('zone')).toBeCloseTo(1500, 3);
  });
});

describe('approxOpenZoom', () => {
  it('gives a bigger zone a lower opening zoom', () => {
    const big = approxOpenZoom(10_000, ORIGIN_LAT);
    const small = approxOpenZoom(250, ORIGIN_LAT);
    expect(big).toBeLessThan(small);
  });

  it('never returns a negative zoom', () => {
    expect(approxOpenZoom(40_000_000, ORIGIN_LAT)).toBeGreaterThanOrEqual(0);
  });

  it('returns 0 for a radius-less pin rather than -Infinity', () => {
    expect(approxOpenZoom(0, ORIGIN_LAT)).toBe(0);
  });
});
