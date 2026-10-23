import { test, expect } from '@playwright/test';
import {
  chain,
  containZoom,
  declutter,
  distanceMetres,
  effectiveMinZoom,
  effectiveRadius,
  isInside,
  isOpen,
  labelPass,
  revealZoom,
  separationZoom,
  viewportRadius,
  visible,
} from '../src/shared/map-core/geometry.js';

// Pure unit tests: no page, no DOM, no Leaflet. These carry the same assertions
// as the API's effective-radius specs, so both apps provably agree on the
// geometry — the CMS draws a circle the player's map has to honour.

const ORIGIN_LAT = 41.9;
const ORIGIN_LNG = 12.5;
const M_PER_DEG_LAT = (6_371_008.8 * Math.PI) / 180;

type P = {
  slug: string;
  name?: string;
  lat: number;
  lng: number;
  hasLocalMap: boolean;
  radius?: number;
  parent?: string | null;
};

/** A place `northMetres` due north of the origin — an exact haversine distance. */
function at(slug: string, northMetres: number, over: Partial<P> = {}): P {
  return {
    slug,
    name: slug.toUpperCase(),
    lat: ORIGIN_LAT + northMetres / M_PER_DEG_LAT,
    lng: ORIGIN_LNG,
    hasLocalMap: true,
    parent: null,
    ...over,
  };
}

const centreAt = (northMetres: number) => ({
  lat: ORIGIN_LAT + northMetres / M_PER_DEG_LAT,
  lng: ORIGIN_LNG,
});

test.describe('effectiveRadius — must match api-campaign-map case for case', () => {
  test('extends to contain a child\'s circle, not merely its centre', () => {
    // The API spec's scenario: 1000 m zone, child 900 m away with radius 300.
    const r = effectiveRadius([
      at('zone', 0, { radius: 1000 }),
      at('child', 900, { radius: 300, parent: 'zone' }),
    ]);
    expect(r.get('zone')).toBeCloseTo(1200, 3);
  });

  test('a pin does not inflate its parent beyond its point', () => {
    const r = effectiveRadius([
      at('zone', 0, { radius: 1000 }),
      at('pin', 1500, { hasLocalMap: false, parent: 'zone' }),
    ]);
    expect(r.get('zone')).toBeCloseTo(1500, 3);
    expect(r.get('pin')).toBe(0);
  });

  test('a cyclic chain terminates', () => {
    const r = effectiveRadius([
      at('a', 0, { radius: 100, parent: 'b' }),
      at('b', 500, { radius: 100, parent: 'a' }),
    ]);
    expect(Number.isFinite(r.get('a'))).toBe(true);
    expect(Number.isFinite(r.get('b'))).toBe(true);
  });

  test('a childless place keeps its authored radius', () => {
    expect(effectiveRadius([at('zone', 0, { radius: 1000 })]).get('zone')).toBe(1000);
  });

  test('defaults to 250 m with no authored radius', () => {
    expect(effectiveRadius([at('zone', 0)]).get('zone')).toBe(250);
  });

  test('recurses over grandchildren', () => {
    const r = effectiveRadius([
      at('region', 0, { radius: 100 }),
      at('vault', 1000, { radius: 100, parent: 'region' }),
      at('room', 1200, { radius: 50, parent: 'vault' }),
    ]);
    expect(r.get('vault')).toBeCloseTo(250, 3);
    expect(r.get('region')).toBeCloseTo(1250, 3);
  });

  test('the containment invariant holds, so a child cannot open before its parent', () => {
    const r = effectiveRadius([
      at('region', 0, { radius: 10 }),
      at('vault', 1000, { radius: 800, parent: 'region' }),
    ]);
    expect(r.get('vault')!).toBeLessThanOrEqual(r.get('region')!);
  });
});

test.describe('distanceMetres', () => {
  test('measures a meridian offset', () => {
    expect(distanceMetres(at('a', 0), at('b', 900))).toBeCloseTo(900, 3);
  });
});

test.describe('viewportRadius', () => {
  test('shrinks as zoom increases', () => {
    const size = { width: 400, height: 800 };
    expect(viewportRadius(size, 14, ORIGIN_LAT)).toBeLessThan(
      viewportRadius(size, 13, ORIGIN_LAT),
    );
  });

  test('uses the shorter side, so orientation does not change the tier', () => {
    expect(viewportRadius({ width: 400, height: 800 }, 13, ORIGIN_LAT)).toBe(
      viewportRadius({ width: 800, height: 400 }, 13, ORIGIN_LAT),
    );
  });

  test('a bigger screen sees more world, so it enters zones later', () => {
    const small = viewportRadius({ width: 320, height: 640 }, 13, ORIGIN_LAT);
    const big = viewportRadius({ width: 800, height: 1200 }, 13, ORIGIN_LAT);
    expect(big).toBeGreaterThan(small);
  });
});

test.describe('isOpen — zoom only', () => {
  const places = [at('zone', 0, { radius: 1000 }), at('kid', 100, { parent: 'zone' })];
  const radii = effectiveRadius(places);
  const zone = places[0];

  test('opens once the viewport fits inside the radius', () => {
    expect(isOpen(zone, 900, radii, places)).toBe(true);
    expect(isOpen(zone, 1100, radii, places)).toBe(false);
  });

  test('ignores where the centre is', () => {
    // Same vr, wildly different centres — isOpen takes no centre at all, which
    // is the point: children render at a zoom whether or not you look at them.
    expect(isOpen(zone, 900, radii, places)).toBe(true);
  });

  test('a place with no children never opens', () => {
    const lonely = [at('zone', 0, { radius: 1000 })];
    expect(isOpen(lonely[0], 1, effectiveRadius(lonely), lonely)).toBe(false);
  });

  test('a pin never opens, however far you zoom in', () => {
    const withPin = [
      at('pin', 0, { hasLocalMap: false }),
      at('kid', 10, { parent: 'pin' }),
    ];
    expect(isOpen(withPin[0], 0.001, effectiveRadius(withPin), withPin)).toBe(false);
  });
});

test.describe('isInside — position only', () => {
  const places = [at('zone', 0, { radius: 1000 }), at('kid', 100, { parent: 'zone' })];
  const radii = effectiveRadius(places);
  const zone = places[0];

  test('is true inside the circle and false outside it', () => {
    expect(isInside(zone, centreAt(500), radii)).toBe(true);
    expect(isInside(zone, centreAt(1500), radii)).toBe(false);
  });

  test('takes no zoom — the same centre answers the same at any zoom', () => {
    // isInside's signature has no vr: that is the assertion.
    expect(isInside(zone, centreAt(500), radii)).toBe(true);
  });

  test('a pin is never inside anything, having no circle', () => {
    const pins = [at('pin', 0, { hasLocalMap: false, radius: 900 })];
    expect(isInside(pins[0], centreAt(0), effectiveRadius(pins))).toBe(false);
  });
});

test.describe('visible', () => {
  const places = [
    at('region', 0, { radius: 5000 }),
    at('vault', 1000, { radius: 300, parent: 'region' }),
    at('room', 1050, { radius: 50, parent: 'vault' }),
  ];
  const radii = effectiveRadius(places);
  const slugs = (vr: number) => visible(places, vr, radii).map((p) => p.slug).sort();

  test('shows only the top tier when nothing is open', () => {
    expect(slugs(9000)).toEqual(['region']);
  });

  test('hides an open place\'s own marker — its children take its place', () => {
    const out = slugs(1000);
    expect(out).not.toContain('region');
    expect(out).toContain('vault');
  });

  test('does not show a grandchild until its parent is open too', () => {
    // region open, vault not: room's ancestor chain is not all open.
    expect(slugs(1000)).not.toContain('room');
  });

  test('shows the deepest tier once every ancestor is open', () => {
    expect(slugs(100)).toEqual(['room']);
  });
});

test.describe('chain — the breadcrumb', () => {
  const places = [
    at('region', 0, { radius: 5000 }),
    at('vault', 1000, { radius: 300, parent: 'region' }),
    at('room', 1050, { radius: 50, parent: 'vault' }),
  ];
  const radii = effectiveRadius(places);

  test('names the entered chain, root first', () => {
    const out = chain(places, centreAt(1000), 250, radii).map((p) => p.slug);
    expect(out).toEqual(['region', 'vault']);
  });

  test('never names an unopened tier', () => {
    // Centred over the room but zoomed far out: only zone markers render, so the
    // breadcrumb must not claim we are in the vault or the room.
    expect(chain(places, centreAt(1050), 9000, radii)).toEqual([]);
  });

  test('drops the deeper entry when the centre leaves it', () => {
    const inVault = chain(places, centreAt(1000), 250, radii).map((p) => p.slug);
    const outOfVault = chain(places, centreAt(3000), 250, radii).map((p) => p.slug);
    expect(inVault).toContain('vault');
    expect(outOfVault).toEqual(['region']);
  });

  test('is empty when the centre is inside no open place', () => {
    expect(chain(places, centreAt(50_000), 250, radii)).toEqual([]);
  });

  test('overlapping zones resolve to the smaller radius', () => {
    // Two zones both containing the centre; the tighter one claims it.
    const overlapping = [
      at('big', 0, { radius: 8000 }),
      at('bigkid', 10, { parent: 'big' }),
      at('small', 100, { radius: 2000 }),
      at('smallkid', 110, { parent: 'small' }),
    ];
    const r = effectiveRadius(overlapping);
    const out = chain(overlapping, centreAt(100), 1000, r).map((p) => p.slug);
    expect(out[out.length - 1]).toBe('small');
  });
});

test.describe('containZoom / revealZoom — the derived zooms', () => {
  const viewportPx = { width: 400, height: 800 };
  // A wide range so clamping never masks the closed-form value.
  const zoomRange = { minZoom: 3, maxZoom: 20 };

  const places = [
    at('region', 0, { radius: 5000 }),
    at('vault', 1000, { radius: 300, parent: 'region' }),
    at('room', 1050, { radius: 50, parent: 'vault' }),
  ];
  const radii = effectiveRadius(places);
  const [region, vault, room] = places;

  const vrAt = (zoom: number, lat: number) => viewportRadius(viewportPx, zoom, lat);

  test('containZoom opens the place at its zoom and not one step further out', () => {
    const z = containZoom(vault, radii, viewportPx, zoomRange);
    expect(isOpen(vault, vrAt(z, vault.lat), radii, places)).toBe(true);
    // One integer zoom step further OUT: the viewport is now larger than the
    // circle, so the place is no longer APERTA.
    expect(isOpen(vault, vrAt(z - 1, vault.lat), radii, places)).toBe(false);
  });

  test('a larger effective radius contains at a lower zoom', () => {
    // region (R = 5000+) is far bigger than room (R = 50); the bigger circle
    // fits the screen sooner, i.e. at the lower zoom number.
    const zBig = containZoom(region, radii, viewportPx, zoomRange);
    const zSmall = containZoom(room, radii, viewportPx, zoomRange);
    expect(zBig).toBeLessThan(zSmall);
  });

  test('revealZoom renders a deep leaf: ancestors open, the leaf closed', () => {
    const z = revealZoom(room, places, radii, viewportPx, zoomRange);
    const vr = vrAt(z, room.lat);
    const shown = visible(places, vr, radii).map((p) => p.slug);
    expect(shown).toContain('room');
    // Its ancestors are APERTA (that is why its marker renders) and it is not.
    expect(isOpen(region, vr, radii, places)).toBe(true);
    expect(isOpen(vault, vr, radii, places)).toBe(true);
    expect(isOpen(room, vr, radii, places)).toBe(false);
  });

  test('revealZoom clamps to the campaign range', () => {
    const tight = { minZoom: 3, maxZoom: 5 };
    const z = revealZoom(room, places, radii, viewportPx, tight);
    expect(z).toBeGreaterThanOrEqual(tight.minZoom);
    expect(z).toBeLessThanOrEqual(tight.maxZoom);
  });
});

// --- Declutter: projected-pixel items, no geography needed -------------------

type Item = { slug: string; type: string; name: string; radius: number; x: number; y: number };

const item = (slug: string, type: string, x: number, y = 0, over: Partial<Item> = {}): Item => ({
  slug,
  type,
  name: slug,
  radius: 0,
  x,
  y,
  ...over,
});

test.describe('declutter — priority', () => {
  test('a settlement absorbs an overlapping poi, whatever the input order', () => {
    for (const items of [
      [item('poi', 'poi', 0), item('town', 'settlement', 10)],
      [item('town', 'settlement', 10), item('poi', 'poi', 0)],
    ]) {
      const out = declutter(items);
      expect([...out.placed]).toEqual(['town']);
      expect(out.absorbedBy.get('poi')).toBe('town');
      expect(out.groups.get('town')).toEqual(['poi']);
    }
  });

  test('follows the full type ladder', () => {
    const types = ['room', 'building', 'poi', 'landmark', 'vault', 'settlement', 'region'];
    const out = declutter(types.map((t, i) => item(t, t, i)));
    expect([...out.placed]).toEqual(['region']);
    // Equal ranks fall through to the name: landmark < poi, settlement < vault.
    expect(out.groups.get('region')).toEqual(['settlement', 'vault', 'landmark', 'poi', 'building', 'room']);
  });

  test('ties go to the larger effective radius', () => {
    const out = declutter([
      item('small', 'vault', 0, 0, { radius: 100 }),
      item('big', 'settlement', 5, 0, { radius: 900 }),
    ]);
    expect([...out.placed]).toEqual(['big']);
  });

  test('equal rank and radius go to the first name, every time', () => {
    const items = [
      item('b', 'landmark', 0, 0, { name: 'Zeta' }),
      item('a', 'landmark', 5, 0, { name: 'Alfa' }),
    ];
    for (let i = 0; i < 3; i++) expect([...declutter(items).placed]).toEqual(['a']);
    expect([...declutter([...items].reverse()).placed]).toEqual(['a']);
  });

  test('the focused place wins over a higher-priority neighbour', () => {
    const out = declutter([item('town', 'settlement', 0), item('poi', 'poi', 5)], { focused: 'poi' });
    expect([...out.placed]).toEqual(['poi']);
    expect(out.absorbedBy.get('town')).toBe('poi');
  });

  test('absorbed places take no space: in a chain A–B–C, A and C both place', () => {
    // A–B and B–C overlap (20 < 30), A–C do not (40 ≥ 30).
    const out = declutter([item('a', 'region', 0), item('b', 'settlement', 20), item('c', 'poi', 40)]);
    expect([...out.placed].sort()).toEqual(['a', 'c']);
    expect(out.absorbedBy.get('b')).toBe('a');
  });

  test('icons a box-plus-pad apart do not collide', () => {
    const out = declutter([item('a', 'poi', 0), item('b', 'poi', 30)]);
    expect(out.placed.size).toBe(2);
    expect(out.groups.size).toBe(0);
  });

  test('is unchanged by a pan — a uniform translation of every point', () => {
    const items = [item('a', 'region', 0), item('b', 'settlement', 20), item('c', 'poi', 40, 10)];
    const shifted = items.map((i) => ({ ...i, x: i.x + 777, y: i.y - 333 }));
    const a = declutter(items);
    const b = declutter(shifted);
    expect([...b.placed]).toEqual([...a.placed]);
    expect([...b.absorbedBy]).toEqual([...a.absorbedBy]);
  });
});

test.describe('labelPass', () => {
  const size = (w: number, h = 12) => ({ w, h });

  test('a lower-priority label yields to a higher-priority one', () => {
    // Icons 40 px apart don't overlap; 60 px-wide labels do.
    const items = [item('town', 'settlement', 0), item('poi', 'poi', 40)];
    const hidden = labelPass(items, new Map([['town', size(60)], ['poi', size(60)]]), ['town', 'poi']);
    expect([...hidden]).toEqual(['poi']);
  });

  test('a label that would cover another icon is hidden', () => {
    // The poi's icon sits right under the town's icon, where its label goes.
    const items = [item('town', 'settlement', 0, 0), item('poi', 'poi', 0, 36)];
    const hidden = labelPass(items, new Map([['town', size(40)], ['poi', size(10)]]), ['town', 'poi']);
    expect(hidden.has('town')).toBe(true);
  });

  test('distant labels all show', () => {
    const items = [item('a', 'poi', 0), item('b', 'poi', 200)];
    expect(labelPass(items, new Map([['a', size(60)], ['b', size(60)]]), ['a', 'b']).size).toBe(0);
  });

  test('an unmeasured label stays shown and blocks nothing', () => {
    const items = [item('a', 'poi', 0), item('b', 'poi', 40)];
    const hidden = labelPass(items, new Map([['b', size(60)]]), ['a', 'b']);
    expect(hidden.size).toBe(0);
  });
});

test.describe('separationZoom', () => {
  const range = { minZoom: 3, maxZoom: 18 };

  test('targets the least zoom at which the closest pair stops colliding', () => {
    // 10 px apart at z10: 20 at z11, 40 at z12 ≥ 30 → z12.
    const z = separationZoom([{ x: 0, y: 0 }, { x: 10, y: 0 }], 10, range);
    expect(z).toBe(12);
    const atZ = (zoom: number) => 10 * 2 ** (zoom - 10);
    expect(atZ(z)).toBeGreaterThanOrEqual(30);
    expect(atZ(z - 1)).toBeLessThan(30);
  });

  test('uses the Chebyshev distance of the closest pair in the group', () => {
    const pts = [{ x: 0, y: 0 }, { x: 3, y: 15 }, { x: 100, y: 100 }];
    // closest pair: max(3, 15) = 15 → one step to 30.
    expect(separationZoom(pts, 8, range)).toBe(9);
  });

  test('always moves in by at least one level', () => {
    expect(separationZoom([{ x: 0, y: 0 }, { x: 29.9, y: 0 }], 7, range)).toBe(8);
  });

  test('identical coordinates go to the maximum zoom', () => {
    expect(separationZoom([{ x: 5, y: 5 }, { x: 5, y: 5 }], 6, range)).toBe(18);
  });

  test('clamps to the maximum zoom', () => {
    expect(separationZoom([{ x: 0, y: 0 }, { x: 0.01, y: 0 }], 15, range)).toBe(18);
  });
});

test.describe('effectiveMinZoom', () => {
  test('raises the config floor to the bounds zoom', () => {
    expect(effectiveMinZoom(3, 18, 7)).toBe(7);
  });

  test('keeps the config floor when the bounds fit further out', () => {
    expect(effectiveMinZoom(8, 12, 5)).toBe(8);
  });

  test('never exceeds the configured maximum', () => {
    expect(effectiveMinZoom(3, 10, 14)).toBe(10);
  });

  test('ignores a non-finite bounds zoom', () => {
    expect(effectiveMinZoom(3, 18, Infinity)).toBe(3);
    expect(effectiveMinZoom(3, 18, NaN)).toBe(3);
  });
});
