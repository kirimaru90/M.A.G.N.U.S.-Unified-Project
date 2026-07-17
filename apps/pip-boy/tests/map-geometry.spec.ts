import { test, expect } from '@playwright/test';
import {
  chain,
  containZoom,
  distanceMetres,
  effectiveRadius,
  isInside,
  isOpen,
  revealZoom,
  viewportRadius,
  visible,
} from '../src/tabs/map-geometry.js';

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
