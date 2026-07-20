import { describe, it, expect } from 'vitest';
import { diffTalentsImport } from './talents-catalog-import-diff';

describe('diffTalentsImport', () => {
  it('adds only genuinely new slugs', () => {
    const result = diffTalentsImport(
      [{ slug: 'gun-fu', name: 'Gun Fu' }],
      [
        { slug: 'gun-fu', name: 'Gun Fu 2' },
        { slug: 'iron-fist', name: 'Iron Fist' },
      ],
    );

    expect(result.addOps).toEqual([
      { action: 'add', slug: 'iron-fist', entry: { name: 'Iron Fist', description: undefined, specialRequirement: undefined } },
    ]);
    expect(result.skipped).toEqual([{ slug: 'gun-fu', reason: 'already_in_catalog' }]);
  });

  it('skips a slug duplicated within the file, keeping the first occurrence', () => {
    const result = diffTalentsImport(
      [],
      [
        { slug: 'iron-fist', name: 'Iron Fist' },
        { slug: 'iron-fist', name: 'Iron Fist (2nd)' },
      ],
    );

    expect(result.addOps).toEqual([
      { action: 'add', slug: 'iron-fist', entry: { name: 'Iron Fist', description: undefined, specialRequirement: undefined } },
    ]);
    expect(result.skipped).toEqual([{ slug: 'iron-fist', reason: 'duplicate_in_file' }]);
  });

  it('never produces an update op for an existing slug', () => {
    const result = diffTalentsImport(
      [{ slug: 'gun-fu', name: 'Gun Fu' }],
      [{ slug: 'gun-fu', name: 'Gun Fu Renamed' }],
    );

    expect(result.addOps).toEqual([]);
    expect(result.skipped).toEqual([{ slug: 'gun-fu', reason: 'already_in_catalog' }]);
  });

  it('carries specialRequirement through into the add op', () => {
    const result = diffTalentsImport(
      [],
      [{ slug: 'gun-fu', name: 'Gun Fu', specialRequirement: [0, 0, 0, 0, 0, 3, 0] }],
    );

    expect(result.addOps).toEqual([
      {
        action: 'add',
        slug: 'gun-fu',
        entry: { name: 'Gun Fu', description: undefined, specialRequirement: [0, 0, 0, 0, 0, 3, 0] },
      },
    ]);
  });
});
