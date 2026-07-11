import { buildCorsOptions } from './cors';

describe('buildCorsOptions', () => {
  it('disables cross-origin (origin: false) when the allow-list is empty', () => {
    const opts = buildCorsOptions([]);
    expect(opts.origin).toBe(false);
    expect(opts.credentials).toBe(true);
  });

  it('uses the provided origins verbatim when the allow-list is non-empty', () => {
    const origins = ['https://a.example', 'https://b.example'];
    const opts = buildCorsOptions(origins);
    expect(opts.origin).toEqual(origins);
    expect(opts.credentials).toBe(true);
  });

  it('never emits a permissive wildcard for an empty list', () => {
    expect(buildCorsOptions([]).origin).not.toBe('*');
  });
});
