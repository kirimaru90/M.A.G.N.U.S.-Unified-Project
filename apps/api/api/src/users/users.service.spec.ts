import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

function makeService({
  character,
  updateOne = jest.fn().mockResolvedValue({}),
}: {
  character: object | null;
  updateOne?: jest.Mock;
}) {
  const userModel = { updateOne };
  const campaignModel = {};
  const characterModel = {
    findById: jest.fn().mockReturnValue({
      lean: () => Promise.resolve(character),
    }),
  };
  return new UsersService(
    userModel as never,
    campaignModel as never,
    characterModel as never,
  );
}

describe('UsersService.setLastSelection', () => {
  const validCharacterId = '507f1f77bcf86cd799439011';

  it('sets lastCampaignId/lastCharacterId for the owning player', async () => {
    const updateOne = jest.fn().mockResolvedValue({});
    const svc = makeService({
      character: {
        campaignId: 'C1',
        userId: 'u1',
        isDeleted: false,
      },
      updateOne,
    });
    const result = await svc.setLastSelection(
      { id: 'u1', role: 'player' },
      { campaignId: 'C1', characterId: validCharacterId },
    );
    expect(result).toEqual({
      lastCampaignId: 'C1',
      lastCharacterId: validCharacterId,
    });
    expect(updateOne).toHaveBeenCalledWith(
      { _id: 'u1' },
      {
        $set: { lastCampaignId: 'C1', lastCharacterId: validCharacterId },
      },
    );
  });

  it('rejects a campaignId/characterId mismatch with 400', async () => {
    const svc = makeService({
      character: { campaignId: 'C1', userId: 'u1', isDeleted: false },
    });
    await expect(
      svc.setLastSelection(
        { id: 'u1', role: 'player' },
        { campaignId: 'C2', characterId: validCharacterId },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a reference to a soft-deleted character with 400', async () => {
    const svc = makeService({
      character: { campaignId: 'C1', userId: 'u1', isDeleted: true },
    });
    await expect(
      svc.setLastSelection(
        { id: 'u1', role: 'player' },
        { campaignId: 'C1', characterId: validCharacterId },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a reference to a non-existent character with 400', async () => {
    const svc = makeService({ character: null });
    await expect(
      svc.setLastSelection(
        { id: 'u1', role: 'player' },
        { campaignId: 'C1', characterId: validCharacterId },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a player referencing another player\'s character with 404', async () => {
    const svc = makeService({
      character: { campaignId: 'C1', userId: 'other-player', isDeleted: false },
    });
    await expect(
      svc.setLastSelection(
        { id: 'u1', role: 'player' },
        { campaignId: 'C1', characterId: validCharacterId },
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('allows an admin to set last-selection to any character', async () => {
    const updateOne = jest.fn().mockResolvedValue({});
    const svc = makeService({
      character: { campaignId: 'C1', userId: 'other-player', isDeleted: false },
      updateOne,
    });
    const result = await svc.setLastSelection(
      { id: 'admin-1', role: 'admin' },
      { campaignId: 'C1', characterId: validCharacterId },
    );
    expect(result).toEqual({
      lastCampaignId: 'C1',
      lastCharacterId: validCharacterId,
    });
  });

  it('rejects a malformed characterId with 400', async () => {
    const svc = makeService({ character: null });
    await expect(
      svc.setLastSelection(
        { id: 'u1', role: 'player' },
        { campaignId: 'C1', characterId: 'not-an-object-id' },
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
