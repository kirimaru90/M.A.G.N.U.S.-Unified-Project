import { test, expect, type Page } from '@playwright/test';
import { stubEnvironment, login, makeCharacter } from './fixtures';

/**
 * The only elements permitted a non-zero border-radius. The status LED is
 * round in the reference design (a 9px circle in the case status bar), so it
 * joins the case, screen, and the three bezel parts as case chrome.
 */
const ROUNDED_ALLOWLIST = [
  '.pb-case',
  '.pb-screen',
  '.pb-critical-ring',
  '.pb-knob',
  '.pb-grille',
  '.pb-nub',
  '.pb-statusbar .dot',
];

async function openSheet(page: Page) {
  // A single stubbed campaign auto-selects, landing straight on the dossier.
  await login(page);
  await page.locator('.pb-dossier-card', { hasText: 'Marta Voss' }).click();
  await expect(page.getByRole('heading', { name: 'Marta Voss' })).toBeVisible();
}

// ── 4.T.1 CRT layers + bezel ────────────────────────────────────────

test('the bottom bezel renders two knobs, a ridged grille and a slider nub', async ({ page }) => {
  await stubEnvironment(page);
  await page.goto('/index.html');

  await expect(page.locator('.pb-bezel')).toBeVisible();
  await expect(page.locator('.pb-bezel .pb-knob')).toHaveCount(2);
  await expect(page.locator('.pb-bezel .pb-grille')).toHaveCount(1);
  await expect(page.locator('.pb-bezel .pb-nub')).toHaveCount(1);

  const knob = await page.locator('.pb-knob').first().boundingBox();
  expect(knob!.width).toBeCloseTo(22, 0);
  expect(knob!.height).toBeCloseTo(22, 0);

  const nub = await page.locator('.pb-nub').boundingBox();
  expect(nub!.width).toBeCloseTo(34, 0);
  expect(nub!.height).toBeCloseTo(12, 0);
});

test('the scanline sweep exists and carries an animation', async ({ page }) => {
  await stubEnvironment(page);
  await page.goto('/index.html');

  const sweep = page.locator('.pb-scanline-sweep');
  await expect(sweep).toHaveCount(1);

  const anim = await sweep.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { name: cs.animationName, duration: cs.animationDuration, timing: cs.animationTimingFunction };
  });
  expect(anim.name).not.toBe('none');
  expect(anim.duration).toBe('7s');
  expect(anim.timing).toBe('linear');
});

test('the flicker animation runs on the screen with the specified duration', async ({ page }) => {
  await stubEnvironment(page);
  await page.goto('/index.html');

  const anim = await page.locator('.pb-screen').evaluate((el) => {
    const cs = getComputedStyle(el);
    return { name: cs.animationName, duration: cs.animationDuration };
  });
  expect(anim.name).toBe('crtFlicker');
  expect(anim.duration).toBe('4s');
});

test('the texture and vignette overlays are non-interactive, and a control beneath stays clickable', async ({ page }) => {
  await stubEnvironment(page);
  await page.goto('/index.html');

  for (const sel of ['.pb-scanline-texture', '.pb-vignette', '.pb-scanline-sweep']) {
    const pe = await page.locator(sel).evaluate((el) => getComputedStyle(el).pointerEvents);
    expect(pe, `${sel} must not intercept input`).toBe('none');
  }

  // The submit control sits beneath all three overlays and must still receive the click.
  await page.locator('#pb-login-username').fill('player1');
  await page.locator('#pb-login-password').fill('pass');
  await page.locator('#pb-login-submit').click();
  await expect(page.locator('#pb-char-list')).toBeVisible();
});

test('all four CRT layers persist across a tab switch', async ({ page }) => {
  await stubEnvironment(page);
  await openSheet(page);

  const layersPresent = async () => ({
    glow: await page.locator('.pb-screen').evaluate((el) => getComputedStyle(el).textShadow),
    innerGlow: await page.locator('.pb-screen').evaluate((el) => getComputedStyle(el).boxShadow),
    flicker: await page.locator('.pb-screen').evaluate((el) => getComputedStyle(el).animationName),
    sweep: await page.locator('.pb-scanline-sweep').count(),
  });

  const before = await layersPresent();
  await page.locator('.pb-tab', { hasText: 'Dadi' }).click();
  const after = await layersPresent();

  expect(after).toEqual(before);
  expect(before.flicker).toBe('crtFlicker');
  expect(before.sweep).toBe(1);
  expect(before.glow).toContain('rgba(51, 255, 102');
});

// ── 4.T.2 border-radius discipline ──────────────────────────────────

test('no element carries a non-zero border-radius except the case, screen, ring and bezel parts', async ({ page }) => {
  await stubEnvironment(page);
  await openSheet(page);

  const offenders = await page.evaluate((allowlist) => {
    const allowed = new Set<Element>();
    for (const sel of allowlist) document.querySelectorAll(sel).forEach((el) => allowed.add(el));

    const bad: Array<{ tag: string; cls: string; radius: string }> = [];
    for (const el of Array.from(document.querySelectorAll('*'))) {
      if (allowed.has(el)) continue;
      const r = getComputedStyle(el).borderRadius;
      if (r && r !== '0px' && r !== '0%') {
        bad.push({ tag: el.tagName, cls: (el as HTMLElement).className?.toString() ?? '', radius: r });
      }
    }
    return bad;
  }, ROUNDED_ALLOWLIST);

  expect(offenders).toEqual([]);
});

test('the case, screen, grille and nub carry their specified radii', async ({ page }) => {
  await stubEnvironment(page);
  await page.goto('/index.html');
  await page.setViewportSize({ width: 1280, height: 800 });

  const radius = (sel: string) =>
    page.locator(sel).first().evaluate((el) => getComputedStyle(el).borderRadius);

  expect(await radius('.pb-case')).toBe('26px');
  expect(await radius('.pb-screen')).toBe('14px');
  expect(await radius('.pb-grille')).toBe('3px');
  expect(await radius('.pb-nub')).toBe('6px');
  expect(await radius('.pb-knob')).toBe('50%');
});

test('buttons and inputs are square-cornered', async ({ page }) => {
  await stubEnvironment(page);
  await page.goto('/index.html');

  const radii = await page.$$eval('button, input, select', (els) =>
    els.map((el) => getComputedStyle(el).borderRadius),
  );
  expect(radii.length).toBeGreaterThan(0);
  for (const r of radii) expect(r).toBe('0px');
});

// ── 4.T.3 glyphs, not emoji ─────────────────────────────────────────

test('no emoji appears in rendered text on any screen', async ({ page }) => {
  await stubEnvironment(page);

  const assertNoEmoji = async () => {
    const text = await page.locator('body').innerText();
    // Pictographs, symbols/dingbats, flags, and the variation selector.
    const emoji = /[\u{1F000}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
    expect(text).not.toMatch(emoji);
  };

  await page.goto('/index.html');
  await assertNoEmoji();

  await login(page);
  await expect(page.locator('#pb-char-list')).toBeVisible();
  await assertNoEmoji();

  await page.locator('.pb-dossier-card', { hasText: 'Marta Voss' }).click();
  await expect(page.getByRole('heading', { name: 'Marta Voss' })).toBeVisible();
  await assertNoEmoji();
});

// ── 4.T.4 login copy ────────────────────────────────────────────────

test('login renders the reference copy', async ({ page }) => {
  await stubEnvironment(page);
  await page.goto('/index.html');

  await expect(page.getByRole('heading', { name: 'M.A.G.N.U.S.' })).toBeVisible();
  await expect(page.getByText('ROBCO · TERMINALE DI CAMPO · OS v2.3')).toBeVisible();
  await expect(page.getByText('> AUTENTICAZIONE RICHIESTA')).toBeVisible();
  await expect(page.getByText('> INSERIRE CREDENZIALI RANGER')).toBeVisible();
  await expect(page.getByText('ID UTENTE')).toBeVisible();
  await expect(page.getByText('CODICE DI ACCESSO')).toBeVisible();
  await expect(page.locator('#pb-login-submit')).toHaveText('▸ ACCEDI');
});

test('login does not claim a first login registers a new id', async ({ page }) => {
  await stubEnvironment(page);
  await page.goto('/index.html');

  const text = (await page.locator('body').innerText()).toLowerCase();
  expect(text).not.toContain('registr');
});

test('a failed auth shows an amber ⚠ inline error', async ({ page }) => {
  await stubEnvironment(page);
  await page.route('**/auth/login', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
  );
  await page.goto('/index.html');

  await page.locator('#pb-login-username').fill('nope');
  await page.locator('#pb-login-password').fill('nope');
  await page.locator('#pb-login-submit').click();

  const error = page.locator('#pb-login-error');
  await expect(error).toBeVisible();
  await expect(error).toContainText('⚠');
  await expect(error).toHaveCSS('color', 'rgb(255, 176, 46)');
});

// One test per field: a successful login persists its token, so a second
// goto() in the same context would rehydrate straight past the login screen.
for (const field of ['#pb-login-username', '#pb-login-password']) {
  test(`Enter submits from ${field}`, async ({ page }) => {
    await stubEnvironment(page);
    await page.goto('/index.html');

    await page.locator('#pb-login-username').fill('player1');
    await page.locator('#pb-login-password').fill('pass');
    await page.locator(field).press('Enter');

    await expect(page.locator('#pb-char-list')).toBeVisible();
  });
}

// ── status bar nav + critical chrome ────────────────────────────────

test('the status bar carries the sheet-only nav, and hides it elsewhere', async ({ page }) => {
  await stubEnvironment(page);
  await page.goto('/index.html');

  // login: no nav
  await expect(page.locator('#pb-statusbar-nav')).toBeHidden();

  await login(page);
  await expect(page.locator('#pb-char-list')).toBeVisible();
  await expect(page.locator('#pb-statusbar-nav')).toBeHidden();

  await page.locator('.pb-dossier-card', { hasText: 'Marta Voss' }).click();
  await expect(page.getByRole('heading', { name: 'Marta Voss' })).toBeVisible();

  await expect(page.locator('#pb-nav-dossier')).toBeVisible();
  await expect(page.locator('#pb-nav-logout')).toBeVisible();
  await expect(page.locator('.pb-statusbar')).toContainText('PIP-BOY OS');

  // the sheet header no longer carries the old bracket controls
  await expect(page.locator('.pb-header')).not.toContainText('Personaggi');
  await expect(page.locator('.pb-header')).not.toContainText('Campagna');
});

test('◄ DOSSIER returns to character selection and hides the nav again', async ({ page }) => {
  await stubEnvironment(page);
  await openSheet(page);

  await page.locator('#pb-nav-dossier').click();
  await expect(page.locator('#pb-char-list')).toBeVisible();
  await expect(page.locator('#pb-statusbar-nav')).toBeHidden();
});

test('critical state rings the screen amber and swaps the status dot', async ({ page }) => {
  await stubEnvironment(page, {
    character: makeCharacter({
      status: { positiveConditions: [], negativeConditions: [], criticalState: true },
    }),
  });
  await openSheet(page);

  await expect(page.locator('#pb-critical-ring')).toBeVisible();
  await expect(page.locator('.pb-statusbar')).toHaveClass(/critical/);

  const ring = await page.locator('#pb-critical-ring').evaluate((el) => {
    const cs = getComputedStyle(el);
    return { border: cs.borderTopColor, pe: cs.pointerEvents, radius: cs.borderRadius };
  });
  expect(ring.border).toBe('rgba(255, 176, 46, 0.5)');
  expect(ring.pe).toBe('none');
  expect(ring.radius).toBe('14px');
});

test('a non-critical character shows no ring and a green status dot', async ({ page }) => {
  await stubEnvironment(page);
  await openSheet(page);

  await expect(page.locator('#pb-critical-ring')).toBeHidden();
  await expect(page.locator('.pb-statusbar')).not.toHaveClass(/critical/);
});
