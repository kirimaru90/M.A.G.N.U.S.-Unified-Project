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
import { CodexModule } from '../src/codex/codex.module';
import { User, UserSchema } from '../src/users/schemas/user.schema';
import {
  Campaign,
  CampaignSchema,
} from '../src/campaigns/schemas/campaign.schema';
import configuration from '../src/config/configuration';

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */

describe('CodexModule (e2e)', () => {
  let app: NestFastifyApplication;
  let adminToken: string;
  let playerAToken: string;
  let playerBToken: string;
  let campaignId: string;
  let otherCampaignId: string;
  let charA: string;
  let charB: string;
  let charForeign: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const body = (res: { body: string }) => JSON.parse(res.body);
  const codexUrl = (cid = campaignId) => `/campaigns/${cid}/codex`;
  const playerUrl = (char: string, cid = campaignId) =>
    `/campaigns/${cid}/characters/${char}/codex`;

  type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';
  const call = (
    method: Method,
    url: string,
    token: string,
    payload?: unknown,
  ) =>
    app.inject({
      method,
      url,
      headers: auth(token),
      payload: payload as never,
    });

  async function createCharacter(cid: string, userId: string, name: string) {
    const res = await call('POST', `/campaigns/${cid}/characters`, adminToken, {
      name,
      userId,
    });
    return body(res).id as string;
  }

  async function adminCreate(
    payload: Record<string, unknown>,
    cid = campaignId,
  ) {
    const res = await call('POST', codexUrl(cid), adminToken, payload);
    expect(res.statusCode).toBe(201);
    return body(res);
  }

  async function playerCodex(token: string, char: string) {
    const res = await call('GET', playerUrl(char), token);
    expect(res.statusCode).toBe(200);
    return body(res) as Array<Record<string, any>>;
  }

  const ids = (list: Array<{ id: string }>) => list.map((e) => e.id);

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
        CodexModule,
      ],
    }).compile();

    app = await createTestApp(module);
    const userModel: Model<User> = module.get(getModelToken(User.name));
    const campaignModel: Model<Campaign> = module.get(
      getModelToken(Campaign.name),
    );

    const hash = await bcrypt.hash('pass', 12);
    await userModel.create({
      username: 'admin',
      passwordHash: hash,
      role: 'admin',
    });
    const playerA = await userModel.create({
      username: 'playerA',
      passwordHash: hash,
      role: 'player',
    });
    const playerB = await userModel.create({
      username: 'playerB',
      passwordHash: hash,
      role: 'player',
    });

    const login = async (username: string) => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { username, password: 'pass' },
      });
      return body(res).accessToken as string;
    };
    adminToken = await login('admin');
    playerAToken = await login('playerA');
    playerBToken = await login('playerB');

    const camp = await campaignModel.create({
      name: 'Wasteland',
      isActive: true,
      isPublic: false,
      players: [playerA._id, playerB._id],
    });
    campaignId = String(camp._id);
    const other = await campaignModel.create({
      name: 'Elsewhere',
      isActive: true,
      isPublic: false,
      players: [playerA._id],
    });
    otherCampaignId = String(other._id);

    charA = await createCharacter(campaignId, String(playerA._id), 'Alice');
    charB = await createCharacter(campaignId, String(playerB._id), 'Nick');
    charForeign = await createCharacter(
      otherCampaignId,
      String(playerA._id),
      'Stranger',
    );
  });

  afterAll(async () => {
    await app.close();
    await stopMongoMemoryServer();
  });

  describe('admin CRUD', () => {
    it('creates with master defaults and never leaks _id/__v/campaignId', async () => {
      const created = await adminCreate({
        type: 'fazione',
        name: "Confraternita d'Acciaio",
        secretDescription: 'shh',
      });
      expect(created).toMatchObject({
        type: 'fazione',
        isEditable: false,
        isPublic: false,
        visibleToCharacterIds: [],
        createdByCharacterId: null,
        isDeleted: false,
        deletedAt: null,
        deletedByCharacterId: null,
        secretDescription: 'shh',
        mapPlaceSlug: null,
      });
      for (const key of ['_id', '__v', 'campaignId'])
        expect(created).not.toHaveProperty(key);

      const got = await call('GET', `${codexUrl()}/${created.id}`, adminToken);
      expect(body(got).id).toBe(created.id);

      const patched = await call(
        'PATCH',
        `${codexUrl()}/${created.id}`,
        adminToken,
        {
          visibleToCharacterIds: [charA, charB],
          isEditable: true,
          mapPlaceSlug: 'prydwen',
        },
      );
      expect(patched.statusCode).toBe(200);
      expect(body(patched)).toMatchObject({
        visibleToCharacterIds: [charA, charB],
        isEditable: true,
        mapPlaceSlug: 'prydwen',
      });
      expect(body(patched).characters).toEqual([
        { id: charA, name: 'Alice', deleted: false },
        { id: charB, name: 'Nick', deleted: false },
      ]);

      const del = await call(
        'DELETE',
        `${codexUrl()}/${created.id}`,
        adminToken,
      );
      expect(del.statusCode).toBe(204);
      const gone = await call('GET', `${codexUrl()}/${created.id}`, adminToken);
      expect(gone.statusCode).toBe(404);
    });

    it('rejects an unknown type and a non-http image URL', async () => {
      expect(
        (
          await call('POST', codexUrl(), adminToken, {
            type: 'oggetto',
            name: 'X',
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await call('POST', codexUrl(), adminToken, {
            type: 'luogo',
            name: 'X',
            imageUrl: 'javascript:alert(1)',
          })
        ).statusCode,
      ).toBe(400);
    });

    it('rejects a character from another campaign', async () => {
      const res = await call('POST', codexUrl(), adminToken, {
        type: 'luogo',
        name: 'Nowhere',
        visibleToCharacterIds: [charForeign],
      });
      expect(res.statusCode).toBe(400);
    });

    it('404s an entry addressed through another campaign', async () => {
      const e = await adminCreate({ type: 'luogo', name: 'Concord' });
      const res = await call(
        'GET',
        `${codexUrl(otherCampaignId)}/${e.id}`,
        adminToken,
      );
      expect(res.statusCode).toBe(404);
    });

    it('403s a player on admin routes', async () => {
      const res = await call('GET', codexUrl(), playerAToken);
      expect(res.statusCode).toBe(403);
    });

    it('sorts by name, Italian-collated', async () => {
      const cid = otherCampaignId;
      for (const name of ['zeta', 'Àncora', 'beta'])
        await adminCreate({ type: 'luogo', name }, cid);
      const list = body(await call('GET', codexUrl(cid), adminToken));
      expect(list.map((e: { name: string }) => e.name)).toEqual([
        'Àncora',
        'beta',
        'zeta',
      ]);
    });
  });

  describe('player projection', () => {
    let pub: string;
    let listedA: string;
    let unlisted: string;

    beforeAll(async () => {
      pub = (
        await adminCreate({
          type: 'luogo',
          name: 'Diamond City',
          isPublic: true,
          secretDescription: 'shh',
        })
      ).id;
      listedA = (
        await adminCreate({
          type: 'personaggio',
          name: 'Piper',
          visibleToCharacterIds: [charA],
        })
      ).id;
      unlisted = (await adminCreate({ type: 'creatura', name: 'Deathclaw' }))
        .id;
    });

    it('shows public to everyone and listed only to the listed', async () => {
      const a = await playerCodex(playerAToken, charA);
      const b = await playerCodex(playerBToken, charB);
      expect(ids(a)).toEqual(expect.arrayContaining([pub, listedA]));
      expect(ids(a)).not.toContain(unlisted);
      expect(ids(b)).toContain(pub);
      expect(ids(b)).not.toContain(listedA);
    });

    it('never returns master-only or delete fields, even to an admin', async () => {
      for (const list of [
        await playerCodex(playerAToken, charA),
        await playerCodex(adminToken, charA),
      ]) {
        for (const e of list) {
          for (const key of [
            'secretDescription',
            'visibleToCharacterIds',
            'createdByCharacterId',
            'isDeleted',
            'deletedAt',
            'deletedByCharacterId',
          ])
            expect(e).not.toHaveProperty(key);
          expect(e).toHaveProperty('isOwn');
        }
      }
    });

    it('stops showing an entry made private again to unlisted characters', async () => {
      const e = await adminCreate({
        type: 'fazione',
        name: 'Railroad',
        isPublic: true,
        visibleToCharacterIds: [charA],
      });
      expect(ids(await playerCodex(playerBToken, charB))).toContain(e.id);
      await call('PATCH', `${codexUrl()}/${e.id}`, adminToken, {
        isPublic: false,
      });
      expect(ids(await playerCodex(playerBToken, charB))).not.toContain(e.id);
      expect(ids(await playerCodex(playerAToken, charA))).toContain(e.id);
    });

    it('404s a non-owner and a character of another campaign', async () => {
      expect(
        (await call('GET', playerUrl(charB), playerAToken)).statusCode,
      ).toBe(404);
      expect(
        (await call('GET', playerUrl(charForeign), adminToken)).statusCode,
      ).toBe(404);
    });
  });

  describe('player writes', () => {
    it('creates a private own entry and rejects master-only fields', async () => {
      const res = await call('POST', playerUrl(charA), playerAToken, {
        type: 'creatura',
        name: 'Mirelurk',
      });
      expect(res.statusCode).toBe(201);
      const e = body(res);
      expect(e).toMatchObject({
        isOwn: true,
        isEditable: true,
        isPublic: false,
      });
      expect(ids(await playerCodex(playerBToken, charB))).not.toContain(e.id);

      const admin = body(
        await call('GET', `${codexUrl()}/${e.id}`, adminToken),
      );
      expect(admin).toMatchObject({
        visibleToCharacterIds: [charA],
        createdByCharacterId: charA,
      });

      for (const extra of [
        { secretDescription: 'x' },
        { visibleToCharacterIds: [charB] },
        { isEditable: false },
      ]) {
        const bad = await call('POST', playerUrl(charA), playerAToken, {
          type: 'creatura',
          name: 'Bloatfly',
          ...extra,
        });
        expect(bad.statusCode).toBe(400);
      }
    });

    it('lets any viewer edit an editable entry and toggle it public', async () => {
      const e = body(
        await call('POST', playerUrl(charA), playerAToken, {
          type: 'luogo',
          name: 'Sanctuary',
        }),
      );
      const pubRes = await call(
        'PATCH',
        `${playerUrl(charA)}/${e.id}`,
        playerAToken,
        {
          isPublic: true,
        },
      );
      expect(pubRes.statusCode).toBe(200);
      expect(ids(await playerCodex(playerBToken, charB))).toContain(e.id);

      const edit = await call(
        'PATCH',
        `${playerUrl(charB)}/${e.id}`,
        playerBToken,
        {
          description: 'Casa',
        },
      );
      expect(edit.statusCode).toBe(200);
      expect(body(edit)).toMatchObject({ description: 'Casa', isOwn: false });
    });

    it('answers 204 when B unpublishes an entry it saw only through public', async () => {
      const e = body(
        await call('POST', playerUrl(charA), playerAToken, {
          type: 'luogo',
          name: 'Red Rocket',
          isPublic: true,
        }),
      );
      const res = await call(
        'PATCH',
        `${playerUrl(charB)}/${e.id}`,
        playerBToken,
        {
          isPublic: false,
        },
      );
      expect(res.statusCode).toBe(204);
      expect(res.body).toBe('');
      expect(ids(await playerCodex(playerBToken, charB))).not.toContain(e.id);
      expect(ids(await playerCodex(playerAToken, charA))).toContain(e.id);
    });

    it('403s a locked visible entry, 404s an invisible one', async () => {
      const locked = await adminCreate({
        type: 'luogo',
        name: 'Prydwen',
        isPublic: true,
      });
      const hidden = await adminCreate({
        type: 'luogo',
        name: 'Institute',
        isEditable: true,
      });
      expect(
        (
          await call(
            'PATCH',
            `${playerUrl(charA)}/${locked.id}`,
            playerAToken,
            { name: 'x' },
          )
        ).statusCode,
      ).toBe(403);
      expect(
        (await call('DELETE', `${playerUrl(charA)}/${locked.id}`, playerAToken))
          .statusCode,
      ).toBe(403);
      expect(
        (
          await call(
            'PATCH',
            `${playerUrl(charA)}/${hidden.id}`,
            playerAToken,
            { name: 'x' },
          )
        ).statusCode,
      ).toBe(404);
      // An admin through the character route bypasses the lock, not visibility.
      expect(
        (
          await call('PATCH', `${playerUrl(charA)}/${locked.id}`, adminToken, {
            description: 'ok',
          })
        ).statusCode,
      ).toBe(200);
      expect(
        (
          await call('PATCH', `${playerUrl(charA)}/${hidden.id}`, adminToken, {
            description: 'ok',
          })
        ).statusCode,
      ).toBe(404);
    });

    it('soft-deletes: gone for players, kept and restorable for the admin', async () => {
      const e = body(
        await call('POST', playerUrl(charA), playerAToken, {
          type: 'creatura',
          name: 'Radscorpion',
          isPublic: true,
        }),
      );
      const del = await call(
        'DELETE',
        `${playerUrl(charB)}/${e.id}`,
        playerBToken,
      );
      expect(del.statusCode).toBe(204);
      expect(ids(await playerCodex(playerAToken, charA))).not.toContain(e.id);
      expect(
        (
          await call('PATCH', `${playerUrl(charA)}/${e.id}`, playerAToken, {
            name: 'x',
          })
        ).statusCode,
      ).toBe(404);
      expect(
        (await call('DELETE', `${playerUrl(charA)}/${e.id}`, playerAToken))
          .statusCode,
      ).toBe(404);

      const list = body(await call('GET', codexUrl(), adminToken));
      const stored = list.find((x: { id: string }) => x.id === e.id);
      expect(stored).toMatchObject({
        isDeleted: true,
        deletedByCharacterId: charB,
      });
      expect(stored.deletedAt).toBeTruthy();

      const restored = await call(
        'PATCH',
        `${codexUrl()}/${e.id}`,
        adminToken,
        {
          isDeleted: false,
        },
      );
      expect(body(restored)).toMatchObject({
        isDeleted: false,
        deletedAt: null,
        deletedByCharacterId: null,
      });
      expect(ids(await playerCodex(playerAToken, charA))).toContain(e.id);
    });
  });

  describe('export and import', () => {
    it('re-importing an export into the same campaign adds nothing', async () => {
      const exported = body(
        await call('GET', `${codexUrl()}/export`, adminToken),
      );
      expect(exported.length).toBeGreaterThan(0);
      for (const item of exported) {
        for (const key of ['_id', '__v', 'campaignId'])
          expect(item).not.toHaveProperty(key);
        expect(item).toHaveProperty('secretDescription');
        expect(item).toHaveProperty('isDeleted');
      }
      const res = await call('POST', `${codexUrl()}/import`, adminToken, {
        entries: exported,
      });
      expect(res.statusCode).toBe(200);
      const out = body(res);
      expect(out.added).toBe(0);
      expect(out.skipped).toHaveLength(exported.length);
      expect(
        new Set(out.skipped.map((s: { reason: string }) => s.reason)),
      ).toEqual(new Set(['collision']));
    });

    it('imports into another campaign, dropping foreign character ids', async () => {
      const exported = body(
        await call('GET', `${codexUrl()}/export`, adminToken),
      );
      const piper = exported.find((e: { name: string }) => e.name === 'Piper');
      expect(piper.visibleToCharacterIds).toEqual([charA]);

      const res = await call(
        'POST',
        `${codexUrl(otherCampaignId)}/import`,
        adminToken,
        {
          entries: [
            piper,
            { type: 'luogo', name: 'diamond  city' },
            { name: 'no type' },
            { type: 'oggetto', name: 'Pistola' },
          ],
        },
      );
      const out = body(res);
      expect(out.added).toBe(2);
      expect(out.skipped.map((s: { reason: string }) => s.reason)).toEqual([
        'invalid',
        'invalid',
      ]);

      const list = body(
        await call('GET', codexUrl(otherCampaignId), adminToken),
      );
      const imported = list.find((e: { id: string }) => e.id === piper.id);
      expect(imported).toMatchObject({
        name: 'Piper',
        visibleToCharacterIds: [],
      });

      // A name already in the target campaign collides, accent- and space-insensitive.
      const again = body(
        await call('POST', `${codexUrl(otherCampaignId)}/import`, adminToken, {
          entries: [{ type: 'luogo', name: 'Diamond City' }],
        }),
      );
      expect(again).toEqual({
        added: 0,
        skipped: [{ index: 0, name: 'Diamond City', reason: 'collision' }],
      });
    });

    it('400s an import body without an entries array', async () => {
      const res = await call('POST', `${codexUrl()}/import`, adminToken, {
        entries: {},
      });
      expect(res.statusCode).toBe(400);
    });
  });
});
