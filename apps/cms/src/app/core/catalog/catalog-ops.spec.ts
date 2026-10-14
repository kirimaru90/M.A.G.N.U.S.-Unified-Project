import { describe, it, expect } from 'vitest';
import { catalogEditOps, catalogErrorMessage } from './catalog-ops';

describe('catalogEditOps', () => {
  it('creates with a single add op', () => {
    expect(catalogEditOps(null, 'pesante', { name: 'Pesante' })).toEqual([
      { action: 'add', slug: 'pesante', entry: { name: 'Pesante' } },
    ]);
  });

  it('edits with a single update op when the slug is unchanged', () => {
    expect(catalogEditOps('pesante', 'pesante', { name: 'PESANTE' })).toEqual([
      { action: 'update', slug: 'pesante', entry: { name: 'PESANTE' } },
    ]);
  });

  it('renames then updates the new slug when the slug changes', () => {
    expect(catalogEditOps('lockpick', 'lockpicking', { name: 'Scassinare' })).toEqual([
      { action: 'rename', slug: 'lockpick', rename: 'lockpicking' },
      { action: 'update', slug: 'lockpicking', entry: { name: 'Scassinare' } },
    ]);
  });
});

describe('catalogErrorMessage', () => {
  it('names the conflicting slug on 409', () => {
    expect(catalogErrorMessage({ status: 409 }, { slug: 'automatica' })).toBe(
      'Slug "automatica" già esistente',
    );
  });

  it('falls back to a generic conflict message without a slug', () => {
    expect(catalogErrorMessage({ status: 409 })).toBe('Slug già esistente');
  });

  it('uses the in-use message for a 409 on delete', () => {
    expect(
      catalogErrorMessage(
        { status: 409 },
        { slug: 'ghoul', action: 'delete', inUseMessage: 'Specie in uso da un personaggio' },
      ),
    ).toBe('Specie in uso da un personaggio');
  });

  it('ignores the in-use message for a 409 on anything but delete', () => {
    expect(
      catalogErrorMessage({ status: 409 }, { slug: 'ghoul', action: 'add', inUseMessage: 'in uso' }),
    ).toBe('Slug "ghoul" già esistente');
  });

  it('maps 400 to invalid data', () => {
    expect(catalogErrorMessage({ status: 400 })).toBe('Dati non validi');
  });

  it('maps anything else to an unexpected error', () => {
    expect(catalogErrorMessage({ status: 500 })).toBe('Errore imprevisto');
    expect(catalogErrorMessage(null)).toBe('Errore imprevisto');
  });
});
