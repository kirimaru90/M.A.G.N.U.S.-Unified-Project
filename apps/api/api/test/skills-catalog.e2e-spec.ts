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
import { SkillsCatalogModule } from '../src/skills-catalog/skills-catalog.module';
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

describe('SkillsCatalogModule (e2e)', () => {
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
        SkillsCatalogModule,
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

  it('GET /skills-catalog → 401 anonymous', async () => {
    const res = await app.inject({ method: 'GET', url: '/skills-catalog' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /skills-catalog → 200 for authenticated player', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/skills-catalog',
      headers: auth(playerToken),
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(JSON.parse(res.body))).toBe(true);
  });

  it('PATCH /skills-catalog → 401 anonymous', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/skills-catalog',
      payload: { ops: [] },
    });
    expect(res.statusCode).toBe(401);
  });

  it('PATCH /skills-catalog → 403 for player', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/skills-catalog',
      headers: auth(playerToken),
      payload: {
        ops: [{ action: 'add', slug: 'x', entry: { name: 'X' } }],
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it('admin adds a new skill → GET reflects it', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/skills-catalog',
      headers: auth(adminToken),
      payload: {
        ops: [
          {
            action: 'add',
            slug: 'hacking',
            entry: {
              name: 'Hacking',
              description: 'Bypassare terminali e serrature elettroniche',
            },
          },
        ],
      },
    });
    expect(res.statusCode).toBe(200);

    const list = await app.inject({
      method: 'GET',
      url: '/skills-catalog',
      headers: auth(playerToken),
    });
    const entries = JSON.parse(list.body);
    expect(entries).toContainEqual({
      slug: 'hacking',
      name: 'Hacking',
      description: 'Bypassare terminali e serrature elettroniche',
    });
  });

  it('duplicate slug on add → 409 naming the slug', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/skills-catalog',
      headers: auth(adminToken),
      payload: {
        ops: [{ action: 'add', slug: 'hacking', entry: { name: 'Hacking 2' } }],
      },
    });
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).message).toContain('hacking');
  });

  it('admin renames a skill', async () => {
    await app.inject({
      method: 'PATCH',
      url: '/skills-catalog',
      headers: auth(adminToken),
      payload: {
        ops: [{ action: 'add', slug: 'sneak', entry: { name: 'Sneak' } }],
      },
    });

    const res = await app.inject({
      method: 'PATCH',
      url: '/skills-catalog',
      headers: auth(adminToken),
      payload: {
        ops: [{ action: 'rename', slug: 'sneak', rename: 'sneaking' }],
      },
    });
    expect(res.statusCode).toBe(200);

    const list = await app.inject({
      method: 'GET',
      url: '/skills-catalog',
      headers: auth(playerToken),
    });
    const entries = JSON.parse(list.body);
    expect(entries.find((e: { slug: string }) => e.slug === 'sneak')).toBeUndefined();
    expect(entries).toContainEqual({
      slug: 'sneaking',
      name: 'Sneak',
      description: undefined,
    });
  });

  it("admin updates a skill's description", async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/skills-catalog',
      headers: auth(adminToken),
      payload: {
        ops: [
          {
            action: 'update',
            slug: 'hacking',
            entry: { name: 'Hacking', description: 'New description' },
          },
        ],
      },
    });
    expect(res.statusCode).toBe(200);

    const list = await app.inject({
      method: 'GET',
      url: '/skills-catalog',
      headers: auth(playerToken),
    });
    const entries = JSON.parse(list.body);
    expect(
      entries.find((e: { slug: string }) => e.slug === 'hacking')?.description,
    ).toBe('New description');
  });

  it('admin deletes a skill', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/skills-catalog',
      headers: auth(adminToken),
      payload: { ops: [{ action: 'delete', slug: 'hacking' }] },
    });
    expect(res.statusCode).toBe(200);

    const list = await app.inject({
      method: 'GET',
      url: '/skills-catalog',
      headers: auth(playerToken),
    });
    const entries = JSON.parse(list.body);
    expect(entries.find((e: { slug: string }) => e.slug === 'hacking')).toBeUndefined();
  });

  it('unknown slug on update is ignored and reported', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/skills-catalog',
      headers: auth(adminToken),
      payload: {
        ops: [{ action: 'update', slug: 'ghost', entry: { name: 'Ghost' } }],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.ignored).toEqual([{ slug: 'ghost', reason: 'unknown_slug' }]);

    const list = await app.inject({
      method: 'GET',
      url: '/skills-catalog',
      headers: auth(playerToken),
    });
    const entries = JSON.parse(list.body);
    expect(entries.find((e: { slug: string }) => e.slug === 'ghost')).toBeUndefined();
  });

  it('add op missing name → 400', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/skills-catalog',
      headers: auth(adminToken),
      payload: { ops: [{ action: 'add', slug: 'no-name', entry: {} }] },
    });
    expect(res.statusCode).toBe(400);
  });
});
