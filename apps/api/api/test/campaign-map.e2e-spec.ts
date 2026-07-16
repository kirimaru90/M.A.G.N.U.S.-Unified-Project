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
import { CampaignMapModule } from '../src/campaign-map/campaign-map.module';
import { User, UserSchema } from '../src/users/schemas/user.schema';
import {
  Campaign,
  CampaignSchema,
} from '../src/campaigns/schemas/campaign.schema';
import configuration from '../src/config/configuration';

const CONFIG = {
  startLat: 41.9,
  startLng: 12.5,
  startZoom: 6,
  minZoom: 3,
  maxZoom: 18,
  bounds: { south: 35, west: 6, north: 48, east: 19 },
};

function place(over: Record<string, unknown> & { slug: string }) {
  return {
    name: over.slug,
    type: 'region',
    lat: 41.9,
    lng: 12.5,
    hasLocalMap: true,
    isPublic: true,
    parent: null,
    ...over,
  };
}

describe('CampaignMapModule (e2e)', () => {
  let app: NestFastifyApplication;
  let adminToken: string;
  let playerToken: string;
  let campaignId: string;
  let invisibleCampaignId: string;

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
        ]),
        AuthModule,
        UsersModule,
        CampaignsModule,
        CampaignMapModule,
      ],
    }).compile();
    app = await createTestApp(module);

    const userModel: Model<User> = module.get(getModelToken(User.name));
    const db = userModel.db.db!;
    for (const col of ['users', 'campaigns', 'campaignmaps']) {
      await db.collection(col).deleteMany({});
    }

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

    const login = async (username: string) => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { username, password: 'pass' },
      });
      return JSON.parse(res.body).accessToken as string;
    };
    adminToken = await login('admin');
    playerToken = await login('player');

    const create = async (payload: Record<string, unknown>) => {
      const res = await app.inject({
        method: 'POST',
        url: '/campaigns',
        headers: auth(adminToken),
        payload,
      });
      return JSON.parse(res.body).id as string;
    };
    campaignId = await create({ name: 'C1', isActive: true, isPublic: true });
    invisibleCampaignId = await create({
      name: 'C2',
      isActive: false,
      isPublic: false,
    });
  });

  afterAll(async () => {
    await app.close();
    await stopMongoMemoryServer();
  });

  const put = (token: string, payload: unknown, id = campaignId) =>
    app.inject({
      method: 'PUT',
      url: `/campaigns/${id}/map`,
      headers: auth(token),
      payload: payload as never,
    });

  const get = (token: string | null, id = campaignId) =>
    app.inject({
      method: 'GET',
      url: `/campaigns/${id}/map`,
      headers: token ? auth(token) : {},
    });

  describe('round-trip', () => {
    it('reads an unauthored campaign as an empty map', async () => {
      const res = await get(adminToken);
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).places).toEqual([]);
      expect(JSON.parse(res.body).config).toMatchObject({ minZoom: 3 });
    });

    it('round-trips a map written by an admin', async () => {
      const payload = {
        config: CONFIG,
        places: [place({ slug: 'rome', name: 'Roma', radius: 5000 })],
      };
      const wrote = await put(adminToken, payload);
      expect(wrote.statusCode).toBe(200);

      const res = await get(adminToken);
      const body = JSON.parse(res.body);
      expect(body.config).toMatchObject(CONFIG);
      expect(body.places).toHaveLength(1);
      expect(body.places[0]).toMatchObject({ slug: 'rome', name: 'Roma' });
    });
  });

  describe('the isPublic cascade over HTTP', () => {
    // This is the security boundary: the service spec proves the rule, but only
    // an HTTP assertion proves the rule is what the wire actually carries.
    beforeAll(async () => {
      await put(adminToken, {
        config: CONFIG,
        places: [
          place({ slug: 'open' }),
          place({ slug: 'bunker', isPublic: false }),
          place({ slug: 'room', parent: 'bunker' }),
          place({ slug: 'locker', parent: 'room' }),
        ],
      });
    });

    it('gives an admin every place', async () => {
      const body = JSON.parse((await get(adminToken)).body);
      expect(body.places.map((p: { slug: string }) => p.slug)).toEqual([
        'open',
        'bunker',
        'room',
        'locker',
      ]);
    });

    it('never puts a non-public place or its subtree on the wire for a player', async () => {
      const res = await get(playerToken);
      expect(res.statusCode).toBe(200);
      expect(
        JSON.parse(res.body).places.map((p: { slug: string }) => p.slug),
      ).toEqual(['open']);
      // Asserted against the raw body, not the parsed tree: the names must not
      // appear anywhere in the response at all.
      expect(res.body).not.toContain('bunker');
      expect(res.body).not.toContain('locker');
    });

    it('applies the same projection to an anonymous caller', async () => {
      const res = await get(null);
      expect(res.statusCode).toBe(200);
      expect(res.body).not.toContain('bunker');
    });
  });

  describe('guard matrix', () => {
    it('404s an anonymous read of an invisible campaign', async () => {
      const res = await get(null, invisibleCampaignId);
      expect(res.statusCode).toBe(404);
    });

    it('404s a player read of an invisible campaign, rather than 403', async () => {
      const res = await get(playerToken, invisibleCampaignId);
      expect(res.statusCode).toBe(404);
    });

    it('lets an admin read an invisible campaign', async () => {
      const res = await get(adminToken, invisibleCampaignId);
      expect(res.statusCode).toBe(200);
    });

    it('rejects a write by a player and leaves the stored map unchanged', async () => {
      const before = JSON.parse((await get(adminToken)).body);
      const res = await put(playerToken, {
        config: CONFIG,
        places: [place({ slug: 'pwned' })],
      });
      expect(res.statusCode).toBe(403);
      const after = JSON.parse((await get(adminToken)).body);
      expect(after.places).toEqual(before.places);
    });

    it('rejects an anonymous write with 401, not 403', async () => {
      // AdminGuard separates the two: unauthenticated is 401, authenticated
      // but not admin is 403 (asserted above for the player).
      const res = await app.inject({
        method: 'PUT',
        url: `/campaigns/${campaignId}/map`,
        payload: { config: CONFIG, places: [] },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('validation', () => {
    const expect400 = async (places: unknown[]) => {
      const res = await put(adminToken, { config: CONFIG, places });
      expect(res.statusCode).toBe(400);
    };

    it('rejects a type outside the enum', () =>
      expect400([place({ slug: 'a', type: 'spaceship' })]));

    it('rejects a duplicate slug', () =>
      expect400([place({ slug: 'a' }), place({ slug: 'a' })]));

    it('rejects a parent naming no place in the payload', () =>
      expect400([place({ slug: 'a', parent: 'ghost' })]));

    it('rejects a parent whose hasLocalMap is false', () =>
      expect400([
        place({ slug: 'pin', hasLocalMap: false }),
        place({ slug: 'a', parent: 'pin' }),
      ]));

    it('rejects a cyclic parent chain', () =>
      expect400([
        place({ slug: 'a', parent: 'b' }),
        place({ slug: 'b', parent: 'a' }),
      ]));

    it('rejects a longer cycle', () =>
      expect400([
        place({ slug: 'a', parent: 'c' }),
        place({ slug: 'b', parent: 'a' }),
        place({ slug: 'c', parent: 'b' }),
      ]));

    it('rejects a radius on a place with no local map', () =>
      expect400([place({ slug: 'pin', hasLocalMap: false, radius: 100 })]));

    it('rejects an out-of-range coordinate', () =>
      expect400([place({ slug: 'a', lat: 120 })]));

    it('rejects minZoom above maxZoom', async () => {
      const res = await put(adminToken, {
        config: { ...CONFIG, minZoom: 19, maxZoom: 18 },
        places: [],
      });
      expect(res.statusCode).toBe(400);
    });

    it('accepts a valid nested payload', async () => {
      const res = await put(adminToken, {
        config: CONFIG,
        places: [
          place({ slug: 'region', radius: 5000 }),
          place({ slug: 'vault', parent: 'region', radius: 300 }),
          place({ slug: 'pin', parent: 'vault', hasLocalMap: false }),
        ],
      });
      expect(res.statusCode).toBe(200);
    });
  });
});
