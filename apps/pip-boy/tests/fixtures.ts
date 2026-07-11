import type { Page, Route } from '@playwright/test';

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
    inventory: { weapons: [], equip: [], consumables: [], other: [] },
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

export const DEFAULT_PLAYERS = [
  { id: 'user-player', username: 'player1', role: 'player' },
  { id: 'user-player-2', username: 'player2', role: 'player' },
];

export const DEFAULT_SPECIES_CATALOG = [
  { slug: 'human', name: 'Umano', permesso: 'Versatilità completa.', svantaggio: 'Nessun talento sovrannaturale.', tagSkillBudget: 4 },
  { slug: 'ghoul', name: 'Ghoul', permesso: 'Immune alle radiazioni.', svantaggio: 'Inviso agli umani.', tagSkillBudget: 3 },
  { slug: 'super_mutant', name: 'Supermutante', permesso: 'Forza sovrumana.', svantaggio: 'Respinto nei contesti civili.', tagSkillBudget: 3 },
  { slug: 'robot', name: 'Robot', permesso: 'Immune a veleni.', svantaggio: 'Vulnerabile a EMP.', tagSkillBudget: 3 },
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
  { slug: 'stimpack', name: 'Stimpack', kind: 'consumable', isStarter: true, tags: [], defaultQuantity: 2 },
];

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
  speciesCatalog?: typeof DEFAULT_SPECIES_CATALOG;
  starterEquipment?: typeof DEFAULT_STARTER_EQUIPMENT;
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
  const speciesCatalog = opts.speciesCatalog ?? DEFAULT_SPECIES_CATALOG;
  const starterEquipment = opts.starterEquipment ?? DEFAULT_STARTER_EQUIPMENT;
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
    return next;
  }));
  await page.route(/\/characters\/[^/]+\/action-points$/, patchSection('actionPoints', (body) => ({ ...character.actionPoints, ...body })));
  await page.route(/\/characters\/[^/]+\/resources$/, patchSection('resources', (body) => ({ ...character.resources, ...body })));
  await page.route(/\/characters\/[^/]+\/inventory$/, patchSection('inventory', (body: any) => {
    const next = { ...character.inventory };
    for (const section of ['weapons', 'equip', 'consumables', 'other']) {
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

  await page.route('**/skills-catalog', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(skillsCatalog) }),
  );
  await page.route('**/conditions-catalog', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(conditionsCatalog) }),
  );
  await page.route('**/species-catalog', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(speciesCatalog) }),
  );
  // The wizard requests only starter templates; the stub set is all starters.
  await page.route('**/equipment-catalog*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(starterEquipment) }),
  );
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

  return { character, characters, campaigns, players, skillsCatalog, conditionsCatalog };
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
