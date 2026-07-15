import { IT_COLLATION, parseOrderBy } from './order-by';

describe('parseOrderBy', () => {
  it('returns an ascending sort spec for a whitelisted field', () => {
    expect(parseOrderBy('name', ['name'])).toEqual({ name: 1 });
  });

  it('trims surrounding whitespace before matching the whitelist', () => {
    expect(parseOrderBy('  name  ', ['name'])).toEqual({ name: 1 });
  });

  it('returns null for an unrecognised field (lenient, no throw)', () => {
    expect(parseOrderBy('bogus', ['name'])).toBeNull();
  });

  it('returns null when the value is absent or empty', () => {
    expect(parseOrderBy(undefined, ['name'])).toBeNull();
    expect(parseOrderBy(null, ['name'])).toBeNull();
    expect(parseOrderBy('', ['name'])).toBeNull();
    expect(parseOrderBy('   ', ['name'])).toBeNull();
  });

  it('only accepts fields present in the allow-list', () => {
    // `slug` is a real field but not whitelisted here — must fall back to null.
    expect(parseOrderBy('slug', ['name'])).toBeNull();
    expect(parseOrderBy('slug', ['name', 'slug'])).toEqual({ slug: 1 });
  });

  it('exposes a case- and accent-insensitive Italian collation', () => {
    expect(IT_COLLATION).toEqual({ locale: 'it', strength: 1 });
  });
});
