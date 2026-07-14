import { Types } from 'mongoose';
import { CharactersService } from './characters.service';
import { AuthenticatedUser } from '../auth/jwt.strategy';

function baseChar(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(),
    campaignId: new Types.ObjectId(),
    userId: new Types.ObjectId(),
    name: 'Dweller',
    species: 'human',
    special: {},
    skills: [],
    perks: [],
    positiveConditions: [],
    negativeConditions: [],
    criticalState: false,
    resources: {},
    inventory: { weapons: [], equip: [], consumables: [], misc: [] },
    isDeleted: false,
    ...overrides,
  };
}

describe('CharactersService background', () => {
  it('getBackground returns the selected value', async () => {
    const characterModel = {
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ background: 'Storia' }),
        }),
      }),
    };
    const service = new CharactersService(
      characterModel as never,
      {} as never,
      {} as never,
    );
    const out = await service.getBackground(
      new Types.ObjectId().toString(),
      new Types.ObjectId().toString(),
    );
    expect(out).toEqual({ background: 'Storia' });
    expect(characterModel.findOne().select).toBeDefined();
  });

  it('getBackground returns null when unset', async () => {
    const characterModel = {
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({}),
        }),
      }),
    };
    const service = new CharactersService(
      characterModel as never,
      {} as never,
      {} as never,
    );
    const out = await service.getBackground(
      new Types.ObjectId().toString(),
      new Types.ObjectId().toString(),
    );
    expect(out).toEqual({ background: null });
  });

  it('findById response never carries background even if the doc has it', async () => {
    const char = baseChar({ background: 'leak?' });
    const characterModel = {
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(char),
      }),
    };
    const service = new CharactersService(
      characterModel as never,
      {} as never,
      {} as never,
    );
    const res = await service.findById(
      char.campaignId.toString(),
      char._id.toString(),
    );
    expect(res).not.toHaveProperty('background');
  });

  it('update overwrites background when present, preserves it when omitted', async () => {
    const char = baseChar();
    const captured: Record<string, unknown>[] = [];
    const characterModel = {
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(char),
      }),
      findByIdAndUpdate: jest.fn().mockImplementation((_id, update) => {
        captured.push(update.$set);
        return { lean: jest.fn().mockResolvedValue({ ...char }) };
      }),
    };
    const speciesCatalog = { slugExists: jest.fn().mockResolvedValue(true) };
    const service = new CharactersService(
      characterModel as never,
      {} as never,
      speciesCatalog as never,
    );
    const owner: AuthenticatedUser = {
      id: String(char.userId),
      role: 'player',
    };

    // present → in $set
    await service.update(
      char.campaignId.toString(),
      char._id.toString(),
      { name: 'X', background: 'Nuova' },
      owner,
    );
    expect(captured[0]).toHaveProperty('background', 'Nuova');

    // omitted → not in $set (stored value untouched)
    await service.update(
      char.campaignId.toString(),
      char._id.toString(),
      { name: 'Y' },
      owner,
    );
    expect(captured[1]).not.toHaveProperty('background');
  });
});
