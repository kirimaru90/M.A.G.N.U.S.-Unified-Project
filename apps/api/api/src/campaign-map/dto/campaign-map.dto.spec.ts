import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PutCampaignMapDto, placeTreeErrors } from './campaign-map.dto';

const CONFIG = {
  startLat: 41.9,
  startLng: 12.5,
  startZoom: 6,
  minZoom: 3,
  maxZoom: 18,
  bounds: { south: 35, west: 6, north: 48, east: 19 },
};

function place(over: Record<string, unknown> & { slug: string }) {
  return {
    name: over.slug,
    type: 'region',
    lat: 41.9,
    lng: 12.5,
    hasLocalMap: true,
    isPublic: true,
    parent: null,
    ...over,
  };
}

/** Every failing constraint name across the whole nested tree. */
async function constraintsOf(payload: unknown): Promise<string[]> {
  const dto = plainToInstance(PutCampaignMapDto, payload);
  const errors = await validate(dto, { whitelist: true });
  const names: string[] = [];
  const walk = (list: typeof errors) => {
    for (const e of list) {
      if (e.constraints) names.push(...Object.keys(e.constraints));
      if (e.children?.length) walk(e.children);
    }
  };
  walk(errors);
  return names;
}

describe('placeTreeErrors', () => {
  it('accepts a well-formed tree', () => {
    expect(
      placeTreeErrors([
        place({ slug: 'region' }),
        place({ slug: 'vault', parent: 'region' }),
        place({ slug: 'pin', parent: 'vault', hasLocalMap: false }),
      ] as never),
    ).toEqual([]);
  });

  it('reports a duplicate slug once', () => {
    const errors = placeTreeErrors([
      place({ slug: 'a' }),
      place({ slug: 'a' }),
    ] as never);
    expect(errors).toEqual(['duplicate slug "a"']);
  });

  it('reports a parent naming no place in the payload', () => {
    expect(
      placeTreeErrors([place({ slug: 'a', parent: 'ghost' })] as never),
    ).toEqual(['place "a" names an unknown parent "ghost"']);
  });

  it('reports a parent that cannot contain anything', () => {
    const errors = placeTreeErrors([
      place({ slug: 'pin', hasLocalMap: false }),
      place({ slug: 'a', parent: 'pin' }),
    ] as never);
    expect(errors).toEqual([
      'place "a" names parent "pin", which has no local map',
    ]);
  });

  it('reports a two-place cycle', () => {
    const errors = placeTreeErrors([
      place({ slug: 'a', parent: 'b' }),
      place({ slug: 'b', parent: 'a' }),
    ] as never);
    expect(errors).toContain('place "a" is in a parent cycle');
    expect(errors).toContain('place "b" is in a parent cycle');
  });

  it('reports a longer cycle and terminates', () => {
    const errors = placeTreeErrors([
      place({ slug: 'a', parent: 'c' }),
      place({ slug: 'b', parent: 'a' }),
      place({ slug: 'c', parent: 'b' }),
    ] as never);
    expect(errors).toContain('place "a" is in a parent cycle');
  });

  it('does not call a self-parent anything but a cycle', () => {
    const errors = placeTreeErrors([
      place({ slug: 'a', parent: 'a' }),
    ] as never);
    expect(errors).toEqual(['place "a" is in a parent cycle']);
  });

  it('ignores a non-array value', () => {
    expect(placeTreeErrors(undefined)).toEqual([]);
    expect(placeTreeErrors('nope')).toEqual([]);
  });
});

describe('PutCampaignMapDto', () => {
  it('accepts a valid payload', async () => {
    expect(
      await constraintsOf({
        config: CONFIG,
        places: [place({ slug: 'a', radius: 500 })],
      }),
    ).toEqual([]);
  });

  it('accepts an empty places array', async () => {
    expect(await constraintsOf({ config: CONFIG, places: [] })).toEqual([]);
  });

  it('rejects minZoom above maxZoom', async () => {
    const names = await constraintsOf({
      config: { ...CONFIG, minZoom: 19, maxZoom: 18 },
      places: [],
    });
    expect(names).toContain('minZoomNotAboveMaxZoom');
  });

  it('accepts minZoom equal to maxZoom', async () => {
    const names = await constraintsOf({
      config: { ...CONFIG, minZoom: 10, maxZoom: 10 },
      places: [],
    });
    expect(names).not.toContain('minZoomNotAboveMaxZoom');
  });

  it('rejects a radius on a place with no local map', async () => {
    const names = await constraintsOf({
      config: CONFIG,
      places: [place({ slug: 'pin', hasLocalMap: false, radius: 100 })],
    });
    expect(names).toContain('radiusOnlyWithLocalMap');
  });

  it('allows a pin with no radius', async () => {
    const names = await constraintsOf({
      config: CONFIG,
      places: [place({ slug: 'pin', hasLocalMap: false })],
    });
    expect(names).toEqual([]);
  });

  it('rejects a type outside the enum', async () => {
    const names = await constraintsOf({
      config: CONFIG,
      places: [place({ slug: 'a', type: 'spaceship' })],
    });
    expect(names).toContain('isIn');
  });

  it('rejects an out-of-range latitude', async () => {
    const names = await constraintsOf({
      config: CONFIG,
      places: [place({ slug: 'a', lat: 120 })],
    });
    expect(names).toContain('isLatitude');
  });

  it('rejects an out-of-range longitude', async () => {
    const names = await constraintsOf({
      config: CONFIG,
      places: [place({ slug: 'a', lng: 200 })],
    });
    expect(names).toContain('isLongitude');
  });

  it('rejects a negative radius', async () => {
    const names = await constraintsOf({
      config: CONFIG,
      places: [place({ slug: 'a', radius: -5 })],
    });
    expect(names).toContain('isPositive');
  });

  it('surfaces the tree rules through the DTO', async () => {
    const names = await constraintsOf({
      config: CONFIG,
      places: [place({ slug: 'a', parent: 'ghost' })],
    });
    expect(names).toContain('validPlaceTree');
  });

  it('rejects a blank slug', async () => {
    const names = await constraintsOf({
      config: CONFIG,
      places: [place({ slug: '' })],
    });
    expect(names).toContain('isNotEmpty');
  });
});
