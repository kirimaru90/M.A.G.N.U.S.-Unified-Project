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
import { TagCatalogModule } from '../src/tag-catalog/tag-catalog.module';
import { DEFAULT_TAG_CATALOG } from '../src/tag-catalog/tag-catalog-bootstrap.service';
import { User, UserSchema } from '../src/users/schemas/user.schema';
import configuration from '../src/config/configuration';

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

type CatalogEntry = { slug: string; name: string };

describe('TagCatalogModule (e2e)', () => {
  let app: NestFastifyApplication;
  let adminToken: string;
  let playerToken: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const listTags = async (token = adminToken) =>
    JSON.parse(
      (
        await app.inject({
          method: 'GET',
          url: '/tag-catalog',
          headers: auth(token),
        })
      ).body,
    ) as CatalogEntry[];

  const patchCatalog = (ops: unknown[], token = adminToken) =>
    app.inject({
      method: 'PATCH',
      url: '/tag-catalog',
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
        TagCatalogModule,
      ],
    }).compile();

    // init() fires OnApplicationBootstrap against an empty database, exercising seeding.
    app = await createTestApp(module);

    const userModel: Model<User> = module.get(getModelToken(User.name));
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

  it('seeds the default tags on a fresh, empty startup', async () => {
    const entries = await listTags();
    expect(entries).toHaveLength(DEFAULT_TAG_CATALOG.length);
    expect(entries.every((e) => e.slug && e.name)).toBe(true);
  });

  it('returns the seeded catalog to an authenticated player', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/tag-catalog',
      headers: auth(playerToken),
    });
    expect(res.statusCode).toBe(200);
  });

  it('rejects an anonymous GET → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/tag-catalog' });
    expect(res.statusCode).toBe(401);
  });

  it('admin add mutates the catalog', async () => {
    const res = await patchCatalog([
      { action: 'add', slug: 'automatica-e2e', entry: { name: 'Automatica' } },
    ]);
    expect(res.statusCode).toBe(200);
    const entry = (await listTags()).find((e) => e.slug === 'automatica-e2e');
    expect(entry).toEqual({ slug: 'automatica-e2e', name: 'Automatica' });
  });

  it('duplicate slug on add → 409', async () => {
    const first = DEFAULT_TAG_CATALOG[0];
    const res = await patchCatalog([
      { action: 'add', slug: first.slug, entry: { name: first.name } },
    ]);
    expect(res.statusCode).toBe(409);
  });

  it('unknown slug on delete → 200 with unknown_slug in ignored', async () => {
    const res = await patchCatalog([{ action: 'delete', slug: 'nonesuch' }]);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).ignored).toEqual([
      { slug: 'nonesuch', reason: 'unknown_slug' },
    ]);
  });

  it('non-admin PATCH → 403', async () => {
    const res = await patchCatalog(
      [{ action: 'add', slug: 'forbidden', entry: { name: 'Nope' } }],
      playerToken,
    );
    expect(res.statusCode).toBe(403);
  });

  it('?orderBy=name returns entries alphabetically, folding case and accents', async () => {
    await patchCatalog([
      { action: 'add', slug: 'ord-z', entry: { name: 'Zulu' } },
      { action: 'add', slug: 'ord-a', entry: { name: 'ananas' } },
      { action: 'add', slug: 'ord-e', entry: { name: 'èlite' } },
    ]);
    const ordered = await app.inject({
      method: 'GET',
      url: '/tag-catalog?orderBy=name',
      headers: auth(adminToken),
    });
    const mine = (JSON.parse(ordered.body) as CatalogEntry[])
      .filter((e) => e.slug.startsWith('ord-'))
      .map((e) => e.name);
    expect(mine).toEqual(['ananas', 'èlite', 'Zulu']);
  });

  it('an unrecognised ?orderBy value falls back to natural order (no error)', async () => {
    const natural = await listTags();
    const res = await app.inject({
      method: 'GET',
      url: '/tag-catalog?orderBy=bogus',
      headers: auth(adminToken),
    });
    expect(res.statusCode).toBe(200);
    expect((JSON.parse(res.body) as CatalogEntry[]).map((e) => e.slug)).toEqual(
      natural.map((e) => e.slug),
    );
  });
});
