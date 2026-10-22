import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

function makeService({
  user,
  campaignExists,
  character = null,
  updateOne = jest.fn().mockResolvedValue({}),
}: {
  user: object | null;
  campaignExists: boolean;
  character?: object | null;
  updateOne?: jest.Mock;
}) {
  const userModel = {
    findById: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: () => Promise.resolve(user),
      }),
    }),
    updateOne,
  };
  const campaignModel = {
    exists: jest.fn().mockResolvedValue(campaignExists ? { _id: 'x' } : null),
  };
  const characterModel = {
    findById: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue(Promise.resolve(character)),
    }),
  };
  return new AuthService(
    userModel as never,
    campaignModel as never,
    characterModel as never,
    { sign: jest.fn() } as never,
  );
}

describe('AuthService.me', () => {
  it('returns id, username, role, lastCampaignId, lastCharacterId, unlockedHiddenIds', async () => {
    const svc = makeService({
      user: {
        _id: '1',
        username: 'alice',
        role: 'player',
        lastCampaignId: null,
        lastCharacterId: null,
        unlockedHiddenIds: new Map(),
      },
      campaignExists: false,
    });
    const result = await svc.me('1');
    expect(result).toEqual({
      id: '1',
      username: 'alice',
      role: 'player',
      lastCampaignId: null,
      lastCharacterId: null,
      unlockedHiddenIds: {},
    });
  });

  it('returns null lastCampaignId and empty unlockedHiddenIds when both are default', async () => {
    const svc = makeService({
      user: {
        _id: '1',
        username: 'bob',
        role: 'player',
        lastCampaignId: null,
        lastCharacterId: null,
        unlockedHiddenIds: new Map(),
      },
      campaignExists: false,
    });
    const result = await svc.me('1');
    expect(result.lastCampaignId).toBeNull();
    expect(result.unlockedHiddenIds).toEqual({});
  });

  it('serializes unlockedHiddenIds Map to plain object', async () => {
    const map = new Map([
      ['C1', ['vault-101']],
      ['C2', ['root', 'back-door']],
    ]);
    const svc = makeService({
      user: {
        _id: '1',
        username: 'alice',
        role: 'player',
        lastCampaignId: 'C1',
        lastCharacterId: null,
        unlockedHiddenIds: map,
      },
      campaignExists: true,
    });
    const result = await svc.me('1');
    expect(result.unlockedHiddenIds).toEqual({
      C1: ['vault-101'],
      C2: ['root', 'back-door'],
    });
  });

  it('returns lastCampaignId as-is when the campaign exists', async () => {
    const svc = makeService({
      user: {
        _id: '1',
        username: 'alice',
        role: 'player',
        lastCampaignId: 'C1',
        lastCharacterId: null,
        unlockedHiddenIds: new Map(),
      },
      campaignExists: true,
    });
    const result = await svc.me('1');
    expect(result.lastCampaignId).toBe('C1');
  });

  it('lazily nulls lastCampaignId when campaign no longer exists and persists the change', async () => {
    const updateOne = jest.fn().mockResolvedValue({});
    const svc = makeService({
      user: {
        _id: '1',
        username: 'alice',
        role: 'player',
        lastCampaignId: 'C-gone',
        lastCharacterId: null,
        unlockedHiddenIds: new Map(),
      },
      campaignExists: false,
      updateOne,
    });
    const result = await svc.me('1');
    expect(result.lastCampaignId).toBeNull();
    expect(updateOne).toHaveBeenCalledWith(
      { _id: '1' },
      { $set: { lastCampaignId: null } },
    );
  });

  it('throws UnauthorizedException when user not found', async () => {
    const svc = makeService({ user: null, campaignExists: false });
    await expect(svc.me('ghost')).rejects.toThrow(UnauthorizedException);
  });

  it('lazily nulls lastCharacterId when the character no longer exists', async () => {
    const updateOne = jest.fn().mockResolvedValue({});
    const svc = makeService({
      user: {
        _id: '1',
        username: 'alice',
        role: 'player',
        lastCampaignId: 'C1',
        lastCharacterId: 'char-gone',
        unlockedHiddenIds: new Map(),
      },
      campaignExists: true,
      character: null,
      updateOne,
    });
    const result = await svc.me('1');
    expect(result.lastCharacterId).toBeNull();
    expect(updateOne).toHaveBeenCalledWith(
      { _id: '1' },
      { $set: { lastCharacterId: null } },
    );
  });

  it('lazily nulls lastCharacterId when the character is soft-deleted', async () => {
    const svc = makeService({
      user: {
        _id: '1',
        username: 'alice',
        role: 'player',
        lastCampaignId: 'C1',
        lastCharacterId: 'char-1',
        unlockedHiddenIds: new Map(),
      },
      campaignExists: true,
      character: { campaignId: 'C1', isDeleted: true },
    });
    const result = await svc.me('1');
    expect(result.lastCharacterId).toBeNull();
  });

  it('lazily nulls lastCharacterId when its campaign no longer matches lastCampaignId', async () => {
    const svc = makeService({
      user: {
        _id: '1',
        username: 'alice',
        role: 'player',
        lastCampaignId: 'C2',
        lastCharacterId: 'char-1',
        unlockedHiddenIds: new Map(),
      },
      campaignExists: true,
      character: { campaignId: 'C1', isDeleted: false },
    });
    const result = await svc.me('1');
    expect(result.lastCharacterId).toBeNull();
    expect(result.lastCampaignId).toBe('C2');
  });

  it('returns lastCharacterId as-is when it is valid', async () => {
    const svc = makeService({
      user: {
        _id: '1',
        username: 'alice',
        role: 'player',
        lastCampaignId: 'C1',
        lastCharacterId: 'char-1',
        unlockedHiddenIds: new Map(),
      },
      campaignExists: true,
      character: { campaignId: 'C1', isDeleted: false },
    });
    const result = await svc.me('1');
    expect(result.lastCharacterId).toBe('char-1');
  });
});

describe('AuthService.login', () => {
  const jwtService = new JwtService({
    secret: 'test-secret',
    signOptions: { expiresIn: '24h' },
  });

  async function makeLoginService() {
    const passwordHash = await bcrypt.hash('pw', 4);
    const userModel = {
      findOne: jest.fn().mockReturnValue({
        lean: () =>
          Promise.resolve({ _id: 'u1', role: 'player', passwordHash }),
      }),
    };
    return new AuthService(
      userModel as never,
      {} as never,
      {} as never,
      jwtService,
    );
  }

  function lifetime(token: string) {
    const { iat, exp } = jwtService.decode<{ iat: number; exp: number }>(token);
    return exp - iat;
  }

  it('issues a 24h token by default', async () => {
    const svc = await makeLoginService();
    const result = await svc.login('alice', 'pw');
    expect(result.expiresIn).toBe(86400);
    expect(lifetime(result.accessToken)).toBe(86400);
  });

  it('issues a 24h token when rememberMe is false', async () => {
    const svc = await makeLoginService();
    const result = await svc.login('alice', 'pw', false);
    expect(result.expiresIn).toBe(86400);
    expect(lifetime(result.accessToken)).toBe(86400);
  });

  it('issues a 365-day token when rememberMe is true', async () => {
    const svc = await makeLoginService();
    const result = await svc.login('alice', 'pw', true);
    expect(result.expiresIn).toBe(31536000);
    expect(lifetime(result.accessToken)).toBe(31536000);
  });

  it('rejects a wrong password', async () => {
    const svc = await makeLoginService();
    await expect(svc.login('alice', 'nope', true)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
