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
import { CampaignsModule } from '../src/campaigns/campaigns.module';
import { CharactersModule } from '../src/characters/characters.module';
import { EquipmentCatalogModule } from '../src/equipment-catalog/equipment-catalog.module';
import { DEFAULT_EQUIPMENT_CATALOG } from '../src/equipment-catalog/equipment-catalog-bootstrap.service';
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

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

type CatalogEntry = {
  slug: string;
  name: string;
  kind: string;
  tags: Array<{ name: string; type: string }>;
  defaultQuantity?: number;
  isStarter: boolean;
};

describe('EquipmentCatalogModule (e2e)', () => {
  let app: NestFastifyApplication;
  let adminToken: string;
  let playerToken: string;
  let playerId: string;
  let campaignId: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const listEquipment = async (query = '') =>
    JSON.parse(
      (
        await app.inject({
          method: 'GET',
          url: `/equipment-catalog${query}`,
          headers: auth(adminToken),
        })
      ).body,
    ) as CatalogEntry[];

  const patchCatalog = (ops: unknown[], token = adminToken) =>
    app.inject({
      method: 'PATCH',
      url: '/equipment-catalog',
      headers: auth(token),
      payload: { ops },
    });

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
        EquipmentCatalogModule,
      ],
    }).compile();

    // init() fires OnApplicationBootstrap against an empty database, exercising seeding.
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

  it('seeds the starter loadouts on a fresh, empty startup', async () => {
    const entries = await listEquipment();
    expect(entries).toHaveLength(DEFAULT_EQUIPMENT_CATALOG.length);
    expect(entries.filter((e) => e.kind === 'weapon')).toHaveLength(4);
    expect(entries.filter((e) => e.kind === 'armor')).toHaveLength(3);
    expect(entries.find((e) => e.slug === 'stimpack')).toMatchObject({
      kind: 'consumable',
      defaultQuantity: 2,
      isStarter: true,
    });
  });

  // --- 2.T.5 starter filter ---

  it('?starter=true returns only starter entries', async () => {
    await patchCatalog([
      {
        action: 'add',
        slug: 'coltello',
        entry: { name: 'Coltello', kind: 'weapon', isStarter: false },
      },
    ]);

    const all = await listEquipment();
    const starters = await listEquipment('?starter=true');

    expect(all.some((e) => e.slug === 'coltello')).toBe(true);
    expect(starters.some((e) => e.slug === 'coltello')).toBe(false);
    expect(starters).toHaveLength(
      DEFAULT_EQUIPMENT_CATALOG.filter((e) => e.isStarter).length,
    );
    expect(starters.every((e) => e.isStarter)).toBe(true);
  });

  it('an admin promotes an entry to a starter with one flag', async () => {
    const res = await patchCatalog([
      { action: 'update', slug: 'coltello', entry: { isStarter: true } },
    ]);
    expect(res.statusCode).toBe(200);

    const starters = await listEquipment('?starter=true');
    expect(starters.some((e) => e.slug === 'coltello')).toBe(true);

    // A partial update must not erase the fields it omits.
    const entry = starters.find((e) => e.slug === 'coltello');
    expect(entry).toMatchObject({ name: 'Coltello', kind: 'weapon' });

    // restore
    await patchCatalog([
      { action: 'update', slug: 'coltello', entry: { isStarter: false } },
    ]);
  });

  // --- 2.T.4 RBAC ---

  it('GET is 200 for a player and 401 anonymous', async () => {
    const asPlayer = await app.inject({
      method: 'GET',
      url: '/equipment-catalog',
      headers: auth(playerToken),
    });
    expect(asPlayer.statusCode).toBe(200);

    const anon = await app.inject({ method: 'GET', url: '/equipment-catalog' });
    expect(anon.statusCode).toBe(401);
  });

  it('PATCH is 403 for a player and 401 anonymous', async () => {
    const ops = [{ action: 'delete', slug: 'nonesuch' }];

    const asPlayer = await patchCatalog(ops, playerToken);
    expect(asPlayer.statusCode).toBe(403);

    const anon = await app.inject({
      method: 'PATCH',
      url: '/equipment-catalog',
      payload: { ops },
    });
    expect(anon.statusCode).toBe(401);
  });

  // --- 2.T.2 validation ---

  it('duplicate slug on add → 409', async () => {
    const res = await patchCatalog([
      {
        action: 'add',
        slug: 'pistola-10mm',
        entry: { name: 'X', kind: 'weapon' },
      },
    ]);
    expect(res.statusCode).toBe(409);
    expect(res.body).toContain('pistola-10mm');
  });

  it('unknown kind → 400', async () => {
    const res = await patchCatalog([
      { action: 'add', slug: 'bike', entry: { name: 'X', kind: 'vehicle' } },
    ]);
    expect(res.statusCode).toBe(400);
  });

  it('tag type outside core|extra → 400', async () => {
    const res = await patchCatalog([
      {
        action: 'add',
        slug: 'shiny',
        entry: {
          name: 'X',
          kind: 'weapon',
          tags: [{ name: 'Glow', type: 'legendary' }],
        },
      },
    ]);
    expect(res.statusCode).toBe(400);
  });

  it('tags on a consumable → 400', async () => {
    const res = await patchCatalog([
      {
        action: 'add',
        slug: 'radaway',
        entry: {
          name: 'RadAway',
          kind: 'consumable',
          tags: [{ name: 'X', type: 'core' }],
        },
      },
    ]);
    expect(res.statusCode).toBe(400);
  });

  it('negative defaultQuantity → 400', async () => {
    const res = await patchCatalog([
      {
        action: 'add',
        slug: 'radaway',
        entry: { name: 'RadAway', kind: 'consumable', defaultQuantity: -1 },
      },
    ]);
    expect(res.statusCode).toBe(400);
  });

  it('isStarter defaults to false on add', async () => {
    await patchCatalog([
      { action: 'add', slug: 'tubo', entry: { name: 'Tubo', kind: 'weapon' } },
    ]);
    const entry = (await listEquipment()).find((e) => e.slug === 'tubo');
    expect(entry?.isStarter).toBe(false);
  });

  it('unknown slug on delete → 200 with unknown_slug in ignored', async () => {
    const res = await patchCatalog([{ action: 'delete', slug: 'nonesuch' }]);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).ignored).toEqual([
      { slug: 'nonesuch', reason: 'unknown_slug' },
    ]);
  });

  // --- 2.T.8 copy-on-use: deleting a template never touches an inventory ---

  it('deleting a template a character carries leaves that inventory item intact', async () => {
    const template = (await listEquipment()).find(
      (e) => e.slug === 'pistola-10mm',
    )!;
    expect(template).toBeDefined();

    const created = await app.inject({
      method: 'POST',
      url: `/campaigns/${campaignId}/characters`,
      headers: auth(adminToken),
      payload: { name: 'Marta', userId: playerId },
    });
    const charId = JSON.parse(created.body).id as string;

    // The client copies name + tags; no catalog slug is ever sent.
    const copy = await app.inject({
      method: 'PATCH',
      url: `/campaigns/${campaignId}/characters/${charId}/inventory`,
      headers: auth(playerToken),
      payload: {
        weapons: {
          items: [
            {
              name: template.name,
              tags: template.tags.map((t) => ({ ...t, damaged: false })),
            },
          ],
        },
      },
    });
    expect(copy.statusCode).toBe(200);
    const weapons = JSON.parse(copy.body).section.weapons;
    expect(weapons).toHaveLength(1);
    expect(weapons[0].id).toBeTruthy();
    expect(weapons[0].name).toBe('Pistola 10mm');
    expect(weapons[0].slug).toBeUndefined();

    const del = await patchCatalog([
      { action: 'delete', slug: 'pistola-10mm' },
    ]);
    expect(del.statusCode).toBe(200);
    expect((await listEquipment()).some((e) => e.slug === 'pistola-10mm')).toBe(
      false,
    );

    const after = await app.inject({
      method: 'GET',
      url: `/campaigns/${campaignId}/characters/${charId}`,
      headers: auth(playerToken),
    });
    const stillThere = JSON.parse(after.body).inventory.weapons;
    expect(stillThere).toHaveLength(1);
    expect(stillThere[0]).toMatchObject({
      name: 'Pistola 10mm',
      broken: false,
    });
    expect(stillThere[0].tags[0]).toMatchObject({
      name: 'PROIETTILI',
      type: 'core',
      damaged: false,
    });
  });

  // --- misc-items-catalog: misc kind, starter exclusion, tag order ---

  it('accepts a misc template and forces isStarter false', async () => {
    const res = await patchCatalog([
      {
        action: 'add',
        slug: 'chiave-inglese-e2e',
        entry: {
          name: 'Chiave inglese',
          kind: 'misc',
          description: 'Attrezzo',
          defaultQuantity: 1,
          isStarter: true,
        },
      },
    ]);
    expect(res.statusCode).toBe(200);

    const entry = (await listEquipment()).find(
      (e) => e.slug === 'chiave-inglese-e2e',
    );
    expect(entry).toMatchObject({
      kind: 'misc',
      defaultQuantity: 1,
      isStarter: false,
    });
    expect(entry?.tags).toEqual([]);

    // The starter filter never surfaces a misc entry.
    const starters = await listEquipment('?starter=true');
    expect(starters.some((e) => e.slug === 'chiave-inglese-e2e')).toBe(false);
  });

  it('rejects tags on a misc entry → 400', async () => {
    const res = await patchCatalog([
      {
        action: 'add',
        slug: 'misc-tagged',
        entry: {
          name: 'X',
          kind: 'misc',
          tags: [{ name: 'X', type: 'core' }],
        },
      },
    ]);
    expect(res.statusCode).toBe(400);
  });

  it('persists and returns catalog tags in canonical core→extra→alpha order', async () => {
    await patchCatalog([
      {
        action: 'add',
        slug: 'arma-ordinata',
        entry: {
          name: 'Arma',
          kind: 'weapon',
          tags: [
            { name: 'Zeta', type: 'core' },
            { name: 'Alfa', type: 'extra' },
            { name: 'Beta', type: 'core' },
          ],
        },
      },
    ]);
    const entry = (await listEquipment()).find(
      (e) => e.slug === 'arma-ordinata',
    );
    expect(entry?.tags).toEqual([
      { name: 'Beta', type: 'core' },
      { name: 'Zeta', type: 'core' },
      { name: 'Alfa', type: 'extra' },
    ]);
  });

  it('inventory accepts a { misc } block and rejects the legacy { other } key', async () => {
    const created = await app.inject({
      method: 'POST',
      url: `/campaigns/${campaignId}/characters`,
      headers: auth(adminToken),
      payload: { name: 'Nadia', userId: playerId },
    });
    const charId = JSON.parse(created.body).id as string;

    const okMisc = await app.inject({
      method: 'PATCH',
      url: `/campaigns/${campaignId}/characters/${charId}/inventory`,
      headers: auth(playerToken),
      payload: { misc: { items: [{ name: 'Chiave inglese', quantity: 1 }] } },
    });
    expect(okMisc.statusCode).toBe(200);
    const miscItems = JSON.parse(okMisc.body).section.misc;
    expect(miscItems).toHaveLength(1);
    expect(miscItems[0]).toMatchObject({ name: 'Chiave inglese', quantity: 1 });
    expect(miscItems[0].id).toBeTruthy();

    const rejectOther = await app.inject({
      method: 'PATCH',
      url: `/campaigns/${campaignId}/characters/${charId}/inventory`,
      headers: auth(playerToken),
      payload: { other: { items: [{ name: 'X', quantity: 1 }] } },
    });
    expect(rejectOther.statusCode).toBe(400);
  });

  it('persists and returns inventory weapon tags in canonical order', async () => {
    const created = await app.inject({
      method: 'POST',
      url: `/campaigns/${campaignId}/characters`,
      headers: auth(adminToken),
      payload: { name: 'Ivo', userId: playerId },
    });
    const charId = JSON.parse(created.body).id as string;

    const res = await app.inject({
      method: 'PATCH',
      url: `/campaigns/${campaignId}/characters/${charId}/inventory`,
      headers: auth(playerToken),
      payload: {
        weapons: {
          items: [
            {
              name: 'Arma',
              tags: [
                { name: 'Zeta', type: 'core' },
                { name: 'Alfa', type: 'extra' },
                { name: 'Beta', type: 'core' },
              ],
            },
          ],
        },
      },
    });
    expect(res.statusCode).toBe(200);
    const tags = JSON.parse(res.body).section.weapons[0].tags;
    expect(tags.map((t: { name: string }) => t.name)).toEqual([
      'Beta',
      'Zeta',
      'Alfa',
    ]);
  });
});
