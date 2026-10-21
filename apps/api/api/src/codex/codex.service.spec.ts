/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Types } from 'mongoose';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CodexService } from './codex.service';

const campaignId = new Types.ObjectId().toString();
const A = new Types.ObjectId();
const B = new Types.ObjectId();

function storedEntry(over: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(),
    id: 'e1',
    campaignId: new Types.ObjectId(campaignId),
    type: 'luogo',
    name: 'Diamond City',
    isPublic: true,
    visibleToCharacterIds: [],
    isEditable: true,
    mapPlaceSlug: null,
    createdByCharacterId: null,
    isDeleted: false,
    deletedAt: null,
    deletedByCharacterId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

/** Build a service around jest-mocked entry + character models. */
function makeService(opts: {
  entry?: Record<string, unknown> | null;
  updated?: Record<string, unknown> | null;
  validCharacters?: number;
  character?: Record<string, unknown> | null;
}) {
  const entry = opts.entry === undefined ? storedEntry() : opts.entry;
  const updated = opts.updated === undefined ? entry : opts.updated;
  const entryModel = {
    findOne: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(entry),
    }),
    findOneAndUpdate: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(updated),
    }),
    findOneAndDelete: jest.fn().mockResolvedValue(entry),
    updateOne: jest.fn().mockResolvedValue({ matchedCount: 1 }),
    create: jest.fn().mockImplementation((doc: Record<string, unknown>) =>
      Promise.resolve({
        toObject: () => ({
          ...doc,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      }),
    ),
  };
  const character =
    opts.character === undefined
      ? { _id: A, campaignId: new Types.ObjectId(campaignId) }
      : opts.character;
  const characterModel = {
    countDocuments: jest.fn().mockResolvedValue(opts.validCharacters ?? 0),
    findById: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(character),
    }),
    find: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest
          .fn()
          .mockResolvedValue([{ _id: A, name: 'Alice', isDeleted: false }]),
      }),
    }),
  };
  return {
    service: new CodexService(entryModel as never, characterModel as never),
    entryModel,
    characterModel,
  };
}

describe('CodexService — create defaults', () => {
  it('master entries default to private, unlisted, not editable, no author', async () => {
    const { service, entryModel } = makeService({});
    const out = await service.create(campaignId, {
      type: 'fazione',
      name: "Confraternita d'Acciaio",
    });
    const doc = entryModel.create.mock.calls[0][0];
    expect(doc).toMatchObject({
      isPublic: false,
      isEditable: false,
      visibleToCharacterIds: [],
      createdByCharacterId: null,
      mapPlaceSlug: null,
    });
    expect(out).not.toHaveProperty('_id');
    expect(out).not.toHaveProperty('campaignId');
  });

  it('rejects a character outside the campaign', async () => {
    const { service, entryModel } = makeService({ validCharacters: 0 });
    await expect(
      service.create(campaignId, {
        type: 'luogo',
        name: 'X',
        visibleToCharacterIds: [String(A)],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(entryModel.create).not.toHaveBeenCalled();
  });

  it('player entries are visible to the creator, editable and private', async () => {
    const { service, entryModel } = makeService({});
    const out = await service.createForCharacter(campaignId, String(A), {
      type: 'creatura',
      name: 'Mirelurk',
    });
    const doc = entryModel.create.mock.calls[0][0];
    expect(doc.visibleToCharacterIds.map(String)).toEqual([String(A)]);
    expect(doc.isEditable).toBe(true);
    expect(doc.isPublic).toBe(false);
    expect(String(doc.createdByCharacterId)).toBe(String(A));
    expect(out.isOwn).toBe(true);
  });

  it('a character from another campaign is a 404', async () => {
    const { service } = makeService({
      character: { _id: A, campaignId: new Types.ObjectId() },
    });
    await expect(
      service.createForCharacter(campaignId, String(A), {
        type: 'creatura',
        name: 'Mirelurk',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('CodexService — player write decisions', () => {
  it('404 for an entry the character cannot see', async () => {
    const { service } = makeService({
      entry: storedEntry({ isPublic: false, visibleToCharacterIds: [B] }),
    });
    await expect(
      service.updateForCharacter(
        campaignId,
        String(A),
        'e1',
        { name: 'x' },
        false,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('404 for a deleted entry', async () => {
    const { service } = makeService({
      entry: storedEntry({ isDeleted: true }),
    });
    await expect(
      service.removeForCharacter(campaignId, String(A), 'e1', false),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('404 for a missing entry', async () => {
    const { service } = makeService({ entry: null });
    await expect(
      service.updateForCharacter(campaignId, String(A), 'e1', {}, false),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('403 for a visible but locked entry', async () => {
    const { service, entryModel } = makeService({
      entry: storedEntry({ isEditable: false }),
    });
    await expect(
      service.updateForCharacter(
        campaignId,
        String(A),
        'e1',
        { name: 'x' },
        false,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(entryModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('an admin bypasses the lock', async () => {
    const { service } = makeService({
      entry: storedEntry({ isEditable: false }),
    });
    await expect(
      service.updateForCharacter(
        campaignId,
        String(A),
        'e1',
        { name: 'x' },
        true,
      ),
    ).resolves.not.toBeNull();
  });

  it('returns null (204) when the update hides the entry from the caller', async () => {
    const { service } = makeService({
      entry: storedEntry(),
      updated: storedEntry({ isPublic: false, visibleToCharacterIds: [B] }),
    });
    await expect(
      service.updateForCharacter(
        campaignId,
        String(A),
        'e1',
        { isPublic: false },
        false,
      ),
    ).resolves.toBeNull();
  });

  it('sets only the provided player fields', async () => {
    const { service, entryModel } = makeService({});
    await service.updateForCharacter(
      campaignId,
      String(A),
      'e1',
      { description: 'd', mapPlaceSlug: null },
      false,
    );
    expect(entryModel.findOneAndUpdate.mock.calls[0][1]).toEqual({
      $set: { description: 'd', mapPlaceSlug: null },
    });
  });

  it('soft delete stamps deletedByCharacterId', async () => {
    const { service, entryModel } = makeService({});
    await service.removeForCharacter(campaignId, String(A), 'e1', false);
    const set = entryModel.updateOne.mock.calls[0][1].$set;
    expect(set.isDeleted).toBe(true);
    expect(set.deletedAt).toBeInstanceOf(Date);
    expect(String(set.deletedByCharacterId)).toBe(String(A));
  });
});

describe('CodexService — admin update', () => {
  it('restore clears the delete fields', async () => {
    const { service, entryModel } = makeService({
      entry: storedEntry({
        isDeleted: true,
        deletedAt: new Date(),
        deletedByCharacterId: A,
      }),
    });
    await service.update(campaignId, 'e1', { isDeleted: false });
    expect(entryModel.findOneAndUpdate.mock.calls[0][1].$set).toEqual({
      isDeleted: false,
      deletedAt: null,
      deletedByCharacterId: null,
    });
  });

  it('a master soft delete has no deleting character', async () => {
    const { service, entryModel } = makeService({});
    await service.update(campaignId, 'e1', { isDeleted: true });
    const set = entryModel.findOneAndUpdate.mock.calls[0][1].$set;
    expect(set).toMatchObject({ isDeleted: true, deletedByCharacterId: null });
    expect(set.deletedAt).toBeInstanceOf(Date);
  });

  it('keeps already-listed characters without revalidating them', async () => {
    const { service, characterModel } = makeService({
      entry: storedEntry({ visibleToCharacterIds: [A] }),
    });
    await service.update(campaignId, 'e1', {
      visibleToCharacterIds: [String(A)],
    });
    expect(characterModel.countDocuments).not.toHaveBeenCalled();
  });

  it('404 for an entry outside the campaign', async () => {
    const { service } = makeService({ entry: null });
    await expect(service.update(campaignId, 'e1', {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.get(campaignId, 'e1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('hard delete of a missing entry is a 404', async () => {
    const { service, entryModel } = makeService({});
    entryModel.findOneAndDelete.mockResolvedValue(null);
    await expect(service.remove(campaignId, 'e1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

/** A chainable find() mock: find → sort → collation → lean, or select → lean. */
function chain(result: unknown) {
  const q: Record<string, jest.Mock> = {};
  q.sort = jest.fn().mockReturnValue(q);
  q.collation = jest.fn().mockReturnValue(q);
  q.select = jest.fn().mockReturnValue(q);
  q.lean = jest.fn().mockResolvedValue(result);
  return q;
}

describe('CodexService — reads, export, import', () => {
  it('list sorts by name under the Italian collation and maps every field', async () => {
    const { service, entryModel } = makeService({});
    const q = chain([
      storedEntry({ visibleToCharacterIds: [A], createdByCharacterId: B }),
    ]);
    (entryModel as Record<string, unknown>).find = jest.fn().mockReturnValue(q);
    const [out] = await service.list(campaignId);
    expect(q.sort).toHaveBeenCalledWith({ name: 1 });
    expect(q.collation).toHaveBeenCalledWith({ locale: 'it', strength: 1 });
    expect(out).toMatchObject({
      visibleToCharacterIds: [String(A)],
      createdByCharacterId: String(B),
      secretDescription: null,
      imageUrl: null,
    });
    expect(out).toHaveProperty('createdAt');
    // A resolves; B is absent from the characters read, so it shows as deleted.
    expect(out.characters).toEqual([
      { id: String(A), name: 'Alice', deleted: false },
      { id: String(B), name: '', deleted: true },
    ]);
  });

  it('export drops timestamps but keeps authored fields', async () => {
    const { service, entryModel } = makeService({});
    (entryModel as Record<string, unknown>).find = jest
      .fn()
      .mockReturnValue(chain([storedEntry({ secretDescription: 's' })]));
    const [out] = await service.export(campaignId);
    expect(out).not.toHaveProperty('createdAt');
    expect(out).not.toHaveProperty('campaignId');
    expect(out.secretDescription).toBe('s');
  });

  it('listForCharacter filters in the query and still projects', async () => {
    const { service, entryModel } = makeService({});
    const find = jest.fn().mockReturnValue(
      chain([
        storedEntry({ id: 'ok' }),
        // A drifted query result the projection must still drop.
        storedEntry({ id: 'leak', isPublic: false }),
      ]),
    );
    (entryModel as Record<string, unknown>).find = find;
    const out = await service.listForCharacter(campaignId, String(A));
    expect(out.map((e) => e.id)).toEqual(['ok']);
    expect(find.mock.calls[0][0]).toMatchObject({ isDeleted: { $ne: true } });
  });

  it('import plans against existing entries and campaign characters', async () => {
    const { service, entryModel, characterModel } = makeService({});
    (entryModel as Record<string, unknown>).find = jest
      .fn()
      .mockReturnValue(
        chain([{ id: 'e1', type: 'luogo', name: 'Diamond City' }]),
      );
    (entryModel as Record<string, unknown>).insertMany = jest
      .fn()
      .mockResolvedValue([]);
    (characterModel as Record<string, unknown>).find = jest
      .fn()
      .mockReturnValue(chain([{ _id: A }]));

    const out = await service.import(campaignId, [
      { type: 'luogo', name: 'diamond city' },
      {
        type: 'creatura',
        name: 'Mirelurk',
        visibleToCharacterIds: [String(A), String(B)],
        createdByCharacterId: String(A),
      },
    ]);
    expect(out).toEqual({
      added: 1,
      skipped: [{ index: 0, name: 'diamond city', reason: 'collision' }],
    });
    const [docs] = (entryModel as unknown as { insertMany: jest.Mock })
      .insertMany.mock.calls[0];
    expect(docs[0].visibleToCharacterIds.map(String)).toEqual([String(A)]);
    expect(String(docs[0].createdByCharacterId)).toBe(String(A));
    expect(String(docs[0].campaignId)).toBe(campaignId);
  });

  it('import with nothing to add does not insert', async () => {
    const { service, entryModel, characterModel } = makeService({});
    (entryModel as Record<string, unknown>).find = jest
      .fn()
      .mockReturnValue(chain([]));
    const insertMany = jest.fn();
    (entryModel as Record<string, unknown>).insertMany = insertMany;
    (characterModel as Record<string, unknown>).find = jest
      .fn()
      .mockReturnValue(chain([]));
    await expect(service.import(campaignId, [null])).resolves.toMatchObject({
      added: 0,
    });
    expect(insertMany).not.toHaveBeenCalled();
  });

  it('update 404s when the entry vanishes mid-write', async () => {
    const { service } = makeService({ updated: null });
    await expect(
      service.update(campaignId, 'e1', { name: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
