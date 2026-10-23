import type { Page, Route } from '@playwright/test';
import { deflateSync } from 'node:zlib';
import { tintPixels, tintTables } from '../src/shared/map-core/style.js';

export const API = 'http://localhost:3000';

/**
 * A lone accessible campaign auto-selects, so the picker never renders. Specs
 * that need the picker must stub two campaigns.
 */
export const TWO_CAMPAIGNS = [
  { id: 'camp-1', name: 'Vault 111' },
  { id: 'camp-2', name: 'Vault 88' },
];

export function makeCharacter(overrides: Record<string, unknown> = {}) {
  return {
    id: 'char-1',
    campaignId: 'camp-1',
    userId: 'user-player',
    name: 'Marta Voss',
    species: 'human',
    special: { strength: 3, perception: 3, endurance: 3, charisma: 3, intelligence: 3, agility: 3, luck: 3 },
    skills: [{ id: 'lockpicking', level: 'expert' }],
    actionPoints: { paMax: 5, paCurrent: 3, paTrackedBy: 'agility' },
    status: { positiveConditions: [], negativeConditions: [], criticalState: false },
    perks: [],
    resources: { caps: 10, bobbleheads: 1, scraps: 2 },
    inventory: { weapons: [], equip: [], consumables: [], misc: [] },
    ...overrides,
  };
}

export const DEFAULT_SKILLS_CATALOG = [
  { slug: 'lockpicking', name: 'Scassinare', description: 'Forzare lucchetti' },
  { slug: 'science', name: 'Scienza', description: 'Hackerare terminali' },
];

export const DEFAULT_CONDITIONS_CATALOG = [
  { slug: 'poisoned', name: 'Avvelenato', defaultSeverity: 'major', polarity: 'negative' },
  { slug: 'well-fed', name: 'Ben Nutrito', defaultSeverity: 'minor', polarity: 'positive' },
];

export const DEFAULT_TAG_CATALOG = [
  { slug: 'proiettili', name: 'PROIETTILI' },
  { slug: 'affidabile', name: 'AFFIDABILE' },
  { slug: 'pesante', name: 'PESANTE' },
];

// The talents catalog is now a real backend endpoint but ships empty; specs that
// need entries pass their own via `talentsCatalog`.
export const DEFAULT_TALENTS_CATALOG: Array<{ slug: string; name: string; description?: string }> = [];

export const DEFAULT_PLAYERS = [
  { id: 'user-player', username: 'player1', role: 'player' },
  { id: 'user-player-2', username: 'player2', role: 'player' },
];

export const DEFAULT_SPECIES_CATALOG = [
  { slug: 'human', name: 'Umano', permesso: 'Versatilità completa.', svantaggio: 'Nessun talento sovrannaturale.', tagSkillBudget: 4, margin: 6 },
  { slug: 'ghoul', name: 'Ghoul', permesso: 'Immune alle radiazioni.', svantaggio: 'Inviso agli umani.', tagSkillBudget: 3, margin: 5 },
  { slug: 'super_mutant', name: 'Supermutante', permesso: 'Forza sovrumana.', svantaggio: 'Respinto nei contesti civili.', tagSkillBudget: 3, margin: 5 },
  { slug: 'robot', name: 'Robot', permesso: 'Immune a veleni.', svantaggio: 'Vulnerabile a EMP.', tagSkillBudget: 3, margin: 5 },
];

export const DEFAULT_STARTER_EQUIPMENT = [
  {
    slug: 'pistola-10mm', name: 'Pistola 10mm', kind: 'weapon', isStarter: true,
    tags: [{ name: 'PROIETTILI', type: 'core' }, { name: 'AFFIDABILE', type: 'extra' }],
  },
  { slug: 'mazza-chiodata', name: 'Mazza Chiodata', kind: 'weapon', isStarter: true, tags: [{ name: 'PESANTE', type: 'core' }] },
  {
    slug: 'giubbotto-di-pelle', name: 'Giubbotto di Pelle', kind: 'armor', isStarter: true,
    tags: [{ name: 'CUOIO', type: 'core' }, { name: 'STEALTH', type: 'extra' }],
  },
  { slug: 'stimpack', name: 'Stimpack', kind: 'consumable', isStarter: true, tags: [] },
];

// Misc (Vari) templates are never starters, so they live outside the starter set.
// The full-catalog endpoint (`GET /equipment-catalog`) returns them; the wizard's
// `?starter=true` query never does. Templates carry no quantity — instantiating
// one always adds quantity 1.
export const DEFAULT_MISC_CATALOG = [
  { slug: 'chiave-inglese', name: 'Chiave inglese', kind: 'misc', isStarter: false, tags: [], description: 'Attrezzo' },
];

export const DEFAULT_MAP_CONFIG = {
  startLat: 41.9,
  startLng: 12.5,
  startZoom: 13,
  minZoom: 3,
  maxZoom: 18,
  bounds: { south: 35, west: 6, north: 48, east: 19 },
};

/** A campaign with no authored map — what most specs get. */
export const DEFAULT_CAMPAIGN_MAP = { config: DEFAULT_MAP_CONFIG, places: [] };

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** An opaque `size`×`size` PNG of one colour. */
export function solidPng([r, g, b]: readonly number[], size = 256) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour RGB
  const row = Buffer.alloc(1 + size * 3);
  for (let x = 0; x < size; x++) row.set([r, g, b], 1 + x * 3);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(Buffer.concat(Array.from({ length: size }, () => row)))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/** CARTO dark_nolabels land, as measured; the tile stub's colour. */
export const TILE_LAND = [14, 14, 14] as const;

/**
 * Basemap tiles are fulfilled with a flat land-coloured PNG so the suite never
 * reaches CARTO: hermetic, and it keeps us off a third party's servers on every
 * run. Opaque and CORS-enabled like CARTO's own, because the map reads tile
 * pixels to tint them; a specced pixel can then be sampled on the tile canvas.
 */
export const TILE_PNG = solidPng(TILE_LAND);

/** The CORS header CARTO sends, without which a tile's pixels cannot be read. */
export const TILE_HEADERS = { 'Access-Control-Allow-Origin': '*' };

/** The stub tile's colour through a theme triplet's tint (RGBA), or as served for null. */
export function tintedTilePixel(rgb: string | null) {
  return [...tintPixels(new Uint8ClampedArray([...TILE_LAND, 255]), rgb ? tintTables(rgb) : null)];
}

/**
 * The map's loaded basemap tiles: tag, centre pixel (RGBA) and computed filter.
 * `mark` tags each node, and `marked` reports a tag left by an earlier call, so
 * a spec can tell a repainted tile from a rebuilt one.
 */
export function mapTiles(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLCanvasElement>('.pb-map-canvas .leaflet-tile-loaded')].map((el) => {
      const marked = (el as any).__pbMark === true;
      (el as any).__pbMark = true;
      const px = el.getContext ? [...el.getContext('2d')!.getImageData(el.width / 2, el.height / 2, 1, 1).data] : [];
      return { tag: el.tagName, px, filter: getComputedStyle(el).filter, marked };
    }),
  );
}

export interface StubOptions {
  role?: 'player' | 'admin';
  userId?: string;
  lastCampaignId?: string | null;
  lastCharacterId?: string | null;
  campaigns?: Array<{ id: string; name: string }>;
  character?: ReturnType<typeof makeCharacter>;
  characters?: Array<ReturnType<typeof makeCharacter>>;
  players?: typeof DEFAULT_PLAYERS;
  skillsCatalog?: typeof DEFAULT_SKILLS_CATALOG;
  conditionsCatalog?: typeof DEFAULT_CONDITIONS_CATALOG;
  tagCatalog?: typeof DEFAULT_TAG_CATALOG;
  talentsCatalog?: typeof DEFAULT_TALENTS_CATALOG;
  speciesCatalog?: typeof DEFAULT_SPECIES_CATALOG;
  starterEquipment?: typeof DEFAULT_STARTER_EQUIPMENT;
  miscCatalog?: typeof DEFAULT_MISC_CATALOG;
  notes?: Array<{ id: string; title: string; note: string; createdAt: string; updatedAt: string }>;
  background?: string | null;
  /** What `GET /campaigns/:id/map` returns — already projected, as the API would. */
  campaignMap?: { config: typeof DEFAULT_MAP_CONFIG; places: Array<Record<string, unknown>> };
  /** When true the notes/background endpoints 404 (the non-owner case). */
  notesForbidden?: boolean;
  /**
   * What `GET /campaigns/:cid/characters/:id/quests` returns — already projected,
   * as the API would. A number is served as that HTTP error status instead.
   */
  quests?: Array<Record<string, unknown>> | number;
  /**
   * What `GET /campaigns/:cid/characters/:id/codex` returns — already projected,
   * as the API would. A number is served as that HTTP error status instead.
   * Writes mutate this list in memory.
   */
  codex?: Array<Record<string, unknown>> | number;
  allowServiceWorker?: boolean;
}

// Hermetic environment stub, mirroring apps/terminal's tests/boot.spec.ts
// pattern: mock every API call the app can make, abort external CDNs/fonts and
// (by default) the service worker registration so specs run offline and
// deterministically without a real backend.
export async function stubEnvironment(page: Page, opts: StubOptions = {}) {
  const role = opts.role ?? 'player';
  const userId = opts.userId ?? 'user-player';
  const campaigns = opts.campaigns ?? [{ id: 'camp-1', name: 'Vault 111' }];
  const character = opts.character ?? makeCharacter({ userId });
  const characters = opts.characters ?? [character];
  const skillsCatalog = opts.skillsCatalog ?? DEFAULT_SKILLS_CATALOG;
  const conditionsCatalog = opts.conditionsCatalog ?? DEFAULT_CONDITIONS_CATALOG;
  const tagCatalog = opts.tagCatalog ?? DEFAULT_TAG_CATALOG;
  const talentsCatalog = opts.talentsCatalog ?? DEFAULT_TALENTS_CATALOG;
  const speciesCatalog = opts.speciesCatalog ?? DEFAULT_SPECIES_CATALOG;
  const starterEquipment = opts.starterEquipment ?? DEFAULT_STARTER_EQUIPMENT;
  const miscCatalog = opts.miscCatalog ?? DEFAULT_MISC_CATALOG;
  const players = opts.players ?? DEFAULT_PLAYERS;

  // Registered first so later, more specific routes take priority.
  await page.route(`${API}/**`, (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
  );

  await page.route('**/auth/login', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ accessToken: 'test-token', role, expiresIn: 86400 }),
    });
  });

  await page.route('**/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: userId,
        username: role === 'admin' ? 'admin1' : 'player1',
        role,
        lastCampaignId: opts.lastCampaignId ?? null,
        lastCharacterId: opts.lastCharacterId ?? null,
        unlockedHiddenIds: {},
      }),
    }),
  );

  await page.route('**/campaigns', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(campaigns) });
  });

  await page.route(/\/campaigns\/[^/]+$/, (route) => {
    const url = new URL(route.request().url());
    const id = url.pathname.split('/').pop();
    const campaign = campaigns.find((c) => c.id === id);
    if (!campaign) return route.fulfill({ status: 404, body: '{}' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(campaign) });
  });

  await page.route(/\/campaigns\/[^/]+\/players$/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(players) }),
  );

  // The campaign map. The body stands in for what the API has *already*
  // projected for this caller — the isPublic cascade is a server-side rule, and
  // it is asserted against a real server in the API's campaign-map.e2e-spec.ts,
  // which is the only place it can be proven. Here it is a given.
  await page.route(/\/campaigns\/[^/]+\/map$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(opts.campaignMap ?? DEFAULT_CAMPAIGN_MAP),
    }),
  );

  // Basemap tiles never leave the test runner.
  await page.route(/basemaps\.cartocdn\.com/, (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', headers: TILE_HEADERS, body: TILE_PNG }),
  );

  await page.route(/\/campaigns\/[^/]+\/characters$/, (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() ?? {};
      const created = makeCharacter({
        id: 'char-new',
        userId: body.userId ?? userId,
        name: body.name ?? 'Nuovo Personaggio',
      });
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(created) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(characters) });
  });

  await page.route(/\/campaigns\/[^/]+\/characters\/[^/]+$/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(character) }),
  );

  function patchSection(sectionKey: string, apply: (body: any) => unknown) {
    return async (route: Route) => {
      const body = route.request().postDataJSON();
      const section = apply(body);
      (character as Record<string, unknown>)[sectionKey] = section;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ section, ignored: [] }) });
    };
  }

  await page.route(/\/characters\/[^/]+\/special$/, patchSection('special', (body) => ({ ...character.special, ...body })));
  await page.route(/\/characters\/[^/]+\/skills$/, patchSection('skills', (body: any) => {
    let items = [...character.skills];
    for (const it of body.items ?? []) {
      const idx = items.findIndex((s) => s.id === it.id);
      if (idx >= 0) items[idx] = it; else items.push(it);
    }
    if (body.deletedIds) items = items.filter((s) => !body.deletedIds.includes(s.id));
    return items;
  }));
  await page.route(/\/characters\/[^/]+\/perks$/, patchSection('perks', (body: any) => {
    let items = [...character.perks];
    for (const it of body.items ?? []) {
      if (!it.id) items.push({ ...it, id: `perk-${items.length + 1}` });
      else {
        const idx = items.findIndex((p) => p.id === it.id);
        if (idx >= 0) items[idx] = { ...items[idx], ...it };
      }
    }
    if (body.deletedIds) items = items.filter((p) => !body.deletedIds.includes(p.id));
    return items;
  }));
  await page.route(/\/characters\/[^/]+\/status$/, patchSection('status', (body: any) => {
    const next = { ...character.status };
    for (const coll of ['positiveConditions', 'negativeConditions']) {
      if (!body[coll]) continue;
      let items = [...(next as any)[coll]];
      for (const it of body[coll].items ?? []) {
        if (!it.id) items.push({ ...it, id: `cond-${items.length + 1}` });
        else {
          const idx = items.findIndex((c: any) => c.id === it.id);
          if (idx >= 0) items[idx] = { ...items[idx], ...it };
        }
      }
      if (body[coll].deletedIds) items = items.filter((c: any) => !body[coll].deletedIds.includes(c.id));
      (next as any)[coll] = items;
    }
    if (body.criticalState !== undefined) (next as any).criticalState = body.criticalState;
    if (body.margin !== undefined) (next as any).margin = body.margin;
    return next;
  }));
  await page.route(/\/characters\/[^/]+\/action-points$/, patchSection('actionPoints', (body) => ({ ...character.actionPoints, ...body })));
  await page.route(/\/characters\/[^/]+\/resources$/, patchSection('resources', (body) => ({ ...character.resources, ...body })));
  await page.route(/\/characters\/[^/]+\/inventory$/, patchSection('inventory', (body: any) => {
    const next = { ...character.inventory };
    for (const section of ['weapons', 'equip', 'consumables', 'misc']) {
      if (!body[section]) continue;
      let items = [...(next as any)[section]];
      for (const it of body[section].items ?? []) {
        if (!it.id) items.push({ ...it, id: `item-${items.length + 1}`, tags: it.tags ?? [] });
        else {
          const idx = items.findIndex((i: any) => i.id === it.id);
          if (idx >= 0) items[idx] = { ...items[idx], ...it };
        }
      }
      if (body[section].deletedIds) items = items.filter((i: any) => !body[section].deletedIds.includes(i.id));
      (next as any)[section] = items;
    }
    return next;
  }));

  // --- per-character notes collection + background field ---
  // Registered before the catalogs but after the character routes; their
  // distinct `/notes`/`/background` suffixes never collide with `/characters/:id`.
  const notes = opts.notes ? [...opts.notes] : [];
  let background: string | null = opts.background ?? null;
  const notesForbidden = opts.notesForbidden ?? false;

  await page.route(/\/characters\/[^/]+\/notes$/, (route) => {
    if (notesForbidden) return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() ?? {};
      const now = new Date().toISOString();
      const created = { id: `note-${notes.length + 1}`, title: body.title, note: body.note ?? '', createdAt: now, updatedAt: now };
      notes.push(created);
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(created) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(notes) });
  });

  await page.route(/\/characters\/[^/]+\/notes\/[^/]+$/, (route) => {
    if (notesForbidden) return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    const id = new URL(route.request().url()).pathname.split('/').pop();
    const idx = notes.findIndex((n) => n.id === id);
    if (route.request().method() === 'DELETE') {
      if (idx >= 0) notes.splice(idx, 1);
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    const body = route.request().postDataJSON() ?? {};
    if (idx >= 0) notes[idx] = { ...notes[idx], ...body, updatedAt: new Date().toISOString() };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(idx >= 0 ? notes[idx] : {}) });
  });

  // --- per-character quest log (read-only, projected by the API) ---
  const quests = opts.quests ?? [];
  await page.route(/\/characters\/[^/]+\/quests$/, (route) =>
    typeof quests === 'number'
      ? route.fulfill({ status: quests, contentType: 'application/json', body: '{}' })
      : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(quests) }));

  // --- per-character codex (projected by the API; writes kept in memory) ---
  const codex = typeof opts.codex === 'number' ? opts.codex : [...(opts.codex ?? [])];
  await page.route(/\/characters\/[^/]+\/codex$/, (route) => {
    if (typeof codex === 'number') {
      return route.fulfill({ status: codex, contentType: 'application/json', body: '{}' });
    }
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() ?? {};
      const now = new Date().toISOString();
      const created = {
        id: `codex-${codex.length + 1}`,
        description: null,
        imageUrl: null,
        mapPlaceSlug: null,
        ...body,
        isPublic: body.isPublic ?? false,
        isEditable: true,
        isOwn: true,
        createdAt: now,
        updatedAt: now,
      };
      codex.push(created);
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(created) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(codex) });
  });
  await page.route(/\/characters\/[^/]+\/codex\/[^/]+$/, (route) => {
    if (typeof codex === 'number') return route.fulfill({ status: codex, body: '{}' });
    const id = new URL(route.request().url()).pathname.split('/').pop();
    const idx = codex.findIndex((e) => e.id === id);
    if (idx < 0) return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    if (route.request().method() === 'DELETE') {
      codex.splice(idx, 1);
      return route.fulfill({ status: 204, body: '' });
    }
    const body = route.request().postDataJSON() ?? {};
    codex[idx] = { ...codex[idx], ...body, updatedAt: new Date().toISOString() };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(codex[idx]) });
  });

  await page.route(/\/characters\/[^/]+\/background$/, (route) => {
    if (notesForbidden) return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() ?? {};
      background = body.background ? body.background : null;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ background }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ background }) });
  });

  // Trailing `*` so the stub also matches the `?orderBy=name` query the client
  // now appends to every catalog read.
  await page.route('**/skills-catalog*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(skillsCatalog) }),
  );
  await page.route('**/conditions-catalog*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(conditionsCatalog) }),
  );
  await page.route('**/tag-catalog*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tagCatalog) }),
  );
  await page.route('**/talents-catalog*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(talentsCatalog) }),
  );
  await page.route('**/species-catalog*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(speciesCatalog) }),
  );
  // The wizard requests only starter templates (`?starter=true`); the inventory
  // add-item popup requests the full catalog (bare path), which also carries the
  // misc (Vari) templates that are never starters.
  await page.route('**/equipment-catalog*', (route) => {
    const starterOnly = new URL(route.request().url()).searchParams.get('starter') === 'true';
    const body = starterOnly ? starterEquipment : [...starterEquipment, ...miscCatalog];
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.route(/\/campaigns\/[^/]+\/characters\/[^/]+$/, (route) => {
    if (route.request().method() !== 'DELETE') return route.fallback();
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/users/me/last-selection', (route) => {
    const body = route.request().postDataJSON();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.route('**/auth/logout', (route) => route.fulfill({ status: 204, body: '' }));

  // Fulfil rather than abort: index.html loads the fonts via <link rel=stylesheet>,
  // and an aborted stylesheet can leave the document's `load` event pending —
  // which made `page.goto(..., waitUntil: 'load')` flake under parallel workers.
  await page.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, (route) =>
    route.fulfill({ status: 200, contentType: 'text/css', body: '' }),
  );
  if (!opts.allowServiceWorker) {
    await page.route('**/sw.js*', (route) => route.abort());
  }

  return { character, characters, campaigns, players, skillsCatalog, conditionsCatalog, tagCatalog, talentsCatalog };
}

/**
 * Wait for the dice tumble to settle, without a fixed sleep. Call it *before*
 * the roll/reroll click and await the returned function afterwards, so a spec
 * can assert mid-tumble in between:
 *
 *   const settled = await nextDiceSettle(page);
 *   await page.locator('#pb-dice-roll').click();
 *   await settled();
 *
 * `#pb-dice-roll` is disabled exactly while the dice tumble, so a settle is its
 * disabled → enabled edge. Counting edges (rather than waiting for "enabled")
 * matters for a reroll: it awaits the PA PATCH before tumbling, so the button
 * is still enabled right after the click.
 */
export async function nextDiceSettle(page: Page): Promise<() => Promise<void>> {
  const before = await page.evaluate(() => {
    const w = window as unknown as { __pbDiceSettles?: number };
    if (w.__pbDiceSettles === undefined) {
      w.__pbDiceSettles = 0;
      const rolling = () => !!document.querySelector('#pb-dice-roll[disabled]');
      let was = rolling();
      new MutationObserver(() => {
        const now = rolling();
        if (was && !now) w.__pbDiceSettles! += 1;
        was = now;
      }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['disabled'] });
    }
    return w.__pbDiceSettles;
  });
  return async () => {
    await page.waitForFunction(
      (n) => (window as unknown as { __pbDiceSettles: number }).__pbDiceSettles > n,
      before,
    );
  };
}

/** Roll and wait for the tumble to settle. */
export async function rollAndSettle(page: Page) {
  const settled = await nextDiceSettle(page);
  await page.locator('#pb-dice-roll').click();
  await settled();
}

/**
 * Let the page render the next two frames. Enough after a non-animated Leaflet
 * `setView`, whose move/zoom handlers (and so the app's marker sync) run
 * synchronously inside the call.
 */
export async function nextFrames(page: Page) {
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
}

/**
 * Seed the roller's injectable random source so specs assert on exact faces
 * rather than on real randomness. Faces are consumed one die at a time and the
 * sequence wraps, so a roll then a reroll can both be described.
 *
 * The tumble animation's flickering faces bypass this source, so only dice that
 * are actually rolled draw from `faces`. Install before the app boots.
 */
export async function seedDice(page: Page, faces: number[]) {
  await page.addInitScript((seq: number[]) => {
    let i = 0;
    // rollDie() computes 1 + floor(r * 6), so map a face f to r = (f - 0.5) / 6.
    (window as unknown as { __PB_DICE_RANDOM__: () => number }).__PB_DICE_RANDOM__ = () => {
      const face = seq[i % seq.length];
      i += 1;
      return (face - 0.5) / 6;
    };
  }, faces);
}

export interface DeviceStubOptions {
  orientationAbsent?: boolean;
  /** Mirrors an ordinary browser tab, where lock() rejects NotSupportedError. */
  orientationRejects?: boolean;
  wakeLockAbsent?: boolean;
  wakeLockRejects?: boolean;
  /** Holds `request()` pending, so a navigation can land mid-request. */
  wakeLockRequestDelayMs?: number;
  vibrateAbsent?: boolean;
}

export interface DeviceRecord {
  vibrate: number[];
  orientation: string[];
  wakeLock: string[];
  unhandled: string[];
}

/**
 * None of `navigator.vibrate`, `screen.orientation` or `navigator.wakeLock` can
 * be meaningfully driven from Playwright on a desktop browser, so each is
 * replaced with a recording stub installed before boot — the same injection
 * technique `seedDice` uses. The specs then assert *what the app asks the
 * platform to do*, which is the only part the app controls; whether the motor
 * spins is a hardware fact no harness can observe.
 *
 * Unhandled rejections are recorded too: every wrapper in `engine/device.js` is
 * required to absorb its own failure, and an unhandled rejection is how a missed
 * one shows up.
 *
 * Install before the app boots.
 */
export async function stubDeviceApis(page: Page, opts: DeviceStubOptions = {}) {
  await page.addInitScript((o: DeviceStubOptions) => {
    const rec = {
      vibrate: [] as number[],
      orientation: [] as string[],
      wakeLock: [] as string[],
      unhandled: [] as string[],
      /** What a browser does on hide: release the lock and flag the sentinel,
       *  silently — the app is never told and must re-request on its own. */
      simulateHide: () => {},
    };
    (window as unknown as Record<string, unknown>).__PB_DEVICE__ = rec;

    window.addEventListener('unhandledrejection', (e) => {
      rec.unhandled.push(String((e as PromiseRejectionEvent).reason));
    });

    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: o.vibrateAbsent ? undefined : (ms: number) => { rec.vibrate.push(ms); return true; },
    });

    Object.defineProperty(window.screen, 'orientation', {
      configurable: true,
      value: o.orientationAbsent ? undefined : {
        lock: (type: string) => {
          rec.orientation.push(`lock:${type}`);
          return o.orientationRejects
            ? Promise.reject(new DOMException('not supported', 'NotSupportedError'))
            : Promise.resolve();
        },
        unlock: () => { rec.orientation.push('unlock'); },
      },
    });

    let current: { released: boolean } | null = null;
    rec.simulateHide = () => { if (current) current.released = true; };
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: o.wakeLockAbsent ? undefined : {
        request: (type: string) => {
          rec.wakeLock.push(`request:${type}`);
          if (o.wakeLockRejects) return Promise.reject(new DOMException('denied', 'NotAllowedError'));
          const sentinel = {
            released: false,
            release: () => {
              sentinel.released = true;
              rec.wakeLock.push('release');
              return Promise.resolve();
            },
          };
          current = sentinel;
          if (!o.wakeLockRequestDelayMs) return Promise.resolve(sentinel);
          return new Promise((resolve) => setTimeout(() => resolve(sentinel), o.wakeLockRequestDelayMs));
        },
      },
    });
  }, opts);
}

export function readDevice(page: Page): Promise<DeviceRecord> {
  return page.evaluate(() => {
    const r = (window as unknown as { __PB_DEVICE__: DeviceRecord }).__PB_DEVICE__;
    return { vibrate: [...r.vibrate], orientation: [...r.orientation], wakeLock: [...r.wakeLock], unhandled: [...r.unhandled] };
  });
}

/** Seed the persisted preference key before the app boots. */
export async function seedPrefs(page: Page, prefs: unknown) {
  await page.addInitScript((value: string) => {
    window.localStorage.setItem('pipboy:prefs', value);
  }, typeof prefs === 'string' ? prefs : JSON.stringify(prefs));
}

/**
 * Emulate the installed app (fullscreen/standalone display mode). Chromium's
 * media emulation has no `display-mode`, so this does both halves by hand:
 * `matchMedia` answers true for any display-mode query (engine/back.js reads
 * it at boot), and once the page has loaded every `@media` rule that names a
 * display mode is switched to `all`, so the stylesheet's installed-mode rules
 * apply. Must be called before `page.goto`.
 */
export async function emulateInstalled(page: Page) {
  await page.addInitScript(() => {
    const real = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => {
      if (!/display-mode\s*:\s*(standalone|fullscreen)/.test(query)) return real(query);
      const noop = () => {};
      return {
        matches: true, media: query, onchange: null,
        addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop,
        dispatchEvent: () => false,
      } as unknown as MediaQueryList;
    };
    window.addEventListener('load', () => {
      for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList;
        try { rules = sheet.cssRules; } catch { continue; }
        for (const rule of Array.from(rules)) {
          if (rule instanceof CSSMediaRule && rule.media.mediaText.includes('display-mode')) {
            rule.media.mediaText = 'all';
          }
        }
      }
    });
  });
}

/** Make every `localStorage` access throw — the private-browsing/policy case. */
export async function breakLocalStorage(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new Error('storage disabled by policy'); },
    });
  });
}

export async function login(page: Page) {
  await page.goto('/index.html');
  await page.locator('#pb-login-username').fill('player1');
  await page.locator('#pb-login-password').fill('pass');
  await page.locator('#pb-login-submit').click();
}

/**
 * Log in and open the default character's sheet. With one stubbed campaign the
 * picker is skipped, so this lands on the dossier and clicks straight through.
 */
export async function openSheet(page: Page, characterName = 'Marta Voss') {
  await login(page);
  await page.locator('.pb-dossier-card', { hasText: characterName }).click();
  await page.locator('#pb-sheet-header').waitFor();
}

/**
 * Run one of IMPOSTAZIONI's navigation actions: open the popup from the bezel
 * knob, then activate CAMBIA PERSONAGGIO / CAMBIA CAMPAGNA / ESCI.
 */
export async function navigate(page: Page, action: 'changeCharacter' | 'changeCampaign' | 'logout') {
  await page.locator('#pb-config-knob').click();
  await page.locator(`#pb-settings-popup [data-nav-action="${action}"]`).click();
}

/**
 * Select a sheet position by its labels: the first-level tab, then (for a
 * section with subtabs) the subtab. Health lives at `STATS › Salute` and notes
 * at `INFO › Note`, so specs go through here rather than clicking first-level
 * tabs that no longer exist.
 */
/** Exact label match, so a subtab name can never select another containing it. */
const exactly = (label: string) =>
  new RegExp(`^\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);

export async function gotoTab(page: Page, top: string, sub?: string) {
  await page.locator('#pb-tabs-top .pb-tab', { hasText: exactly(top) }).click();
  if (sub) await page.locator('#pb-tabs-sub .pb-subtab', { hasText: exactly(sub) }).click();
}
