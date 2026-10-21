import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCodexEntryDto, UpdateCodexEntryDto } from './codex-entry.dto';
import {
  CreatePlayerCodexEntryDto,
  UpdatePlayerCodexEntryDto,
} from './player-codex.dto';

type Ctor = new () => object;

/** Every failing constraint name, top level only (these DTOs are flat). */
async function constraintsOf(cls: Ctor, payload: unknown): Promise<string[]> {
  const errors = await validate(plainToInstance(cls, payload));
  return errors.flatMap((e) => Object.keys(e.constraints ?? {}));
}

describe('codex DTOs', () => {
  it.each([CreateCodexEntryDto, CreatePlayerCodexEntryDto])(
    '%p accepts a minimal valid body',
    async (cls) => {
      expect(
        await constraintsOf(cls, { type: 'luogo', name: 'Vault 111' }),
      ).toEqual([]);
    },
  );

  it.each([CreateCodexEntryDto, CreatePlayerCodexEntryDto])(
    '%p rejects a blank name, an unknown type and a non-http image',
    async (cls) => {
      expect(
        await constraintsOf(cls, { type: 'luogo', name: '   ' }),
      ).toContain('matches');
      expect(
        await constraintsOf(cls, { type: 'oggetto', name: 'X' }),
      ).toContain('isIn');
      expect(
        await constraintsOf(cls, {
          type: 'luogo',
          name: 'X',
          imageUrl: 'javascript:alert(1)',
        }),
      ).toContain('isUrl');
      expect(
        await constraintsOf(cls, {
          type: 'luogo',
          name: 'X',
          imageUrl: 'ftp://img.example.com/c.png',
        }),
      ).toContain('isUrl');
      expect(
        await constraintsOf(cls, {
          type: 'luogo',
          name: 'X',
          imageUrl: 'https://img.example.com/c.png',
        }),
      ).toEqual([]);
    },
  );

  it.each([UpdateCodexEntryDto, UpdatePlayerCodexEntryDto])(
    '%p accepts an empty patch and null clears',
    async (cls) => {
      expect(await constraintsOf(cls, {})).toEqual([]);
      expect(
        await constraintsOf(cls, { imageUrl: null, mapPlaceSlug: null }),
      ).toEqual([]);
      expect(await constraintsOf(cls, { mapPlaceSlug: '' })).toContain(
        'isNotEmpty',
      );
      expect(await constraintsOf(cls, { isPublic: 'yes' })).toContain(
        'isBoolean',
      );
    },
  );

  it('admin bodies validate visibleToCharacterIds as unique Mongo ids', async () => {
    expect(
      await constraintsOf(UpdateCodexEntryDto, {
        visibleToCharacterIds: ['nope'],
      }),
    ).toContain('isMongoId');
    const id = '65f000000000000000000001';
    expect(
      await constraintsOf(UpdateCodexEntryDto, {
        visibleToCharacterIds: [id, id],
      }),
    ).toContain('arrayUnique');
  });
});
