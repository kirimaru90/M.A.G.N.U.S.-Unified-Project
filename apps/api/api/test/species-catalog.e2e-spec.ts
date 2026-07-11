import { Test } from '@nestjs/testing';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
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
import { SpeciesCatalogModule } from '../src/species-catalog/species-catalog.module';
import { DEFAULT_SPECIES_CATALOG } from '../src/species-catalog/species-catalog-bootstrap.service';
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

/* eslint-disable @typescript-eslint/no-unsafe-member-access */

describe('SpeciesCatalogModule (e2e)', () => {
  let app: NestFastifyApplication;
  let characterModel: Model<Character>;
  let adminToken: string;
  let playerToken: string;
  let playerId: string;
  let campaignId: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  /**
   * Insert a character straight into the collection, exactly as a pre-change
   * document would look. Ids must be real ObjectIds: the schema's ObjectId
   * paths do not cast hex strings, so the service's own queries would miss a
   * string-keyed document.
   */
  const insertCharacter = (name: string, species: string, isDeleted = false) =>
    characterModel.create({
      campaignId: new Types.ObjectId(campaignId),
      userId: new Types.ObjectId(playerId),
      name,
      species,
      isDeleted,
    });

  const listSpecies = async () =>
    JSON.parse(
      (
        await app.inject({
          method: 'GET',
          url: '/species-catalog',
          headers: auth(adminToken),
        })
      ).body,
    ) as Array<{ slug: string; tagSkillBudget: number }>;

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
        SpeciesCatalogModule,
      ],
    }).compile();

    // init() fires OnApplicationBootstrap against an empty database, so the
    // seeding path itself runs here.
    app = await createTestApp(module);
    characterModel = module.get(getModelToken(Character.name));

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
    const player = await userModel.create({
      username: 'player',
      passwordHash: hash,
      role: 'player',
    });
    playerId = String(player._id);

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

    const camp = await campaignModel.create({
      name: 'Wasteland',
      isActive: true,
      isPublic: false,
      players: [player._id],
    });
    campaignId = String(camp._id);
  });

  afterAll(async () => {
    await app.close();
    await stopMongoMemoryServer();
  });

  // --- 2.T.6 seeding ---

  it('seeds the four canonical species on a fresh, empty startup', async () => {
    const entries = await listSpecies();
    expect(entries).toHaveLength(DEFAULT_SPECIES_CATALOG.length);
    expect(entries.map((e) => e.slug).sort()).toEqual([
      'ghoul',
      'human',
      'robot',
      'super_mutant',
    ]);
    expect(entries.find((e) => e.slug === 'human')?.tagSkillBudget).toBe(4);
    expect(entries.find((e) => e.slug === 'ghoul')?.tagSkillBudget).toBe(3);
  });

  // --- 2.T.4 RBAC ---

  it('GET is 200 for a player and 401 anonymous', async () => {
    const asPlayer = await app.inject({
      method: 'GET',
      url: '/species-catalog',
      headers: auth(playerToken),
    });
    expect(asPlayer.statusCode).toBe(200);

    const anon = await app.inject({ method: 'GET', url: '/species-catalog' });
    expect(anon.statusCode).toBe(401);
  });

  it('PATCH is 403 for a player and 401 anonymous', async () => {
    const ops = { ops: [{ action: 'delete', slug: 'nonesuch' }] };

    const asPlayer = await app.inject({
      method: 'PATCH',
      url: '/species-catalog',
      headers: auth(playerToken),
      payload: ops,
    });
    expect(asPlayer.statusCode).toBe(403);

    const anon = await app.inject({
      method: 'PATCH',
      url: '/species-catalog',
      payload: ops,
    });
    expect(anon.statusCode).toBe(401);
  });

  // --- batched ops ---

  it('admin adds a species, then updates its tagSkillBudget', async () => {
    const add = await app.inject({
      method: 'PATCH',
      url: '/species-catalog',
      headers: auth(adminToken),
      payload: {
        ops: [
          {
            action: 'add',
            slug: 'synth',
            entry: {
              name: 'Sintetico',
              permesso: 'Indistinguibile da un umano.',
              svantaggio: "Cacciato dall'Istituto.",
              tagSkillBudget: 3,
            },
          },
        ],
      },
    });
    expect(add.statusCode).toBe(200);
    expect(JSON.parse(add.body).ignored).toEqual([]);
    expect((await listSpecies()).some((e) => e.slug === 'synth')).toBe(true);

    const update = await app.inject({
      method: 'PATCH',
      url: '/species-catalog',
      headers: auth(adminToken),
      payload: {
        ops: [
          { action: 'update', slug: 'synth', entry: { tagSkillBudget: 5 } },
        ],
      },
    });
    expect(update.statusCode).toBe(200);
    expect(
      (await listSpecies()).find((e) => e.slug === 'synth')?.tagSkillBudget,
    ).toBe(5);

    // clean up so later assertions on the catalog size are stable
    await app.inject({
      method: 'PATCH',
      url: '/species-catalog',
      headers: auth(adminToken),
      payload: { ops: [{ action: 'delete', slug: 'synth' }] },
    });
  });

  it('duplicate slug on add → 409', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/species-catalog',
      headers: auth(adminToken),
      payload: {
        ops: [
          {
            action: 'add',
            slug: 'ghoul',
            entry: {
              name: 'X',
              permesso: 'a',
              svantaggio: 'b',
              tagSkillBudget: 3,
            },
          },
        ],
      },
    });
    expect(res.statusCode).toBe(409);
    expect(res.body).toContain('ghoul');
  });

  it.each([0, -1])('tagSkillBudget of %s → 400', async (budget) => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/species-catalog',
      headers: auth(adminToken),
      payload: {
        ops: [
          {
            action: 'add',
            slug: 'bad',
            entry: {
              name: 'X',
              permesso: 'a',
              svantaggio: 'b',
              tagSkillBudget: budget,
            },
          },
        ],
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('unknown slug on delete → 200 with unknown_slug in ignored', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/species-catalog',
      headers: auth(adminToken),
      payload: { ops: [{ action: 'delete', slug: 'deathclaw' }] },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).ignored).toEqual([
      { slug: 'deathclaw', reason: 'unknown_slug' },
    ]);
  });

  // --- 2.T.7 / 2.T.8 character coupling ---

  it('creating a character with an unknown species slug → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/campaigns/${campaignId}/characters`,
      headers: auth(adminToken),
      payload: { name: 'Claw', userId: playerId, species: 'deathclaw' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('creating a character with a catalogued species succeeds', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/campaigns/${campaignId}/characters`,
      headers: auth(adminToken),
      payload: { name: 'Marta', userId: playerId, species: 'ghoul' },
    });
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body).species).toBe('ghoul');
  });

  it('a character persisted with super_mutant before the change still reads back', async () => {
    const legacy = await insertCharacter('Legacy', 'super_mutant');

    const res = await app.inject({
      method: 'GET',
      url: `/campaigns/${campaignId}/characters/${String(legacy._id)}`,
      headers: auth(adminToken),
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).species).toBe('super_mutant');

    // and it resolves to a seeded catalog entry
    expect((await listSpecies()).some((e) => e.slug === 'super_mutant')).toBe(
      true,
    );
  });

  it('deleting a species still used by a character → 409, entry unchanged', async () => {
    await insertCharacter('Glowing One', 'robot');

    const res = await app.inject({
      method: 'PATCH',
      url: '/species-catalog',
      headers: auth(adminToken),
      payload: { ops: [{ action: 'delete', slug: 'robot' }] },
    });
    expect(res.statusCode).toBe(409);
    expect((await listSpecies()).some((e) => e.slug === 'robot')).toBe(true);
  });

  it('renaming a species still used by a character → 409', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/species-catalog',
      headers: auth(adminToken),
      payload: {
        ops: [{ action: 'rename', slug: 'robot', rename: 'android' }],
      },
    });
    expect(res.statusCode).toBe(409);
    expect((await listSpecies()).some((e) => e.slug === 'robot')).toBe(true);
  });

  it('a species used only by a soft-deleted character may be deleted', async () => {
    const doomed = await insertCharacter('Gone', 'human', true);
    expect(doomed.isDeleted).toBe(true);

    const res = await app.inject({
      method: 'PATCH',
      url: '/species-catalog',
      headers: auth(adminToken),
      payload: { ops: [{ action: 'delete', slug: 'human' }] },
    });
    expect(res.statusCode).toBe(200);
    expect((await listSpecies()).some((e) => e.slug === 'human')).toBe(false);
  });
});
