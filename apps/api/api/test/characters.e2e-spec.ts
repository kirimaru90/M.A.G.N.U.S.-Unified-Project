import { Test } from '@nestjs/testing';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
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
import { Character } from '../src/characters/schemas/character.schema';
import configuration from '../src/config/configuration';

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */

describe('CharactersModule (e2e)', () => {
  let app: NestFastifyApplication;
  let userModel: Model<User>;
  let campaignModel: Model<Campaign>;
  let characterModel: Model<Character>;
  let adminToken: string;
  let playerAToken: string;
  let playerBToken: string;
  let playerAId: string;
  let playerBId: string;
  let campaignId: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  /**
   * Section PATCHes answer with the `{ section, ignored }` envelope
   * (api-character-stats). These unwrap it so assertions read the mutated
   * section, and the dropped-input list, directly.
   */
  const sectionOf = (res: { body: string }) => JSON.parse(res.body).section;
  const ignoredOf = (res: { body: string }) => JSON.parse(res.body).ignored;

  // Create a character owned by `userId` (via admin) and return its id.
  async function createCharacter(userId: string, name = 'Dweller') {
    const res = await app.inject({
      method: 'POST',
      url: `/campaigns/${campaignId}/characters`,
      headers: auth(adminToken),
      payload: { name, userId },
    });
    return JSON.parse(res.body).id as string;
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
      ],
    }).compile();

    app = await createTestApp(module);
    userModel = module.get(getModelToken(User.name));
    campaignModel = module.get(getModelToken(Campaign.name));
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
    playerAId = String(playerA._id);
    playerBId = String(playerB._id);

    const login = async (username: string) => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { username, password: 'pass' },
      });
      return JSON.parse(res.body).accessToken as string;
    };
    adminToken = await login('admin');
    playerAToken = await login('playerA');
    playerBToken = await login('playerB');

    // Active campaign with both players as members.
    const camp = await campaignModel.create({
      name: 'Wasteland',
      isActive: true,
      isPublic: false,
      players: [playerA._id, playerB._id],
    });
    campaignId = String(camp._id);
  });

  afterAll(async () => {
    await app.close();
    await stopMongoMemoryServer();
  });

  // --- 8.1 Route registration (Swagger) ---

  it('exposes all 12 character routes in Swagger', () => {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    const charPaths = Object.entries(doc.paths).filter(([p]) =>
      p.startsWith('/campaigns/{campaignId}/characters'),
    );
    const operationCount = charPaths.reduce(
      (sum, [, item]) =>
        sum +
        ['get', 'post', 'put', 'delete', 'patch'].filter(
          (m) => (item as Record<string, unknown>)[m],
        ).length,
      0,
    );
    expect(operationCount).toBe(12);
  });

  // --- 8.2 Player self-create + read ---

  it('player creates own character, then sees it in list and detail', async () => {
    const created = await app.inject({
      method: 'POST',
      url: `/campaigns/${campaignId}/characters`,
      headers: auth(playerAToken),
      payload: { name: 'Vault Dweller', userId: playerBId }, // body userId ignored
    });
    expect(created.statusCode).toBe(201);
    const body = JSON.parse(created.body);
    expect(body.userId).toBe(playerAId); // inferred from JWT, not body
    const id = body.id as string;

    const list = await app.inject({
      method: 'GET',
      url: `/campaigns/${campaignId}/characters`,
      headers: auth(playerAToken),
    });
    expect(list.statusCode).toBe(200);
    expect(
      (JSON.parse(list.body) as { id: string }[]).some((c) => c.id === id),
    ).toBe(true);

    const detail = await app.inject({
      method: 'GET',
      url: `/campaigns/${campaignId}/characters/${id}`,
      headers: auth(playerAToken),
    });
    expect(detail.statusCode).toBe(200);
    expect(JSON.parse(detail.body).name).toBe('Vault Dweller');
  });

  // --- create RBAC / validation (Decision §5.2) ---

  it('admin must supply userId; unknown member rejected', async () => {
    const noUser = await app.inject({
      method: 'POST',
      url: `/campaigns/${campaignId}/characters`,
      headers: auth(adminToken),
      payload: { name: 'X' },
    });
    expect(noUser.statusCode).toBe(400);

    const nonMember = await app.inject({
      method: 'POST',
      url: `/campaigns/${campaignId}/characters`,
      headers: auth(adminToken),
      payload: { name: 'X', userId: '5f9f1b9b9c9d440000000000' },
    });
    expect(nonMember.statusCode).toBe(400);
  });

  // --- 8.3 Cross-owner isolation ---

  it("player cannot access another player's character (404)", async () => {
    const charB = await createCharacter(playerBId);
    const res = await app.inject({
      method: 'GET',
      url: `/campaigns/${campaignId}/characters/${charB}`,
      headers: auth(playerAToken),
    });
    expect(res.statusCode).toBe(404);
  });

  // --- 8.4 PATCH diffing (perks, nanoid collection) ---

  it('perks: id-less create mints id, id update merges, unknown skipped, deletedIds removes; returns section only', async () => {
    const id = await createCharacter(playerAId);

    // create (id-less → minted)
    const c = await app.inject({
      method: 'PATCH',
      url: `/campaigns/${campaignId}/characters/${id}/perks`,
      headers: auth(adminToken),
      payload: { items: [{ name: 'Bloody Mess' }] },
    });
    expect(c.statusCode).toBe(200);
    const perks = sectionOf(c) as { id: string; name: string }[];
    expect(Array.isArray(perks)).toBe(true); // section only, not full character
    expect(perks).toHaveLength(1);
    const perkId = perks[0].id;
    expect(perkId).toBeTruthy();

    // update by id (merge) + unknown id (skipped and reported)
    const u = await app.inject({
      method: 'PATCH',
      url: `/campaigns/${campaignId}/characters/${id}/perks`,
      headers: auth(adminToken),
      payload: {
        items: [
          { id: perkId, description: 'updated' },
          { id: 'doesnotexist', name: 'Ghost' },
        ],
      },
    });
    const afterUpdate = sectionOf(u) as {
      id: string;
      description?: string;
    }[];
    expect(afterUpdate).toHaveLength(1);
    expect(afterUpdate[0].description).toBe('updated');
    expect(ignoredOf(u)).toEqual([
      { section: 'perks', id: 'doesnotexist', reason: 'unknown_id' },
    ]);

    // delete
    const d = await app.inject({
      method: 'PATCH',
      url: `/campaigns/${campaignId}/characters/${id}/perks`,
      headers: auth(adminToken),
      payload: { deletedIds: [perkId] },
    });
    expect(sectionOf(d)).toHaveLength(0);
  });

  // --- 3.3 status margin (health) ---

  it('a freshly created character reads back margin: 4 by default', async () => {
    const id = await createCharacter(playerAId);
    const res = await app.inject({
      method: 'GET',
      url: `/campaigns/${campaignId}/characters/${id}`,
      headers: auth(playerAToken),
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).status.margin).toBe(4);
  });

  it('PATCH status { margin } persists and echoes it in the section', async () => {
    const id = await createCharacter(playerAId);

    const patch = await app.inject({
      method: 'PATCH',
      url: `/campaigns/${campaignId}/characters/${id}/status`,
      headers: auth(playerAToken),
      payload: { margin: 7 },
    });
    expect(patch.statusCode).toBe(200);
    expect(sectionOf(patch).margin).toBe(7);
    expect(ignoredOf(patch)).toEqual([]);

    // persisted: a subsequent GET reads the new margin back
    const get = await app.inject({
      method: 'GET',
      url: `/campaigns/${campaignId}/characters/${id}`,
      headers: auth(playerAToken),
    });
    expect(JSON.parse(get.body).status.margin).toBe(7);
  });

  it('PATCH status { margin } leaves condition arrays untouched', async () => {
    const id = await createCharacter(playerAId);

    // seed a negative condition first
    const seed = await app.inject({
      method: 'PATCH',
      url: `/campaigns/${campaignId}/characters/${id}/status`,
      headers: auth(playerAToken),
      payload: { negativeConditions: { items: [{ name: 'Ferita' }] } },
    });
    expect(sectionOf(seed).negativeConditions).toHaveLength(1);

    const patch = await app.inject({
      method: 'PATCH',
      url: `/campaigns/${campaignId}/characters/${id}/status`,
      headers: auth(playerAToken),
      payload: { margin: 3 },
    });
    expect(sectionOf(patch).margin).toBe(3);
    expect(sectionOf(patch).negativeConditions).toHaveLength(1);
  });

  it('PATCH status rejects a non-positive margin with 400', async () => {
    const id = await createCharacter(playerAId);
    const res = await app.inject({
      method: 'PATCH',
      url: `/campaigns/${campaignId}/characters/${id}/status`,
      headers: auth(playerAToken),
      payload: { margin: 0 },
    });
    expect(res.statusCode).toBe(400);
  });

  // --- 8.5 Every section is owner-writable; non-owners get 404 ---

  it('the owner may write every section of their own character', async () => {
    const id = await createCharacter(playerAId);

    const sp = await app.inject({
      method: 'PATCH',
      url: `/campaigns/${campaignId}/characters/${id}/special`,
      headers: auth(playerAToken),
      payload: { strength: 5 },
    });
    expect(sp.statusCode).toBe(200);
    expect(sectionOf(sp).strength).toBe(5);
    expect(ignoredOf(sp)).toEqual([]);

    const sk = await app.inject({
      method: 'PATCH',
      url: `/campaigns/${campaignId}/characters/${id}/skills`,
      headers: auth(playerAToken),
      payload: { items: [{ id: 'lockpick', level: 'expert' }] },
    });
    expect(sk.statusCode).toBe(200);
    expect(sectionOf(sk)).toEqual([{ id: 'lockpick', level: 'expert' }]);
    expect(ignoredOf(sk)).toEqual([]);

    const pk = await app.inject({
      method: 'PATCH',
      url: `/campaigns/${campaignId}/characters/${id}/perks`,
      headers: auth(playerAToken),
      payload: { items: [{ name: 'Bloody Mess' }] },
    });
    expect(pk.statusCode).toBe(200);
    expect(sectionOf(pk)).toHaveLength(1);
    expect(ignoredOf(pk)).toEqual([]);

    const st = await app.inject({
      method: 'PATCH',
      url: `/campaigns/${campaignId}/characters/${id}/status`,
      headers: auth(playerAToken),
      payload: { criticalState: true },
    });
    expect(sectionOf(st).criticalState).toBe(true);

    const inv = await app.inject({
      method: 'PATCH',
      url: `/campaigns/${campaignId}/characters/${id}/inventory`,
      headers: auth(playerAToken),
      payload: { weapons: { items: [{ name: '10mm Pistol' }] } },
    });
    const invSection = sectionOf(inv);
    expect(invSection.weapons).toHaveLength(1);
    expect(invSection.weapons[0].id).toBeTruthy();
  });

  it('the owner may write paMax and paTrackedBy, and bobbleheads', async () => {
    const id = await createCharacter(playerAId);

    const ap = await app.inject({
      method: 'PATCH',
      url: `/campaigns/${campaignId}/characters/${id}/action-points`,
      headers: auth(playerAToken),
      payload: { paMax: 10, paCurrent: 3, paTrackedBy: 'endurance' },
    });
    expect(ap.statusCode).toBe(200);
    expect(sectionOf(ap)).toMatchObject({
      paMax: 10,
      paCurrent: 3,
      paTrackedBy: 'endurance',
    });
    expect(ignoredOf(ap)).toEqual([]);

    const rs = await app.inject({
      method: 'PATCH',
      url: `/campaigns/${campaignId}/characters/${id}/resources`,
      headers: auth(playerAToken),
      payload: { caps: 120, scraps: 8, bobbleheads: 5 },
    });
    expect(rs.statusCode).toBe(200);
    expect(sectionOf(rs)).toMatchObject({
      caps: 120,
      scraps: 8,
      bobbleheads: 5,
    });
    expect(ignoredOf(rs)).toEqual([]);

    // Both survive a re-read, not just the PATCH response envelope.
    const get = await app.inject({
      method: 'GET',
      url: `/campaigns/${campaignId}/characters/${id}`,
      headers: auth(playerAToken),
    });
    const body = JSON.parse(get.body);
    expect(body.actionPoints).toMatchObject({
      paMax: 10,
      paCurrent: 3,
      paTrackedBy: 'endurance',
    });
    expect(body.resources.bobbleheads).toBe(5);
  });

  it('a non-owner player patching SPECIAL gets 404 and nothing changes', async () => {
    const id = await createCharacter(playerAId);

    const res = await app.inject({
      method: 'PATCH',
      url: `/campaigns/${campaignId}/characters/${id}/special`,
      headers: auth(playerBToken),
      payload: { strength: 7 },
    });
    expect(res.statusCode).toBe(404);

    const get = await app.inject({
      method: 'GET',
      url: `/campaigns/${campaignId}/characters/${id}`,
      headers: auth(playerAToken),
    });
    expect(JSON.parse(get.body).special.strength).toBe(1);
  });

  it("an admin may write SPECIAL on another player's character", async () => {
    const id = await createCharacter(playerAId);
    const res = await app.inject({
      method: 'PATCH',
      url: `/campaigns/${campaignId}/characters/${id}/special`,
      headers: auth(adminToken),
      payload: { strength: 4 },
    });
    expect(res.statusCode).toBe(200);
    expect(sectionOf(res).strength).toBe(4);
  });

  it('SPECIAL accepts the 1 and 5 bounds; 0 and 6 → 400', async () => {
    const id = await createCharacter(playerAId);
    const patch = (payload: Record<string, number>) =>
      app.inject({
        method: 'PATCH',
        url: `/campaigns/${campaignId}/characters/${id}/special`,
        headers: auth(playerAToken),
        payload,
      });

    const ok = await patch({ strength: 5, luck: 1 });
    expect(ok.statusCode).toBe(200);
    const sp = sectionOf(ok);
    expect(sp.strength).toBe(5);
    expect(sp.luck).toBe(1);
    // omitted attributes are untouched by the partial merge
    expect(sp.perception).toBe(1);

    expect((await patch({ strength: 6 })).statusCode).toBe(400);
    expect((await patch({ strength: 0 })).statusCode).toBe(400);
  });

  it('a legacy out-of-range attribute is clamped into 1..5 on the next SPECIAL write', async () => {
    const id = await createCharacter(playerAId);

    // Seed a legacy value straight through the model, bypassing the DTO that now
    // rejects it — this is the state the migration exists to repair.
    await characterModel.updateOne(
      { _id: id },
      { $set: { 'special.strength': 8, 'special.luck': 0 } },
    );

    // A patch that touches only one attribute re-merges the whole special object;
    // the defensive clamp keeps the untouched legacy values from propagating.
    const res = await app.inject({
      method: 'PATCH',
      url: `/campaigns/${campaignId}/characters/${id}/special`,
      headers: auth(playerAToken),
      payload: { perception: 3 },
    });
    expect(res.statusCode).toBe(200);
    const sp = sectionOf(res);
    expect(sp.perception).toBe(3);
    expect(sp.strength).toBe(5); // 8 clamped down
    expect(sp.luck).toBe(1); // 0 clamped up
  });

  // --- partial-patch clobber regression (live ValidationPipe) ---
  // The bug only manifests once `transform: true` materialises the DTO as a
  // class instance whose declared-but-unsent fields are own `undefined` props.
  // These drive the real HTTP + Mongoose path where that happens.

  it('patching a weapon tag preserves its name (no field clobber)', async () => {
    const id = await createCharacter(playerAId);

    // create a weapon carrying a name and one tag
    const create = await app.inject({
      method: 'PATCH',
      url: `/campaigns/${campaignId}/characters/${id}/inventory`,
      headers: auth(playerAToken),
      payload: {
        weapons: {
          items: [{ name: 'Laser Rifle', tags: [{ name: 'ENERGY', type: 'core' }] }],
        },
      },
    });
    const weaponId = sectionOf(create).weapons[0].id as string;

    // PATCH only the tags — `name` is never sent
    const patch = await app.inject({
      method: 'PATCH',
      url: `/campaigns/${campaignId}/characters/${id}/inventory`,
      headers: auth(playerAToken),
      payload: {
        weapons: {
          items: [{ id: weaponId, tags: [{ name: 'PLASMA', type: 'core' }] }],
        },
      },
    });
    const weapon = sectionOf(patch).weapons[0];
    expect(weapon.name).toBe('Laser Rifle'); // survives the tag-only patch
    expect(weapon.tags).toHaveLength(1);
    expect(weapon.tags[0].name).toBe('PLASMA');

    // survives a re-read too
    const get = await app.inject({
      method: 'GET',
      url: `/campaigns/${campaignId}/characters/${id}`,
      headers: auth(playerAToken),
    });
    expect(JSON.parse(get.body).inventory.weapons[0].name).toBe('Laser Rifle');
  });

  it('patching one resource counter leaves the other two unchanged', async () => {
    const id = await createCharacter(playerAId);

    await app.inject({
      method: 'PATCH',
      url: `/campaigns/${campaignId}/characters/${id}/resources`,
      headers: auth(playerAToken),
      payload: { caps: 42, scraps: 17, bobbleheads: 3 },
    });

    const patch = await app.inject({
      method: 'PATCH',
      url: `/campaigns/${campaignId}/characters/${id}/resources`,
      headers: auth(playerAToken),
      payload: { bobbleheads: 9 },
    });
    expect(sectionOf(patch)).toMatchObject({
      caps: 42,
      scraps: 17,
      bobbleheads: 9,
    });
  });

  it('patching one SPECIAL attribute leaves the other six unchanged', async () => {
    const id = await createCharacter(playerAId);

    await app.inject({
      method: 'PATCH',
      url: `/campaigns/${campaignId}/characters/${id}/special`,
      headers: auth(playerAToken),
      payload: {
        strength: 5,
        perception: 4,
        endurance: 3,
        charisma: 3,
        intelligence: 2,
        agility: 2,
        luck: 1,
      },
    });

    const patch = await app.inject({
      method: 'PATCH',
      url: `/campaigns/${campaignId}/characters/${id}/special`,
      headers: auth(playerAToken),
      payload: { strength: 4 },
    });
    expect(sectionOf(patch)).toMatchObject({
      strength: 4,
      perception: 4,
      endurance: 3,
      charisma: 3,
      intelligence: 2,
      agility: 2,
      luck: 1,
    });
  });

  // --- 8.6 Skills (static-slug collection) ---

  it('admin attaches/changes/detaches a skill by slug; id-less → 400', async () => {
    const id = await createCharacter(playerAId);

    const attach = await app.inject({
      method: 'PATCH',
      url: `/campaigns/${campaignId}/characters/${id}/skills`,
      headers: auth(adminToken),
      payload: { items: [{ id: 'hacking', level: 'expert' }] },
    });
    let skills = sectionOf(attach) as { id: string; level: string }[];
    expect(skills).toHaveLength(1);
    expect(skills[0]).toMatchObject({ id: 'hacking', level: 'expert' });

    const change = await app.inject({
      method: 'PATCH',
      url: `/campaigns/${campaignId}/characters/${id}/skills`,
      headers: auth(adminToken),
      payload: { items: [{ id: 'hacking', level: 'master' }] },
    });
    skills = sectionOf(change);
    expect(skills).toHaveLength(1);
    expect(skills[0].level).toBe('master');

    const detach = await app.inject({
      method: 'PATCH',
      url: `/campaigns/${campaignId}/characters/${id}/skills`,
      headers: auth(adminToken),
      payload: { deletedIds: ['hacking'] },
    });
    expect(sectionOf(detach)).toHaveLength(0);

    const idless = await app.inject({
      method: 'PATCH',
      url: `/campaigns/${campaignId}/characters/${id}/skills`,
      headers: auth(adminToken),
      payload: { items: [{ level: 'expert' }] },
    });
    expect(idless.statusCode).toBe(400);
  });

  // --- 8.7 Soft-delete ---

  it('DELETE soft-deletes: gone from list and detail 404', async () => {
    const id = await createCharacter(playerAId, 'ToDelete');

    const del = await app.inject({
      method: 'DELETE',
      url: `/campaigns/${campaignId}/characters/${id}`,
      headers: auth(playerAToken),
    });
    expect(del.statusCode).toBe(200);

    const list = await app.inject({
      method: 'GET',
      url: `/campaigns/${campaignId}/characters`,
      headers: auth(playerAToken),
    });
    expect(
      (JSON.parse(list.body) as { id: string }[]).some((c) => c.id === id),
    ).toBe(false);

    const detail = await app.inject({
      method: 'GET',
      url: `/campaigns/${campaignId}/characters/${id}`,
      headers: auth(playerAToken),
    });
    expect(detail.statusCode).toBe(404);

    // already-deleted → 404
    const again = await app.inject({
      method: 'DELETE',
      url: `/campaigns/${campaignId}/characters/${id}`,
      headers: auth(playerAToken),
    });
    expect(again.statusCode).toBe(404);
  });
});
