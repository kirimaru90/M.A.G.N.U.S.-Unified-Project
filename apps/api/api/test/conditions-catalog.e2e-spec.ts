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
import { ConditionsCatalogModule } from '../src/conditions-catalog/conditions-catalog.module';
import { User, UserSchema } from '../src/users/schemas/user.schema';
import {
  Campaign,
  CampaignSchema,
} from '../src/campaigns/schemas/campaign.schema';
import {
  Character,
  CharacterSchema,
} from '../src/characters/schemas/character.schema';
import configuration from '../src/config/configuration';

describe('ConditionsCatalogModule (e2e)', () => {
  let app: NestFastifyApplication;
  let userModel: Model<User>;
  let adminToken: string;
  let playerToken: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

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
        ConditionsCatalogModule,
      ],
    }).compile();

    app = await createTestApp(module);
    userModel = module.get(getModelToken(User.name));

    const hash = await bcrypt.hash('pass', 12);
    await userModel.create({ username: 'admin', passwordHash: hash, role: 'admin' });
    await userModel.create({ username: 'player', passwordHash: hash, role: 'player' });

    const adminLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'admin', password: 'pass' },
    });
    adminToken = JSON.parse(adminLogin.body).accessToken;

    const playerLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'player', password: 'pass' },
    });
    playerToken = JSON.parse(playerLogin.body).accessToken;
  });

  afterAll(async () => {
    await app.close();
    await stopMongoMemoryServer();
  });

  it('GET /conditions-catalog → 401 anonymous', async () => {
    const res = await app.inject({ method: 'GET', url: '/conditions-catalog' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /conditions-catalog → 200 for authenticated player', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/conditions-catalog',
      headers: auth(playerToken),
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(JSON.parse(res.body))).toBe(true);
  });

  it('PATCH /conditions-catalog → 401 anonymous', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/conditions-catalog',
      payload: { ops: [] },
    });
    expect(res.statusCode).toBe(401);
  });

  it('PATCH /conditions-catalog → 403 for player', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/conditions-catalog',
      headers: auth(playerToken),
      payload: {
        ops: [
          {
            action: 'add',
            slug: 'x',
            entry: { name: 'X', defaultSeverity: 'minor', polarity: 'negative' },
          },
        ],
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it('admin adds a new condition preset → GET reflects it', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/conditions-catalog',
      headers: auth(adminToken),
      payload: {
        ops: [
          {
            action: 'add',
            slug: 'poisoned',
            entry: { name: 'Avvelenato', defaultSeverity: 'major', polarity: 'negative' },
          },
        ],
      },
    });
    expect(res.statusCode).toBe(200);

    const list = await app.inject({
      method: 'GET',
      url: '/conditions-catalog',
      headers: auth(playerToken),
    });
    expect(JSON.parse(list.body)).toContainEqual({
      slug: 'poisoned',
      name: 'Avvelenato',
      defaultSeverity: 'major',
      polarity: 'negative',
      description: undefined,
    });
  });

  it('duplicate slug on add → 409 naming the slug', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/conditions-catalog',
      headers: auth(adminToken),
      payload: {
        ops: [
          {
            action: 'add',
            slug: 'poisoned',
            entry: { name: 'X', defaultSeverity: 'minor', polarity: 'negative' },
          },
        ],
      },
    });
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).message).toContain('poisoned');
  });

  it('admin renames a condition preset', async () => {
    await app.inject({
      method: 'PATCH',
      url: '/conditions-catalog',
      headers: auth(adminToken),
      payload: {
        ops: [
          {
            action: 'add',
            slug: 'fatigued',
            entry: { name: 'Affaticato', defaultSeverity: 'minor', polarity: 'negative' },
          },
        ],
      },
    });

    const res = await app.inject({
      method: 'PATCH',
      url: '/conditions-catalog',
      headers: auth(adminToken),
      payload: {
        ops: [{ action: 'rename', slug: 'fatigued', rename: 'exhausted' }],
      },
    });
    expect(res.statusCode).toBe(200);

    const list = await app.inject({
      method: 'GET',
      url: '/conditions-catalog',
      headers: auth(playerToken),
    });
    const entries = JSON.parse(list.body);
    expect(entries.find((e: { slug: string }) => e.slug === 'fatigued')).toBeUndefined();
    expect(entries).toContainEqual({
      slug: 'exhausted',
      name: 'Affaticato',
      defaultSeverity: 'minor',
      polarity: 'negative',
      description: undefined,
    });
  });

  it("admin updates a condition preset's severity", async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/conditions-catalog',
      headers: auth(adminToken),
      payload: {
        ops: [
          {
            action: 'update',
            slug: 'poisoned',
            entry: { name: 'Avvelenato', defaultSeverity: 'minor' },
          },
        ],
      },
    });
    expect(res.statusCode).toBe(200);

    const list = await app.inject({
      method: 'GET',
      url: '/conditions-catalog',
      headers: auth(playerToken),
    });
    const entries = JSON.parse(list.body);
    expect(
      entries.find((e: { slug: string }) => e.slug === 'poisoned')?.defaultSeverity,
    ).toBe('minor');
  });

  it("admin updates a condition preset's polarity", async () => {
    await app.inject({
      method: 'PATCH',
      url: '/conditions-catalog',
      headers: auth(adminToken),
      payload: {
        ops: [
          {
            action: 'add',
            slug: 'well-fed',
            entry: { name: 'Ben Nutrito', defaultSeverity: 'minor', polarity: 'positive' },
          },
        ],
      },
    });

    const res = await app.inject({
      method: 'PATCH',
      url: '/conditions-catalog',
      headers: auth(adminToken),
      payload: {
        ops: [{ action: 'update', slug: 'well-fed', entry: { polarity: 'negative' } }],
      },
    });
    expect(res.statusCode).toBe(200);

    const list = await app.inject({
      method: 'GET',
      url: '/conditions-catalog',
      headers: auth(playerToken),
    });
    const entries = JSON.parse(list.body);
    expect(
      entries.find((e: { slug: string }) => e.slug === 'well-fed')?.polarity,
    ).toBe('negative');
  });

  it('invalid defaultSeverity → 400', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/conditions-catalog',
      headers: auth(adminToken),
      payload: {
        ops: [
          {
            action: 'add',
            slug: 'x',
            entry: { name: 'X', defaultSeverity: 'extreme', polarity: 'negative' },
          },
        ],
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('missing polarity on add → 400', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/conditions-catalog',
      headers: auth(adminToken),
      payload: {
        ops: [
          { action: 'add', slug: 'no-polarity', entry: { name: 'X', defaultSeverity: 'minor' } },
        ],
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('invalid polarity on add → 400', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/conditions-catalog',
      headers: auth(adminToken),
      payload: {
        ops: [
          {
            action: 'add',
            slug: 'bad-polarity',
            entry: { name: 'X', defaultSeverity: 'minor', polarity: 'neutral' },
          },
        ],
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('admin deletes a condition preset', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/conditions-catalog',
      headers: auth(adminToken),
      payload: { ops: [{ action: 'delete', slug: 'poisoned' }] },
    });
    expect(res.statusCode).toBe(200);

    const list = await app.inject({
      method: 'GET',
      url: '/conditions-catalog',
      headers: auth(playerToken),
    });
    const entries = JSON.parse(list.body);
    expect(entries.find((e: { slug: string }) => e.slug === 'poisoned')).toBeUndefined();
  });

  it('unknown slug on delete is ignored and reported', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/conditions-catalog',
      headers: auth(adminToken),
      payload: { ops: [{ action: 'delete', slug: 'ghost' }] },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).ignored).toEqual([
      { slug: 'ghost', reason: 'unknown_slug' },
    ]);
  });

  it('?orderBy=name returns entries alphabetically, folding case and accents', async () => {
    await app.inject({
      method: 'PATCH',
      url: '/conditions-catalog',
      headers: auth(adminToken),
      payload: {
        ops: [
          {
            action: 'add',
            slug: 'ord-z',
            entry: { name: 'Zulu', defaultSeverity: 'minor', polarity: 'negative' },
          },
          {
            action: 'add',
            slug: 'ord-a',
            entry: { name: 'ananas', defaultSeverity: 'minor', polarity: 'positive' },
          },
          {
            action: 'add',
            slug: 'ord-e',
            entry: { name: 'èlite', defaultSeverity: 'major', polarity: 'negative' },
          },
        ],
      },
    });
    const res = await app.inject({
      method: 'GET',
      url: '/conditions-catalog?orderBy=name',
      headers: auth(adminToken),
    });
    const mine = (JSON.parse(res.body) as Array<{ slug: string; name: string }>)
      .filter((e) => e.slug.startsWith('ord-'))
      .map((e) => e.name);
    expect(mine).toEqual(['ananas', 'èlite', 'Zulu']);
  });

  it('an unrecognised ?orderBy value falls back to natural order (no error)', async () => {
    const natural = JSON.parse(
      (
        await app.inject({
          method: 'GET',
          url: '/conditions-catalog',
          headers: auth(adminToken),
        })
      ).body,
    ) as Array<{ slug: string }>;
    const res = await app.inject({
      method: 'GET',
      url: '/conditions-catalog?orderBy=bogus',
      headers: auth(adminToken),
    });
    expect(res.statusCode).toBe(200);
    expect(
      (JSON.parse(res.body) as Array<{ slug: string }>).map((e) => e.slug),
    ).toEqual(natural.map((e) => e.slug));
  });
});
