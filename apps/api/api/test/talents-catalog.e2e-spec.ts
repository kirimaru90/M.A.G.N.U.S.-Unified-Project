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
import { TalentsCatalogModule } from '../src/talents-catalog/talents-catalog.module';
import { User, UserSchema } from '../src/users/schemas/user.schema';
import configuration from '../src/config/configuration';

type Entry = { slug: string; name: string; description?: string };

describe('TalentsCatalogModule (e2e)', () => {
  let app: NestFastifyApplication;
  let userModel: Model<User>;
  let adminToken: string;
  let playerToken: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const listTalents = async (query = '', token = adminToken) =>
    JSON.parse(
      (
        await app.inject({
          method: 'GET',
          url: `/talents-catalog${query}`,
          headers: auth(token),
        })
      ).body,
    ) as Entry[];

  const patchCatalog = (ops: unknown[], token = adminToken) =>
    app.inject({
      method: 'PATCH',
      url: '/talents-catalog',
      headers: auth(token),
      payload: { ops },
    });

  beforeAll(async () => {
    const uri = await startMongoMemoryServer();
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
        mongooseTestModule(uri),
        MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
        AuthModule,
        TalentsCatalogModule,
      ],
    }).compile();

    // init() fires OnApplicationBootstrap against an empty database.
    app = await createTestApp(module);
    userModel = module.get(getModelToken(User.name));

    const hash = await bcrypt.hash('pass', 12);
    await userModel.create({
      username: 'admin',
      passwordHash: hash,
      role: 'admin',
    });
    await userModel.create({
      username: 'player',
      passwordHash: hash,
      role: 'player',
    });

    const login = async (username: string) =>
      JSON.parse(
        (
          await app.inject({
            method: 'POST',
            url: '/auth/login',
            payload: { username, password: 'pass' },
          })
        ).body,
      ).accessToken as string;
    adminToken = await login('admin');
    playerToken = await login('player');
  });

  afterAll(async () => {
    await app.close();
    await stopMongoMemoryServer();
  });

  it('starts empty on a fresh bootstrap and returns an empty array', async () => {
    expect(await listTalents()).toEqual([]);
  });

  it('GET is 200 for a player and 401 anonymous', async () => {
    const asPlayer = await app.inject({
      method: 'GET',
      url: '/talents-catalog',
      headers: auth(playerToken),
    });
    expect(asPlayer.statusCode).toBe(200);

    const anon = await app.inject({ method: 'GET', url: '/talents-catalog' });
    expect(anon.statusCode).toBe(401);
  });

  it('admin adds a talent → GET reflects it', async () => {
    const res = await patchCatalog([
      { action: 'add', slug: 'gun-fu', entry: { name: 'Gun Fu', description: 'd' } },
    ]);
    expect(res.statusCode).toBe(200);
    expect(await listTalents()).toContainEqual({
      slug: 'gun-fu',
      name: 'Gun Fu',
      description: 'd',
    });
  });

  it('duplicate slug on add → 409', async () => {
    const res = await patchCatalog([
      { action: 'add', slug: 'gun-fu', entry: { name: 'Gun Fu 2' } },
    ]);
    expect(res.statusCode).toBe(409);
    expect(res.body).toContain('gun-fu');
  });

  it('admin renames a talent, preserving its data', async () => {
    await patchCatalog([
      { action: 'add', slug: 'sneak', entry: { name: 'Sneak' } },
    ]);
    const res = await patchCatalog([
      { action: 'rename', slug: 'sneak', rename: 'sneaking' },
    ]);
    expect(res.statusCode).toBe(200);
    const all = await listTalents();
    expect(all.some((e) => e.slug === 'sneak')).toBe(false);
    expect(all).toContainEqual({
      slug: 'sneaking',
      name: 'Sneak',
      description: undefined,
    });
  });

  it('unknown slug on delete → 200 with unknown_slug in ignored', async () => {
    const res = await patchCatalog([{ action: 'delete', slug: 'nonesuch' }]);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).ignored).toEqual([
      { slug: 'nonesuch', reason: 'unknown_slug' },
    ]);
  });

  it('add op missing name → 400', async () => {
    const res = await patchCatalog([
      { action: 'add', slug: 'no-name', entry: {} },
    ]);
    expect(res.statusCode).toBe(400);
  });

  it('PATCH is 403 for a player and 401 anonymous', async () => {
    const ops = [{ action: 'add', slug: 'x', entry: { name: 'X' } }];
    const asPlayer = await patchCatalog(ops, playerToken);
    expect(asPlayer.statusCode).toBe(403);

    const anon = await app.inject({
      method: 'PATCH',
      url: '/talents-catalog',
      payload: { ops },
    });
    expect(anon.statusCode).toBe(401);
  });

  it('?orderBy=name returns entries alphabetically, folding case and accents', async () => {
    await patchCatalog([
      { action: 'add', slug: 'ord-z', entry: { name: 'Zulu' } },
      { action: 'add', slug: 'ord-a', entry: { name: 'ananas' } },
      { action: 'add', slug: 'ord-e', entry: { name: 'èlite' } },
    ]);
    const mine = (await listTalents('?orderBy=name'))
      .filter((e) => e.slug.startsWith('ord-'))
      .map((e) => e.name);
    expect(mine).toEqual(['ananas', 'èlite', 'Zulu']);
  });

  it('an unrecognised ?orderBy value falls back to natural order (no error)', async () => {
    const natural = await listTalents();
    const res = await app.inject({
      method: 'GET',
      url: '/talents-catalog?orderBy=bogus',
      headers: auth(adminToken),
    });
    expect(res.statusCode).toBe(200);
    expect((JSON.parse(res.body) as Entry[]).map((e) => e.slug)).toEqual(
      natural.map((e) => e.slug),
    );
  });
});
