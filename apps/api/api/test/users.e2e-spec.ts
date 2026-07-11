import { Test } from '@nestjs/testing';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import {
  createTestApp,
  startMongoMemoryServer,
  stopMongoMemoryServer,
  mongooseTestModule,
} from './test-helpers';
import { AuthModule } from '../src/auth/auth.module';
import { UsersModule } from '../src/users/users.module';
import { CampaignsModule } from '../src/campaigns/campaigns.module';
import { CharactersModule } from '../src/characters/characters.module';
import { User, UserSchema } from '../src/users/schemas/user.schema';
import {
  Campaign,
  CampaignSchema,
} from '../src/campaigns/schemas/campaign.schema';
import configuration from '../src/config/configuration';

describe('UsersModule (e2e)', () => {
  let app: NestFastifyApplication;
  let userModel: Model<User>;
  let adminToken: string;
  let playerToken: string;
  let playerId: string;

  beforeAll(async () => {
    const uri = await startMongoMemoryServer();
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
        mongooseTestModule(uri),
        MongooseModule.forFeature([
          { name: User.name, schema: UserSchema },
          { name: Campaign.name, schema: CampaignSchema },
        ]),
        AuthModule,
        UsersModule,
        CampaignsModule,
        CharactersModule,
      ],
    }).compile();

    app = await createTestApp(module);
    userModel = module.get(getModelToken(User.name));

    const adminHash = await bcrypt.hash('adminpass', 12);
    const playerHash = await bcrypt.hash('playerpass', 12);
    await userModel.create({
      username: 'admin',
      passwordHash: adminHash,
      role: 'admin',
    });
    const player1 = await userModel.create({
      username: 'player1',
      passwordHash: playerHash,
      role: 'player',
    });
    playerId = String(player1._id);

    const adminLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'admin', password: 'adminpass' },
    });
    adminToken = JSON.parse(adminLogin.body).accessToken;

    const playerLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'player1', password: 'playerpass' },
    });
    playerToken = JSON.parse(playerLogin.body).accessToken;
  });

  afterAll(async () => {
    await app.close();
    await stopMongoMemoryServer();
  });

  it('GET /users → 200 for admin', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/users',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body)).toBe(true);
    expect(body.every((u: { passwordHash?: unknown }) => !u.passwordHash)).toBe(
      true,
    );
  });

  it('GET /users → 403 for player', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/users',
      headers: { Authorization: `Bearer ${playerToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('GET /users → 401 anonymous', async () => {
    const res = await app.inject({ method: 'GET', url: '/users' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /users → 201 creates user, password hashed', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/users',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        username: 'newplayer',
        password: 'securepass',
        role: 'player',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.username).toBe('newplayer');
    expect(body.passwordHash).toBeUndefined();
    const stored = await userModel.findOne({ username: 'newplayer' }).lean();
    expect(stored?.passwordHash).toMatch(/^\$2[aby]?\$/);
  });

  it('POST /users → 409 on duplicate username', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/users',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        username: 'newplayer',
        password: 'anotherpass',
        role: 'player',
      },
    });
    expect(res.statusCode).toBe(409);
  });

  it('POST /users → 400 on invalid role', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/users',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { username: 'x', password: 'password1', role: 'superadmin' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('DELETE /users/:id → 409 when deleting self', async () => {
    const me = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const { id } = JSON.parse(me.body);
    const res = await app.inject({
      method: 'DELETE',
      url: `/users/${id}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(409);
  });

  // Task 5.2: server-owned fields are accepted-and-ignored (200), not 400 from
  // the global forbidNonWhitelisted pipe.
  it('PUT /users/:id → 200 accepting-and-ignoring lastCampaignId/unlockedHiddenIds', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/users',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { username: 'echouser', password: 'securepass', role: 'player' },
    });
    const { id } = JSON.parse(created.body);

    const res = await app.inject({
      method: 'PUT',
      url: `/users/${id}`,
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        username: 'echouser2',
        lastCampaignId: '507f1f77bcf86cd799439011',
        unlockedHiddenIds: ['h1', 'h2'],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.username).toBe('echouser2');
    // Server-owned fields are ignored, not persisted onto the response.
    expect(body.lastCampaignId).toBeUndefined();
    expect(body.unlockedHiddenIds).toBeUndefined();
  });

  describe('PUT /users/me/last-selection', () => {
    let campaignId: string;
    let characterId: string;
    let otherPlayerCharacterId: string;

    beforeAll(async () => {
      const campaignRes = await app.inject({
        method: 'POST',
        url: '/campaigns',
        headers: { Authorization: `Bearer ${adminToken}` },
        payload: { name: 'Last-Selection Campaign', isActive: true },
      });
      campaignId = JSON.parse(campaignRes.body).id;

      await app.inject({
        method: 'POST',
        url: `/campaigns/${campaignId}/players`,
        headers: { Authorization: `Bearer ${adminToken}` },
        payload: { playerId },
      });

      const characterRes = await app.inject({
        method: 'POST',
        url: `/campaigns/${campaignId}/characters`,
        headers: { Authorization: `Bearer ${adminToken}` },
        payload: { name: 'Dweller', userId: playerId },
      });
      characterId = JSON.parse(characterRes.body).id;

      const otherPlayer = await userModel.create({
        username: 'player2',
        passwordHash: await bcrypt.hash('playerpass2', 12),
        role: 'player',
      });
      await app.inject({
        method: 'POST',
        url: `/campaigns/${campaignId}/players`,
        headers: { Authorization: `Bearer ${adminToken}` },
        payload: { playerId: String(otherPlayer._id) },
      });
      const otherCharacterRes = await app.inject({
        method: 'POST',
        url: `/campaigns/${campaignId}/characters`,
        headers: { Authorization: `Bearer ${adminToken}` },
        payload: { name: 'Other Dweller', userId: String(otherPlayer._id) },
      });
      otherPlayerCharacterId = JSON.parse(otherCharacterRes.body).id;
    });

    it('player sets their own last selection → 200', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/users/me/last-selection',
        headers: { Authorization: `Bearer ${playerToken}` },
        payload: { campaignId, characterId },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toEqual({
        lastCampaignId: campaignId,
        lastCharacterId: characterId,
      });

      const me = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { Authorization: `Bearer ${playerToken}` },
      });
      const meBody = JSON.parse(me.body);
      expect(meBody.lastCampaignId).toBe(campaignId);
      expect(meBody.lastCharacterId).toBe(characterId);
    });

    it('missing characterId → 400', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/users/me/last-selection',
        headers: { Authorization: `Bearer ${playerToken}` },
        payload: { campaignId },
      });
      expect(res.statusCode).toBe(400);
    });

    it('campaignId/characterId mismatch → 400', async () => {
      const otherCampaignRes = await app.inject({
        method: 'POST',
        url: '/campaigns',
        headers: { Authorization: `Bearer ${adminToken}` },
        payload: { name: 'Another Campaign' },
      });
      const otherCampaignId = JSON.parse(otherCampaignRes.body).id;

      const res = await app.inject({
        method: 'PUT',
        url: '/users/me/last-selection',
        headers: { Authorization: `Bearer ${playerToken}` },
        payload: { campaignId: otherCampaignId, characterId },
      });
      expect(res.statusCode).toBe(400);
    });

    it("player cannot set last-selection to another player's character → 404", async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/users/me/last-selection',
        headers: { Authorization: `Bearer ${playerToken}` },
        payload: { campaignId, characterId: otherPlayerCharacterId },
      });
      expect(res.statusCode).toBe(404);
    });

    it('admin can set last-selection to any character → 200', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/users/me/last-selection',
        headers: { Authorization: `Bearer ${adminToken}` },
        payload: { campaignId, characterId: otherPlayerCharacterId },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toEqual({
        lastCampaignId: campaignId,
        lastCharacterId: otherPlayerCharacterId,
      });
    });

    it('reference to a soft-deleted character → 400', async () => {
      await app.inject({
        method: 'DELETE',
        url: `/campaigns/${campaignId}/characters/${characterId}`,
        headers: { Authorization: `Bearer ${playerToken}` },
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/users/me/last-selection',
        headers: { Authorization: `Bearer ${playerToken}` },
        payload: { campaignId, characterId },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('Campaign deletion cascade clears lastCharacterId', () => {
    it('clears lastCampaignId and lastCharacterId together on campaign delete', async () => {
      const campaignRes = await app.inject({
        method: 'POST',
        url: '/campaigns',
        headers: { Authorization: `Bearer ${adminToken}` },
        payload: { name: 'Cascade Campaign' },
      });
      const cascadeCampaignId = JSON.parse(campaignRes.body).id;

      await app.inject({
        method: 'POST',
        url: `/campaigns/${cascadeCampaignId}/players`,
        headers: { Authorization: `Bearer ${adminToken}` },
        payload: { playerId },
      });

      const characterRes = await app.inject({
        method: 'POST',
        url: `/campaigns/${cascadeCampaignId}/characters`,
        headers: { Authorization: `Bearer ${adminToken}` },
        payload: { name: 'Cascade Dweller', userId: playerId },
      });
      const cascadeCharacterId = JSON.parse(characterRes.body).id;

      await app.inject({
        method: 'PUT',
        url: '/users/me/last-selection',
        headers: { Authorization: `Bearer ${playerToken}` },
        payload: { campaignId: cascadeCampaignId, characterId: cascadeCharacterId },
      });

      await app.inject({
        method: 'DELETE',
        url: `/campaigns/${cascadeCampaignId}`,
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const me = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { Authorization: `Bearer ${playerToken}` },
      });
      const meBody = JSON.parse(me.body);
      expect(meBody.lastCampaignId).toBeNull();
      expect(meBody.lastCharacterId).toBeNull();
    });
  });
});
