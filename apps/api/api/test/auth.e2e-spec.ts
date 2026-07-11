import { Test } from '@nestjs/testing';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConfigModule } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import {
  createTestApp,
  startMongoMemoryServer,
  stopMongoMemoryServer,
  mongooseTestModule,
} from './test-helpers';
import { AuthModule } from '../src/auth/auth.module';
import { CampaignsModule } from '../src/campaigns/campaigns.module';
import { CharactersModule } from '../src/characters/characters.module';
import { User, UserSchema } from '../src/users/schemas/user.schema';
import {
  Campaign,
  CampaignSchema,
} from '../src/campaigns/schemas/campaign.schema';
import { Character, CharacterSchema } from '../src/characters/schemas/character.schema';
import { MongooseModule } from '@nestjs/mongoose';
import configuration from '../src/config/configuration';

describe('AuthModule (e2e)', () => {
  let app: NestFastifyApplication;
  let userModel: Model<User>;
  let campaignModel: Model<Campaign>;
  let characterModel: Model<Character>;

  beforeAll(async () => {
    const uri = await startMongoMemoryServer();
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
        mongooseTestModule(uri),
        MongooseModule.forFeature([
          { name: User.name, schema: UserSchema },
          { name: Campaign.name, schema: CampaignSchema },
          { name: Character.name, schema: CharacterSchema },
        ]),
        AuthModule,
        CampaignsModule,
        CharactersModule,
      ],
    }).compile();

    app = await createTestApp(module);
    userModel = module.get(getModelToken(User.name));
    campaignModel = module.get(getModelToken(Campaign.name));
    characterModel = module.get(getModelToken(Character.name));

    const hash = await bcrypt.hash('password123', 12);
    await userModel.create({
      username: 'admin1',
      passwordHash: hash,
      role: 'admin',
    });
  });

  afterAll(async () => {
    await app.close();
    await stopMongoMemoryServer();
  });

  it('POST /auth/login → 200 with accessToken', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'admin1', password: 'password123' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.accessToken).toBeDefined();
    expect(body.role).toBe('admin');
    expect(body.expiresIn).toBe(86400);
  });

  it('POST /auth/login with wrong password → 401 generic', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'admin1', password: 'wrong' },
    });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.message).toBe('Invalid credentials');
  });

  it('POST /auth/login with unknown user → 401 generic (same message)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'nobody', password: 'password123' },
    });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.message).toBe('Invalid credentials');
  });

  it('POST /auth/logout → 204 without token', async () => {
    const res = await app.inject({ method: 'POST', url: '/auth/logout' });
    expect(res.statusCode).toBe(204);
  });

  it('GET /auth/me without token → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/me' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /auth/me with valid token → 200 with user info', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'admin1', password: 'password123' },
    });
    const { accessToken } = JSON.parse(loginRes.body);
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.username).toBe('admin1');
    expect(body.role).toBe('admin');
    expect(body.passwordHash).toBeUndefined();
    expect(body.lastCharacterId).toBeNull();
  });

  describe('GET /auth/me lastCharacterId self-heal', () => {
    async function loginAs(username: string, password: string) {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { username, password },
      });
      return JSON.parse(res.body).accessToken as string;
    }

    it('clears lastCharacterId when the referenced character does not exist', async () => {
      const hash = await bcrypt.hash('pw1', 12);
      await userModel.create({
        username: 'u-char-gone',
        passwordHash: hash,
        role: 'player',
        lastCampaignId: null,
        lastCharacterId: String(new Types.ObjectId()),
      });
      const token = await loginAs('u-char-gone', 'pw1');

      const res = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = JSON.parse(res.body);
      expect(body.lastCharacterId).toBeNull();

      const stored = await userModel.findOne({ username: 'u-char-gone' }).lean();
      expect(stored?.lastCharacterId).toBeNull();
    });

    it('clears lastCharacterId when the referenced character is soft-deleted', async () => {
      const campaign = await campaignModel.create({
        name: 'Auth Self-Heal Campaign',
        isActive: true,
        isPublic: false,
        players: [],
        state: new Map(),
      });
      const character = await characterModel.create({
        campaignId: campaign._id,
        userId: new Types.ObjectId(),
        name: 'Deleted Dweller',
        isDeleted: true,
      });

      const hash = await bcrypt.hash('pw2', 12);
      await userModel.create({
        username: 'u-char-deleted',
        passwordHash: hash,
        role: 'player',
        lastCampaignId: String(campaign._id),
        lastCharacterId: String(character._id),
      });
      const token = await loginAs('u-char-deleted', 'pw2');

      const res = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(JSON.parse(res.body).lastCharacterId).toBeNull();
    });

    it('clears lastCharacterId when its campaign no longer matches lastCampaignId', async () => {
      const campaignA = await campaignModel.create({
        name: 'Campaign A',
        isActive: true,
        isPublic: false,
        players: [],
        state: new Map(),
      });
      const campaignB = await campaignModel.create({
        name: 'Campaign B',
        isActive: true,
        isPublic: false,
        players: [],
        state: new Map(),
      });
      const character = await characterModel.create({
        campaignId: campaignA._id,
        userId: new Types.ObjectId(),
        name: 'Cross-Campaign Dweller',
        isDeleted: false,
      });

      const hash = await bcrypt.hash('pw3', 12);
      await userModel.create({
        username: 'u-char-mismatch',
        passwordHash: hash,
        role: 'player',
        lastCampaignId: String(campaignB._id),
        lastCharacterId: String(character._id),
      });
      const token = await loginAs('u-char-mismatch', 'pw3');

      const res = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = JSON.parse(res.body);
      expect(body.lastCharacterId).toBeNull();
      expect(body.lastCampaignId).toBe(String(campaignB._id));
    });

    it('returns a valid lastCharacterId as-is', async () => {
      const campaign = await campaignModel.create({
        name: 'Valid Campaign',
        isActive: true,
        isPublic: false,
        players: [],
        state: new Map(),
      });
      const character = await characterModel.create({
        campaignId: campaign._id,
        userId: new Types.ObjectId(),
        name: 'Valid Dweller',
        isDeleted: false,
      });

      const hash = await bcrypt.hash('pw4', 12);
      await userModel.create({
        username: 'u-char-valid',
        passwordHash: hash,
        role: 'player',
        lastCampaignId: String(campaign._id),
        lastCharacterId: String(character._id),
      });
      const token = await loginAs('u-char-valid', 'pw4');

      const res = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(JSON.parse(res.body).lastCharacterId).toBe(String(character._id));

      const stored = await userModel.findOne({ username: 'u-char-valid' }).lean();
      expect(stored?.lastCharacterId).toBe(String(character._id));
    });
  });
});
