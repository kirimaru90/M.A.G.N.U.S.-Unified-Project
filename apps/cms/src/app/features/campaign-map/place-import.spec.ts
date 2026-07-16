import { describe, it, expect } from 'vitest';
import type { MapPlace } from '../../core/campaign-map/campaign-map.types';
import { dedupKey, exportPlaces, mergePlaces, slugify } from './place-import';

function p(over: Partial<MapPlace> & { slug: string; name: string }): MapPlace {
  return {
    type: 'region',
    lat: 41.9,
    lng: 12.5,
    hasLocalMap: true,
    isPublic: true,
    parent: null,
    ...over,
  };
}

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Vault 111')).toBe('vault-111');
  });

  it('strips accents', () => {
    expect(slugify('Città Vecchia')).toBe('citta-vecchia');
  });

  it('collapses runs and trims edges', () => {
    expect(slugify('  --Grande   Zona!!  ')).toBe('grande-zona');
  });

  it('falls back rather than return an empty slug', () => {
    expect(slugify('!!!')).toBe('place');
    expect(slugify('')).toBe('place');
  });
});

describe('dedupKey', () => {
  it('normalises case and whitespace in the name', () => {
    expect(dedupKey({ name: '  ROMA   nord ', lat: 41.9, lng: 12.5 })).toBe(
      dedupKey({ name: 'roma nord', lat: 41.9, lng: 12.5 }),
    );
  });

  it('matches coordinates at 4dp, tolerating float noise', () => {
    expect(dedupKey({ name: 'a', lat: 41.90001, lng: 12.5 })).toBe(
      dedupKey({ name: 'a', lat: 41.90002, lng: 12.5 }),
    );
  });

  it('separates places further apart than the tolerance', () => {
    expect(dedupKey({ name: 'a', lat: 41.9, lng: 12.5 })).not.toBe(
      dedupKey({ name: 'a', lat: 41.91, lng: 12.5 }),
    );
  });
});

describe('mergePlaces', () => {
  it('re-importing an export adds nothing', () => {
    const existing = [
      p({ slug: 'roma', name: 'Roma', radius: 5000 }),
      p({ slug: 'vault', name: 'Vault 111', parent: 'roma', radius: 300 }),
    ];
    const round = JSON.parse(exportPlaces(existing));
    const result = mergePlaces(existing, round);

    expect(result.added).toBe(0);
    expect(result.dup).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.places).toHaveLength(2);
  });

  it('never overwrites a duplicate', () => {
    const existing = [p({ slug: 'roma', name: 'Roma', radius: 5000, desc: 'mine' })];
    const result = mergePlaces(existing, [
      { slug: 'roma', name: 'Roma', lat: 41.9, lng: 12.5, hasLocalMap: true, radius: 999, desc: 'theirs' },
    ]);

    expect(result.dup).toBe(1);
    expect(result.places).toHaveLength(1);
    expect(result.places[0].desc).toBe('mine');
    expect(result.places[0].radius).toBe(5000);
  });

  it('attaches new children to an existing duplicate zone instead of duplicating it', () => {
    // The case the whole design is for: a file with a zone we already have,
    // plus children we do not.
    const existing = [p({ slug: 'roma', name: 'Roma', radius: 5000 })];
    const result = mergePlaces(existing, [
      { slug: 'roma-import', name: 'Roma', lat: 41.9, lng: 12.5, hasLocalMap: true },
      {
        slug: 'colosseo',
        name: 'Colosseo',
        lat: 41.8902,
        lng: 12.4922,
        hasLocalMap: false,
        parent: 'roma-import',
      },
    ]);

    expect(result.added).toBe(1);
    expect(result.dup).toBe(1);
    expect(result.reparented).toBe(0);
    expect(result.places).toHaveLength(2);
    const child = result.places.find((x) => x.name === 'Colosseo')!;
    expect(child.parent).toBe('roma');
  });

  it('lets two incoming places sharing one slug both survive, under distinct slugs', () => {
    // Concatenate two exports and this is what you get. A slug-keyed remap
    // silently drops one of them.
    const result = mergePlaces([], [
      { slug: 'zona', name: 'Zona A', lat: 41.9, lng: 12.5, hasLocalMap: true },
      { slug: 'zona', name: 'Zona B', lat: 42.5, lng: 12.5, hasLocalMap: true },
    ]);

    expect(result.added).toBe(2);
    expect(result.places).toHaveLength(2);
    const slugs = result.places.map((x) => x.slug);
    expect(new Set(slugs).size).toBe(2);
    expect(result.places.map((x) => x.name)).toEqual(['Zona A', 'Zona B']);
  });

  it('resolves a shared incoming slug to the first occurrence', () => {
    const result = mergePlaces([], [
      { slug: 'zona', name: 'Zona A', lat: 41.9, lng: 12.5, hasLocalMap: true },
      { slug: 'zona', name: 'Zona B', lat: 42.5, lng: 12.5, hasLocalMap: true },
      { slug: 'kid', name: 'Figlio', lat: 41.91, lng: 12.5, hasLocalMap: false, parent: 'zona' },
    ]);

    const first = result.places.find((x) => x.name === 'Zona A')!;
    const kid = result.places.find((x) => x.name === 'Figlio')!;
    expect(kid.parent).toBe(first.slug);
  });

  it('does not collide entries that carry no slug', () => {
    const result = mergePlaces([], [
      { name: 'Zona', lat: 41.9, lng: 12.5, hasLocalMap: true },
      { name: 'Zona', lat: 42.5, lng: 12.5, hasLocalMap: true },
    ]);

    expect(result.added).toBe(2);
    expect(new Set(result.places.map((x) => x.slug)).size).toBe(2);
  });

  it('does not collide an incoming slug with an existing one', () => {
    const existing = [p({ slug: 'zona', name: 'Zona Esistente' })];
    const result = mergePlaces(existing, [
      { slug: 'zona', name: 'Zona Nuova', lat: 42.5, lng: 12.5, hasLocalMap: true },
    ]);

    expect(result.added).toBe(1);
    expect(result.places).toHaveLength(2);
    expect(result.places[0].slug).toBe('zona');
    expect(result.places[1].slug).not.toBe('zona');
    expect(result.places[1].name).toBe('Zona Nuova');
  });

  it('detaches a parent that resolves to nothing', () => {
    const result = mergePlaces([], [
      { slug: 'kid', name: 'Figlio', lat: 41.9, lng: 12.5, hasLocalMap: false, parent: 'ghost' },
    ]);

    expect(result.added).toBe(1);
    expect(result.reparented).toBe(1);
    expect(result.places[0].parent).toBeNull();
  });

  it('detaches a parent that names a pin, which cannot contain anything', () => {
    const result = mergePlaces([], [
      { slug: 'pin', name: 'Segnalino', lat: 41.9, lng: 12.5, hasLocalMap: false },
      { slug: 'kid', name: 'Figlio', lat: 41.91, lng: 12.5, hasLocalMap: false, parent: 'pin' },
    ]);

    expect(result.added).toBe(2);
    expect(result.reparented).toBe(1);
    expect(result.places.find((x) => x.slug === 'kid')!.parent).toBeNull();
  });

  it('breaks a malformed cycle', () => {
    const result = mergePlaces([], [
      { slug: 'a', name: 'A', lat: 41.9, lng: 12.5, hasLocalMap: true, parent: 'b' },
      { slug: 'b', name: 'B', lat: 42.5, lng: 12.5, hasLocalMap: true, parent: 'a' },
    ]);

    expect(result.added).toBe(2);
    // Whatever it does, the result must be acyclic and every walk must terminate.
    const bySlug = new Map(result.places.map((x) => [x.slug, x]));
    for (const place of result.places) {
      const seen = new Set<string>([place.slug]);
      let cur = place.parent;
      let steps = 0;
      while (cur && steps++ < 100) {
        expect(seen.has(cur)).toBe(false);
        seen.add(cur);
        cur = bySlug.get(cur)?.parent ?? null;
      }
      expect(steps).toBeLessThan(100);
    }
  });

  it('breaks a self-parent', () => {
    const result = mergePlaces([], [
      { slug: 'a', name: 'A', lat: 41.9, lng: 12.5, hasLocalMap: true, parent: 'a' },
    ]);
    expect(result.places[0].parent).toBeNull();
    expect(result.reparented).toBe(1);
  });

  it('discards entries with no name and counts them', () => {
    const result = mergePlaces([], [
      { slug: 'a', name: '   ', lat: 41.9, lng: 12.5 },
      { slug: 'b', lat: 41.9, lng: 12.5 },
      { name: 'Buona', lat: 41.9, lng: 12.5, hasLocalMap: true },
    ]);

    expect(result.skipped).toBe(2);
    expect(result.added).toBe(1);
    expect(result.places).toHaveLength(1);
  });

  it('discards entries with non-finite or out-of-range coordinates', () => {
    const result = mergePlaces([], [
      { name: 'NaN', lat: Number.NaN, lng: 12.5 },
      { name: 'Infinite', lat: Number.POSITIVE_INFINITY, lng: 12.5 },
      { name: 'String', lat: '41.9', lng: 12.5 },
      { name: 'Missing' },
      { name: 'Off the globe', lat: 120, lng: 12.5 },
      { name: 'Off the globe too', lat: 41.9, lng: 200 },
    ]);

    expect(result.skipped).toBe(6);
    expect(result.added).toBe(0);
    // Never import a NaN pin — it would render nowhere and 400 on save.
    expect(result.places).toEqual([]);
  });

  it('does not let a skipped entry shift another entry\'s fate', () => {
    // The guard against planning by anything but index.
    const result = mergePlaces([], [
      { name: '', lat: 41.9, lng: 12.5 },
      { slug: 'good', name: 'Buona', lat: 41.9, lng: 12.5, hasLocalMap: true },
      { name: 'Figlia', lat: 41.91, lng: 12.5, hasLocalMap: false, parent: 'good' },
    ]);

    expect(result.skipped).toBe(1);
    expect(result.added).toBe(2);
    expect(result.places.find((x) => x.name === 'Figlia')!.parent).toBe('good');
  });

  it('falls back on an unknown type rather than strand the import', () => {
    const result = mergePlaces([], [
      { name: 'Strana', lat: 41.9, lng: 12.5, type: 'spaceship', hasLocalMap: false },
    ]);
    expect(result.added).toBe(1);
    expect(result.places[0].type).toBe('poi');
  });

  it('drops a radius from a pin, which the API would reject', () => {
    const result = mergePlaces([], [
      { name: 'Segnalino', lat: 41.9, lng: 12.5, hasLocalMap: false, radius: 100 },
    ]);
    expect(result.places[0].radius).toBeUndefined();
  });

  it('defaults an absent isPublic to hidden', () => {
    const result = mergePlaces([], [
      { name: 'Senza flag', lat: 41.9, lng: 12.5, hasLocalMap: false },
    ]);
    expect(result.places[0].isPublic).toBe(false);
  });

  it('tolerates a non-array payload', () => {
    const existing = [p({ slug: 'a', name: 'A' })];
    expect(mergePlaces(existing, null).places).toEqual(existing);
    expect(mergePlaces(existing, { nope: true }).added).toBe(0);
    expect(mergePlaces(existing, 'garbage').skipped).toBe(0);
  });

  it('tolerates null entries inside the array', () => {
    const result = mergePlaces([], [null, undefined, { name: 'Buona', lat: 41.9, lng: 12.5 }]);
    expect(result.skipped).toBe(2);
    expect(result.added).toBe(1);
  });
});
