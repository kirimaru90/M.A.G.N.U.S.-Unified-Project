/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Types } from 'mongoose';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { QuestsService } from './quests.service';
import { QuestStage } from './schemas/quest.schema';

const campaignId = new Types.ObjectId().toString();
const A = new Types.ObjectId();
const B = new Types.ObjectId();

function stage(over: Partial<QuestStage> = {}): QuestStage {
  const at = new Date('2026-01-01');
  return {
    id: 's1',
    title: 'T',
    status: 'in_corso',
    isMilestone: false,
    isPublic: false,
    revealedAt: null,
    createdAt: at,
    updatedAt: at,
    ...over,
  };
}

function storedQuest(over: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(),
    id: 'q1',
    campaignId: new Types.ObjectId(campaignId),
    kind: 'story',
    characterIds: [],
    isPublic: true,
    stages: [stage()],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

/** Build a service around jest-mocked quest + character models. */
function makeService(opts: {
  quest?: Record<string, unknown> | null;
  validCharacters?: number;
}) {
  const quest = opts.quest === undefined ? storedQuest() : opts.quest;
  const questModel = {
    findOne: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(quest),
    }),
    findOneAndUpdate: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(quest),
    }),
    create: jest.fn().mockImplementation((doc: Record<string, unknown>) =>
      Promise.resolve({
        toObject: () => ({
          ...doc,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      }),
    ),
  };
  const characterModel = {
    countDocuments: jest.fn().mockResolvedValue(opts.validCharacters ?? 0),
    find: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    }),
  };
  return {
    service: new QuestsService(questModel as never, characterModel as never),
    questModel,
    characterModel,
  };
}

const firstStage = { title: 'Un segnale strano' };

describe('QuestsService — kind validation', () => {
  it('rejects a personal quest without characters', async () => {
    const { service } = makeService({});
    await expect(
      service.create(campaignId, { kind: 'personal', stage: firstStage }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create(campaignId, {
        kind: 'personal',
        characterIds: [],
        stage: firstStage,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects characters outside the campaign or deleted', async () => {
    const { service, questModel } = makeService({ validCharacters: 1 });
    await expect(
      service.create(campaignId, {
        kind: 'personal',
        characterIds: [String(A), String(B)],
        stage: firstStage,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(questModel.create).not.toHaveBeenCalled();
  });

  it('rejects a story quest with characters', async () => {
    const { service } = makeService({});
    await expect(
      service.create(campaignId, {
        kind: 'story',
        characterIds: [String(A)],
        stage: firstStage,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a public personal quest', async () => {
    const { service } = makeService({ validCharacters: 1 });
    await expect(
      service.create(campaignId, {
        kind: 'personal',
        characterIds: [String(A)],
        isPublic: true,
        stage: firstStage,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a personal quest with isPublic false', async () => {
    const { service, questModel } = makeService({ validCharacters: 1 });
    await service.create(campaignId, {
      kind: 'personal',
      characterIds: [String(A)],
      stage: firstStage,
    });
    const doc = questModel.create.mock.calls[0][0];
    expect(doc.isPublic).toBe(false);
    expect(doc.characterIds.map(String)).toEqual([String(A)]);
    expect(doc.stages).toHaveLength(1);
  });

  it('switching story → personal requires characterIds in the request', async () => {
    const { service } = makeService({});
    await expect(
      service.update(campaignId, 'q1', { kind: 'personal' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('switching story → personal sets characters and clears isPublic', async () => {
    const { service, questModel } = makeService({ validCharacters: 1 });
    await service.update(campaignId, 'q1', {
      kind: 'personal',
      characterIds: [String(A)],
    });
    const set = questModel.findOneAndUpdate.mock.calls[0][1].$set;
    expect(set.kind).toBe('personal');
    expect(set.isPublic).toBe(false);
    expect(set.characterIds.map(String)).toEqual([String(A)]);
  });

  it('switching personal → story clears characterIds', async () => {
    const { service, questModel } = makeService({
      quest: storedQuest({
        kind: 'personal',
        isPublic: false,
        characterIds: [A],
      }),
    });
    await service.update(campaignId, 'q1', { kind: 'story' });
    const set = questModel.findOneAndUpdate.mock.calls[0][1].$set;
    expect(set.characterIds).toEqual([]);
  });

  it('keeps an already-assigned (since deleted) character without revalidating it', async () => {
    const { service, characterModel } = makeService({
      quest: storedQuest({
        kind: 'personal',
        isPublic: false,
        characterIds: [A],
      }),
      validCharacters: 1,
    });
    await service.update(campaignId, 'q1', {
      characterIds: [String(A), String(B)],
    });
    const filter = characterModel.countDocuments.mock.calls[0][0];
    expect(filter._id.$in.map(String)).toEqual([String(B)]);
  });

  it('a foreign quest id is 404', async () => {
    const { service } = makeService({ quest: null });
    await expect(service.get(campaignId, 'nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('QuestsService — revealedAt', () => {
  it('is set when a stage is created public', async () => {
    const { service, questModel } = makeService({});
    await service.create(campaignId, {
      kind: 'story',
      stage: { title: 'X', isPublic: true },
    });
    expect(questModel.create.mock.calls[0][0].stages[0].revealedAt).toEqual(
      expect.any(Date),
    );
  });

  it('is null when a stage is created as a draft', async () => {
    const { service, questModel } = makeService({});
    await service.addStage(campaignId, 'q1', { title: 'X' });
    const pushed = questModel.findOneAndUpdate.mock.calls[0][1].$push.stages;
    expect(pushed.revealedAt).toBeNull();
    expect(pushed.isPublic).toBe(false);
  });

  it('is set on the first publication of a draft', async () => {
    const { service, questModel } = makeService({});
    await service.updateStage(campaignId, 'q1', 's1', { isPublic: true });
    const set = questModel.findOneAndUpdate.mock.calls[0][1].$set;
    expect(set['stages.$.revealedAt']).toEqual(expect.any(Date));
  });

  it('is not rewritten on republication', async () => {
    const { service, questModel } = makeService({
      quest: storedQuest({
        stages: [
          stage({ isPublic: false, revealedAt: new Date('2026-01-01') }),
        ],
      }),
    });
    await service.updateStage(campaignId, 'q1', 's1', { isPublic: true });
    const set = questModel.findOneAndUpdate.mock.calls[0][1].$set;
    expect(set).not.toHaveProperty(['stages.$.revealedAt']);
  });

  it('is untouched on unpublish', async () => {
    const { service, questModel } = makeService({
      quest: storedQuest({
        stages: [stage({ isPublic: true, revealedAt: new Date('2026-01-01') })],
      }),
    });
    await service.updateStage(campaignId, 'q1', 's1', { isPublic: false });
    const set = questModel.findOneAndUpdate.mock.calls[0][1].$set;
    expect(set).not.toHaveProperty(['stages.$.revealedAt']);
    expect(set['stages.$.isPublic']).toBe(false);
  });

  it('an unknown stage id is 404', async () => {
    const { service } = makeService({});
    await expect(
      service.updateStage(campaignId, 'q1', 'nope', { title: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('QuestsService — delete last stage only', () => {
  const three = storedQuest({
    stages: [stage({ id: 's1' }), stage({ id: 's2' }), stage({ id: 's3' })],
  });

  it('rejects deleting a non-last stage with 409', async () => {
    const { service, questModel } = makeService({ quest: three });
    await expect(
      service.removeStage(campaignId, 'q1', 's2'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(questModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects deleting the only stage with 409', async () => {
    const { service } = makeService({});
    await expect(
      service.removeStage(campaignId, 'q1', 's1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects an unknown stage with 404', async () => {
    const { service } = makeService({ quest: three });
    await expect(
      service.removeStage(campaignId, 'q1', 'nope'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('pulls the last stage, guarded on its position', async () => {
    const { service, questModel } = makeService({ quest: three });
    await service.removeStage(campaignId, 'q1', 's3');
    const [filter, update] = questModel.findOneAndUpdate.mock.calls[0];
    expect(filter['stages.2.id']).toBe('s3');
    expect(filter['stages.3']).toEqual({ $exists: false });
    expect(update).toEqual({ $pull: { stages: { id: 's3' } } });
  });
});
