import { distanceMetres, effectiveRadius } from './campaign-map.service';

const ORIGIN_LAT = 41.9;
const ORIGIN_LNG = 12.5;

/** Metres per degree of latitude along a meridian, for the service's earth radius. */
const M_PER_DEG_LAT = (6_371_008.8 * Math.PI) / 180;

type P = {
  slug: string;
  lat: number;
  lng: number;
  hasLocalMap: boolean;
  radius?: number;
  parent?: string | null;
};

/** A place `northMetres` due north of the origin — an exact haversine distance. */
function at(
  slug: string,
  northMetres: number,
  over: Partial<P> = {},
): P {
  return {
    slug,
    lat: ORIGIN_LAT + northMetres / M_PER_DEG_LAT,
    lng: ORIGIN_LNG,
    hasLocalMap: true,
    parent: null,
    ...over,
  };
}

describe('distanceMetres', () => {
  it('measures a meridian offset', () => {
    expect(distanceMetres(at('a', 0), at('b', 900))).toBeCloseTo(900, 3);
  });
});

describe('effectiveRadius', () => {
  it('returns the authored radius for a childless place', () => {
    const r = effectiveRadius([at('zone', 0, { radius: 1000 })]);
    expect(r.get('zone')).toBe(1000);
  });

  it('defaults a childless place with no authored radius to 250 m', () => {
    const r = effectiveRadius([at('zone', 0)]);
    expect(r.get('zone')).toBe(250);
  });

  it("extends to contain a child's circle, not merely its centre", () => {
    const r = effectiveRadius([
      at('zone', 0, { radius: 1000 }),
      at('child', 900, { radius: 300, parent: 'zone' }),
    ]);
    // 900 away + the child's own 300 = 1200; containing the centre (900) would
    // leave the child poking 200 m out of its parent.
    expect(r.get('zone')).toBeCloseTo(1200, 3);
  });

  it('does not shrink below the authored radius', () => {
    const r = effectiveRadius([
      at('zone', 0, { radius: 1000 }),
      at('child', 100, { radius: 50, parent: 'zone' }),
    ]);
    expect(r.get('zone')).toBe(1000);
  });

  it('lets a pin contribute its distance only, with no circle of its own', () => {
    const r = effectiveRadius([
      at('zone', 0, { radius: 1000 }),
      at('pin', 1500, { hasLocalMap: false, parent: 'zone' }),
    ]);
    expect(r.get('zone')).toBeCloseTo(1500, 3);
    expect(r.get('pin')).toBe(0);
  });

  it('gives a pin R = 0 even with an authored radius', () => {
    const r = effectiveRadius([
      at('pin', 0, { hasLocalMap: false, radius: 900 }),
    ]);
    expect(r.get('pin')).toBe(0);
  });

  it('recurses over grandchildren', () => {
    const r = effectiveRadius([
      at('region', 0, { radius: 100 }),
      at('vault', 1000, { radius: 100, parent: 'region' }),
      at('room', 1200, { radius: 50, parent: 'vault' }),
    ]);
    // vault: max(100, 200 + 50) = 250; region: max(100, 1000 + 250) = 1250.
    expect(r.get('vault')).toBeCloseTo(250, 3);
    expect(r.get('region')).toBeCloseTo(1250, 3);
  });

  it('makes the containment invariant hold: R(child) <= R(parent)', () => {
    const r = effectiveRadius([
      at('region', 0, { radius: 100 }),
      at('vault', 1000, { radius: 800, parent: 'region' }),
    ]);
    expect(r.get('vault')!).toBeLessThanOrEqual(r.get('region')!);
  });

  it('terminates on a cyclic parent chain', () => {
    const places: P[] = [
      at('a', 0, { radius: 100, parent: 'b' }),
      at('b', 500, { radius: 100, parent: 'a' }),
    ];
    // The assertion that matters is that this returns at all.
    const r = effectiveRadius(places);
    expect(Number.isFinite(r.get('a')!)).toBe(true);
    expect(Number.isFinite(r.get('b')!)).toBe(true);
  });

  it('ignores a parent that names no place in the set', () => {
    const r = effectiveRadius([at('orphan', 0, { radius: 300, parent: 'gone' })]);
    expect(r.get('orphan')).toBe(300);
  });
});
