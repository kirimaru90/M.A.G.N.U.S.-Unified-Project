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
import { QuestsModule } from '../src/quests/quests.module';
import { User, UserSchema } from '../src/users/schemas/user.schema';
import {
  Campaign,
  CampaignSchema,
} from '../src/campaigns/schemas/campaign.schema';
import { Character } from '../src/characters/schemas/character.schema';
import configuration from '../src/config/configuration';

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */

describe('QuestsModule (e2e)', () => {
  let app: NestFastifyApplication;
  let characterModel: Model<Character>;
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
  const questsUrl = (cid = campaignId) => `/campaigns/${cid}/quests`;
  const playerUrl = (char: string) =>
    `/campaigns/${campaignId}/characters/${char}/quests`;

  async function createCharacter(cid: string, userId: string, name: string) {
    const res = await app.inject({
      method: 'POST',
      url: `/campaigns/${cid}/characters`,
      headers: auth(adminToken),
      payload: { name, userId },
    });
    return body(res).id as string;
  }

  async function createQuest(payload: Record<string, unknown>) {
    const res = await app.inject({
      method: 'POST',
      url: questsUrl(),
      headers: auth(adminToken),
      payload,
    });
    expect(res.statusCode).toBe(201);
    return body(res);
  }

  async function playerQuests(token: string, char: string) {
    const res = await app.inject({
      method: 'GET',
      url: playerUrl(char),
      headers: auth(token),
    });
    expect(res.statusCode).toBe(200);
    return body(res) as Array<Record<string, any>>;
  }

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
        QuestsModule,
      ],
    }).compile();

    app = await createTestApp(module);
    const userModel: Model<User> = module.get(getModelToken(User.name));
    const campaignModel: Model<Campaign> = module.get(
      getModelToken(Campaign.name),
    );
    characterModel = module.get(getModelToken(Character.name));

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
    it('round-trips a quest and its stages', async () => {
      const created = await createQuest({
        kind: 'story',
        isPublic: true,
        stage: {
          title: 'Un segnale strano',
          status: 'in_corso',
          isPublic: true,
        },
      });
      expect(created).toMatchObject({
        kind: 'story',
        isPublic: true,
        characterIds: [],
        characters: [],
      });
      expect(created).not.toHaveProperty('_id');
      expect(created).not.toHaveProperty('__v');
      expect(created.stages).toHaveLength(1);
      expect(created.stages[0].revealedAt).toBeTruthy();
      const qid = created.id;

      // list + get
      const list = await app.inject({
        method: 'GET',
        url: questsUrl(),
        headers: auth(adminToken),
      });
      expect(body(list).map((q: { id: string }) => q.id)).toContain(qid);
      const got = await app.inject({
        method: 'GET',
        url: `${questsUrl()}/${qid}`,
        headers: auth(adminToken),
      });
      expect(body(got).id).toBe(qid);

      // append two stages
      for (const title of ['Due', 'Tre']) {
        const res = await app.inject({
          method: 'POST',
          url: `${questsUrl()}/${qid}/stages`,
          headers: auth(adminToken),
          payload: { title },
        });
        expect(res.statusCode).toBe(201);
      }
      const after = body(
        await app.inject({
          method: 'GET',
          url: `${questsUrl()}/${qid}`,
          headers: auth(adminToken),
        }),
      );
      expect(after.stages.map((s: { title: string }) => s.title)).toEqual([
        'Un segnale strano',
        'Due',
        'Tre',
      ]);
      const [s1, s2, s3] = after.stages;

      // patch a past stage in place
      const patched = await app.inject({
        method: 'PATCH',
        url: `${questsUrl()}/${qid}/stages/${s1.id}`,
        headers: auth(adminToken),
        payload: { description: 'corretto' },
      });
      expect(patched.statusCode).toBe(200);
      expect(body(patched).stages[0].description).toBe('corretto');
      expect(body(patched).stages.map((s: { id: string }) => s.id)).toEqual([
        s1.id,
        s2.id,
        s3.id,
      ]);

      // delete non-last → 409, unknown → 404, last → ok
      const nonLast = await app.inject({
        method: 'DELETE',
        url: `${questsUrl()}/${qid}/stages/${s2.id}`,
        headers: auth(adminToken),
      });
      expect(nonLast.statusCode).toBe(409);
      const unknown = await app.inject({
        method: 'DELETE',
        url: `${questsUrl()}/${qid}/stages/nope`,
        headers: auth(adminToken),
      });
      expect(unknown.statusCode).toBe(404);
      const last = await app.inject({
        method: 'DELETE',
        url: `${questsUrl()}/${qid}/stages/${s3.id}`,
        headers: auth(adminToken),
      });
      expect(last.statusCode).toBe(200);
      expect(body(last).stages).toHaveLength(2);

      // header patch: story → personal
      const switched = await app.inject({
        method: 'PATCH',
        url: `${questsUrl()}/${qid}`,
        headers: auth(adminToken),
        payload: { kind: 'personal', characterIds: [charA] },
      });
      expect(switched.statusCode).toBe(200);
      expect(body(switched)).toMatchObject({
        kind: 'personal',
        isPublic: false,
        characterIds: [charA],
        characters: [{ id: charA, name: 'Alice', deleted: false }],
      });

      // delete quest
      const del = await app.inject({
        method: 'DELETE',
        url: `${questsUrl()}/${qid}`,
        headers: auth(adminToken),
      });
      expect(del.statusCode).toBe(204);
      const gone = await app.inject({
        method: 'GET',
        url: `${questsUrl()}/${qid}`,
        headers: auth(adminToken),
      });
      expect(gone.statusCode).toBe(404);
    });

    it('rejects a quest without a first stage', async () => {
      const res = await app.inject({
        method: 'POST',
        url: questsUrl(),
        headers: auth(adminToken),
        payload: { kind: 'story' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects a personal quest naming a character of another campaign', async () => {
      const res = await app.inject({
        method: 'POST',
        url: questsUrl(),
        headers: auth(adminToken),
        payload: {
          kind: 'personal',
          characterIds: [charForeign],
          stage: { title: 'X' },
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('does not address a quest through another campaign', async () => {
      const q = await createQuest({ kind: 'story', stage: { title: 'X' } });
      const res = await app.inject({
        method: 'GET',
        url: `${questsUrl(otherCampaignId)}/${q.id}`,
        headers: auth(adminToken),
      });
      expect(res.statusCode).toBe(404);
    });

    it('rejects non-admins on admin routes', async () => {
      const q = await createQuest({ kind: 'story', stage: { title: 'X' } });
      const attempts = [
        { method: 'GET' as const, url: questsUrl() },
        { method: 'GET' as const, url: `${questsUrl()}/${q.id}` },
        {
          method: 'POST' as const,
          url: questsUrl(),
          payload: { kind: 'story', stage: { title: 'Y' } },
        },
        {
          method: 'PATCH' as const,
          url: `${questsUrl()}/${q.id}`,
          payload: { isPublic: true },
        },
        { method: 'DELETE' as const, url: `${questsUrl()}/${q.id}` },
      ];
      for (const a of attempts) {
        const res = await app.inject({ ...a, headers: auth(playerAToken) });
        expect(res.statusCode).toBeGreaterThanOrEqual(400);
        expect(res.statusCode).toBeLessThan(500);
      }
      const still = await app.inject({
        method: 'GET',
        url: `${questsUrl()}/${q.id}`,
        headers: auth(adminToken),
      });
      expect(body(still).isPublic).toBe(false);
    });
  });

  describe('player read', () => {
    let publicStory: string;
    let hiddenStory: string;
    let shared: string;
    let onlyB: string;

    beforeAll(async () => {
      publicStory = (
        await createQuest({
          kind: 'story',
          isPublic: true,
          stage: { title: 'Storia', isPublic: true },
        })
      ).id;
      hiddenStory = (
        await createQuest({
          kind: 'story',
          isPublic: false,
          stage: { title: 'Nascosta', isPublic: true },
        })
      ).id;
      shared = (
        await createQuest({
          kind: 'personal',
          characterIds: [charA, charB],
          stage: { title: 'Insieme', isPublic: true },
        })
      ).id;
      onlyB = (
        await createQuest({
          kind: 'personal',
          characterIds: [charB],
          stage: { title: 'Solo B', isPublic: true },
        })
      ).id;
    });

    it('returns the owner the right set, projected', async () => {
      const quests = await playerQuests(playerAToken, charA);
      const ids = quests.map((q) => q.id);
      expect(ids).toContain(publicStory);
      expect(ids).toContain(shared);
      expect(ids).not.toContain(hiddenStory);
      expect(ids).not.toContain(onlyB);

      const s = quests.find((q) => q.id === shared)!;
      expect(s.involved).toEqual([{ id: charB, name: 'Nick' }]);
      expect(s).not.toHaveProperty('characterIds');
      expect(s).not.toHaveProperty('isPublic');
      expect(s.current.title).toBe('Insieme');
    });

    it('returns an admin the same projection as the owner', async () => {
      const asAdmin = await playerQuests(adminToken, charA);
      const asOwner = await playerQuests(playerAToken, charA);
      expect(asAdmin).toEqual(asOwner);
    });

    it("rejects another player's character with 404", async () => {
      const res = await app.inject({
        method: 'GET',
        url: playerUrl(charB),
        headers: auth(playerAToken),
      });
      expect(res.statusCode).toBe(404);
    });

    it('rejects a character from another campaign with 404', async () => {
      const res = await app.inject({
        method: 'GET',
        url: playerUrl(charForeign),
        headers: auth(playerAToken),
      });
      expect(res.statusCode).toBe(404);
    });

    it('rejects unauthenticated reads with 401', async () => {
      const res = await app.inject({ method: 'GET', url: playerUrl(charA) });
      expect(res.statusCode).toBe(401);
    });

    it('appending a hidden stage leaves the player response identical', async () => {
      const before = await app.inject({
        method: 'GET',
        url: playerUrl(charB),
        headers: auth(playerBToken),
      });
      const add = await app.inject({
        method: 'POST',
        url: `${questsUrl()}/${shared}/stages`,
        headers: auth(adminToken),
        payload: { title: 'Bozza segreta', status: 'completata' },
      });
      expect(add.statusCode).toBe(201);
      const after = await app.inject({
        method: 'GET',
        url: playerUrl(charB),
        headers: auth(playerBToken),
      });
      expect(after.body).toBe(before.body);
      expect(after.body).not.toContain('Bozza segreta');
    });

    it('drops a soft-deleted co-holder from involved', async () => {
      await characterModel.updateOne({ _id: charB }, { isDeleted: true });
      const quests = await playerQuests(playerAToken, charA);
      expect(quests.find((q) => q.id === shared)!.involved).toEqual([]);

      const admin = await app.inject({
        method: 'GET',
        url: `${questsUrl()}/${shared}`,
        headers: auth(adminToken),
      });
      expect(body(admin).characterIds).toContain(charB);
      expect(body(admin).characters).toContainEqual({
        id: charB,
        name: 'Nick',
        deleted: true,
      });
      await characterModel.updateOne({ _id: charB }, { isDeleted: false });
    });
  });

  describe('player writes', () => {
    const send = (
      method: 'POST' | 'PATCH' | 'DELETE',
      url: string,
      token: string,
      payload?: Record<string, unknown>,
    ) => app.inject({ method, url, headers: auth(token), payload });

    async function playerCreate(title: string) {
      const res = await send('POST', playerUrl(charA), playerAToken, {
        stage: { title, reward: 'tappi' },
      });
      expect(res.statusCode).toBe(201);
      return body(res);
    }

    it('creates a personal quest held by the character, public and own', async () => {
      const q = await playerCreate('La mia pista');
      expect(q.kind).toBe('personal');
      expect(q.isOwn).toBe(true);
      expect(q.involved).toEqual([]);
      expect(q.current).toMatchObject({
        title: 'La mia pista',
        reward: 'tappi',
      });
      expect(q.current.revealedAt).not.toBeNull();

      const admin = body(
        await send('GET', `${questsUrl()}/${q.id}`, adminToken),
      );
      expect(admin.characterIds).toEqual([charA]);
      expect(admin.createdByCharacterId).toBe(charA);
      expect(admin.stages[0].isPublic).toBe(true);
    });

    it('rejects isPublic in a player stage body', async () => {
      const res = await send('POST', playerUrl(charA), playerAToken, {
        stage: { title: 'X', isPublic: false },
      });
      expect(res.statusCode).toBe(400);
    });

    it('adds a stage before the master drafts and edits public stages only', async () => {
      const q = await createQuest({
        kind: 'personal',
        characterIds: [charA],
        stage: { title: 'Dal master', isPublic: true },
      });
      const draft = body(
        await send('POST', `${questsUrl()}/${q.id}/stages`, adminToken, {
          title: 'Bozza',
        }),
      ).stages[1];

      const added = await send(
        'POST',
        `${playerUrl(charA)}/${q.id}/stages`,
        playerAToken,
        { title: 'Mio passo', status: 'standby' },
      );
      expect(added.statusCode).toBe(201);
      const projected = body(added);
      expect(projected.isOwn).toBe(false);
      expect(projected.current.title).toBe('Mio passo');
      expect(added.body).not.toContain('Bozza');

      const admin = body(
        await send('GET', `${questsUrl()}/${q.id}`, adminToken),
      );
      expect(admin.stages.map((s: { title: string }) => s.title)).toEqual([
        'Dal master',
        'Mio passo',
        'Bozza',
      ]);

      const edit = await send(
        'PATCH',
        `${playerUrl(charA)}/${q.id}/stages/${projected.stages[0].id}`,
        playerAToken,
        { title: 'Dal master, corretto' },
      );
      expect(edit.statusCode).toBe(200);
      expect(body(edit).stages[0].title).toBe('Dal master, corretto');

      const hidden = await send(
        'PATCH',
        `${playerUrl(charA)}/${q.id}/stages/${draft.id}`,
        playerAToken,
        { title: 'Spoiler' },
      );
      expect(hidden.statusCode).toBe(404);
    });

    it('deletes only the last public stage, never the only one', async () => {
      const q = await playerCreate('Due passi');
      const first = q.current.id;
      const only = await send(
        'DELETE',
        `${playerUrl(charA)}/${q.id}/stages/${first}`,
        playerAToken,
      );
      expect(only.statusCode).toBe(409);

      const second = body(
        await send('POST', `${playerUrl(charA)}/${q.id}/stages`, playerAToken, {
          title: 'Secondo',
        }),
      ).current.id;
      const earlier = await send(
        'DELETE',
        `${playerUrl(charA)}/${q.id}/stages/${first}`,
        playerAToken,
      );
      expect(earlier.statusCode).toBe(409);
      const last = await send(
        'DELETE',
        `${playerUrl(charA)}/${q.id}/stages/${second}`,
        playerAToken,
      );
      expect(last.statusCode).toBe(200);
      expect(body(last).stages).toHaveLength(1);
    });

    it('deletes a quest the character created, not one the master assigned', async () => {
      const own = await playerCreate('Da buttare');
      const assigned = await createQuest({
        kind: 'personal',
        characterIds: [charA],
        stage: { title: 'Assegnata', isPublic: true },
      });

      const forbidden = await send(
        'DELETE',
        `${playerUrl(charA)}/${assigned.id}`,
        playerAToken,
      );
      expect(forbidden.statusCode).toBe(403);

      const ok = await send(
        'DELETE',
        `${playerUrl(charA)}/${own.id}`,
        playerAToken,
      );
      expect(ok.statusCode).toBe(204);
      const ids = (await playerQuests(playerAToken, charA)).map((q) => q.id);
      expect(ids).not.toContain(own.id);
      expect(ids).toContain(assigned.id);
    });

    it('cannot touch story quests or quests of other characters', async () => {
      const story = await createQuest({
        kind: 'story',
        isPublic: true,
        stage: { title: 'Storia comune', isPublic: true },
      });
      const notMine = await createQuest({
        kind: 'personal',
        characterIds: [charB],
        stage: { title: 'Di Nick', isPublic: true },
      });
      for (const id of [story.id, notMine.id]) {
        const res = await send(
          'POST',
          `${playerUrl(charA)}/${id}/stages`,
          playerAToken,
          { title: 'Intruso' },
        );
        expect(res.statusCode).toBe(404);
      }
      const otherChar = await send('POST', playerUrl(charB), playerAToken, {
        stage: { title: 'Furto' },
      });
      expect(otherChar.statusCode).toBe(404);
    });
  });
});
