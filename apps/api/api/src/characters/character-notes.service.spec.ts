import { Types } from 'mongoose';
import { NotFoundException } from '@nestjs/common';
import { CharacterNotesService } from './character-notes.service';

/** Build a service around jest-mocked note + character models. */
function makeService(opts: {
  notes?: unknown[];
  createReturn?: Record<string, unknown>;
  updateReturn?: Record<string, unknown> | null;
  deleteReturn?: Record<string, unknown> | null;
  character?: Record<string, unknown> | null;
}) {
  const noteModel = {
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(opts.notes ?? []),
      }),
    }),
    create: jest
      .fn()
      .mockResolvedValue({ toObject: () => opts.createReturn ?? {} }),
    findOneAndUpdate: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(opts.updateReturn ?? null),
    }),
    findOneAndDelete: jest.fn().mockResolvedValue(opts.deleteReturn ?? null),
  };
  const characterModel = {
    findById: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(
        opts.character === undefined
          ? { campaignId: new Types.ObjectId(), userId: new Types.ObjectId() }
          : opts.character,
      ),
    }),
  };
  return {
    service: new CharacterNotesService(
      noteModel as never,
      characterModel as never,
    ),
    noteModel,
    characterModel,
  };
}

const charId = new Types.ObjectId().toString();

describe('CharacterNotesService', () => {
  it('list maps notes to the public shape and never leaks _id', async () => {
    const { service } = makeService({
      notes: [
        {
          _id: new Types.ObjectId(),
          id: 'n1',
          title: 'T',
          note: 'B',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
    const out = await service.list(charId);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      id: 'n1',
      title: 'T',
      note: 'B',
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
    expect(out[0]).not.toHaveProperty('_id');
  });

  it('create mints an id and copies scoping from the parent character', async () => {
    const campaignId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const { service, noteModel } = makeService({
      character: { campaignId, userId },
      createReturn: {
        id: 'minted',
        title: 'T',
        note: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const out = await service.create(campaignId.toString(), charId, {
      title: 'T',
    });
    expect(out.id).toBe('minted');
    const arg = noteModel.create.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.id).toBeTruthy();
    expect(arg.campaignId).toBe(campaignId);
    expect(arg.userId).toBe(userId);
    expect(arg.note).toBe('');
  });

  it('update returns the merged note', async () => {
    const { service } = makeService({
      updateReturn: {
        id: 'n1',
        title: 'T',
        note: 'merged',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const out = await service.update(charId, 'n1', { note: 'merged' });
    expect(out.note).toBe('merged');
  });

  it('update 404s when the note is not under this character', async () => {
    const { service } = makeService({ updateReturn: null });
    await expect(
      service.update(charId, 'nope', { note: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove 404s on an unknown note', async () => {
    const { service } = makeService({ deleteReturn: null });
    await expect(service.remove(charId, 'nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
