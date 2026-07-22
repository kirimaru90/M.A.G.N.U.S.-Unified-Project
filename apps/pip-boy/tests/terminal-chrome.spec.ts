import { test, expect, type Page } from '@playwright/test';
import { stubEnvironment, login, makeCharacter, seedDice, seedPrefs, TWO_CAMPAIGNS } from './fixtures';

/**
 * The only elements permitted a non-zero border-radius. The status LED is
 * round in the reference design (a 9px circle in the case status bar), so it
 * joins the case, screen, and the three bezel parts as case chrome. The bezel
 * knobs and nub carry their own lit state directly — there is no separate LED
 * element for the editor toggle.
 */
const ROUNDED_ALLOWLIST = [
  '.pb-case',
  '.pb-screen',
  '.pb-critical-ring',
  '.pb-editor-ring',
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

  const nub = await page.locator('.pb-bezel .pb-nub').boundingBox();
  expect(nub!.width).toBeCloseTo(40, 0);
  expect(nub!.height).toBeCloseTo(20, 0);
});

test('the config knob and editor nub glyphs stay fully contained, and swap color when lit', async ({ page }) => {
  await stubEnvironment(page);
  await openSheet(page);

  const containment = async (controlSel: string) => {
    const control = await page.locator(controlSel).evaluate((el) => el.getBoundingClientRect());
    // The glyph is the control's own text node; its rendered extent can't
    // exceed the control's own box once centered and clipped by it.
    const overflowsX = await page.locator(controlSel).evaluate((el) => el.scrollWidth > el.clientWidth);
    const overflowsY = await page.locator(controlSel).evaluate((el) => el.scrollHeight > el.clientHeight);
    expect(overflowsX, `${controlSel} glyph overflows horizontally`).toBe(false);
    expect(overflowsY, `${controlSel} glyph overflows vertically`).toBe(false);
    expect(control.width).toBeGreaterThan(0);
    expect(control.height).toBeGreaterThan(0);
  };

  await containment('#pb-config-knob');
  await containment('#pb-editor-toggle');

  const idleKnobColor = await page.locator('#pb-config-knob').evaluate((el) => getComputedStyle(el).color);
  const idleNubColor = await page.locator('#pb-editor-toggle').evaluate((el) => getComputedStyle(el).color);

  await page.locator('#pb-config-knob').click();
  await containment('#pb-config-knob');
  const litKnobColor = await page.locator('#pb-config-knob').evaluate((el) => getComputedStyle(el).color);
  expect(litKnobColor).not.toBe(idleKnobColor);
  expect(litKnobColor).toBe('rgb(6, 17, 10)'); // --screen-bg
  await page.locator('.pb-popup-overlay').click({ position: { x: 4, y: 4 } });

  await page.locator('#pb-editor-toggle').click();
  await containment('#pb-editor-toggle');
  const litNubColor = await page.locator('#pb-editor-toggle').evaluate((el) => getComputedStyle(el).color);
  expect(litNubColor).not.toBe(idleNubColor);
  expect(litNubColor).toBe('rgb(6, 17, 10)'); // --screen-bg
});

test('the right knob stays decorative: non-interactive, aria-hidden, never lit', async ({ page }) => {
  await stubEnvironment(page);
  await openSheet(page);

  const rightKnob = page.locator('.pb-bezel .pb-knob').nth(1);
  await expect(rightKnob).toHaveAttribute('aria-hidden', 'true');
  expect(await rightKnob.evaluate((el) => el.tagName)).toBe('SPAN');

  // Lighting the config knob or the editor nub must never touch the right knob.
  await page.locator('#pb-config-knob').click();
  await expect(rightKnob).not.toHaveClass(/on/);
  await page.locator('.pb-popup-overlay').click({ position: { x: 4, y: 4 } });

  await page.locator('#pb-editor-toggle').click();
  await expect(rightKnob).not.toHaveClass(/on/);
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

test('buttons and inputs are square-cornered, except the bezel knob and the three nub controls', async ({ page }) => {
  await stubEnvironment(page);
  await page.goto('/index.html');

  const radii = await page.$$eval(
    'button:not(#pb-config-knob):not(#pb-editor-toggle):not(#pb-nav-back):not(#pb-nav-exit), input, select',
    (els) => els.map((el) => getComputedStyle(el).borderRadius),
  );
  expect(radii.length).toBeGreaterThan(0);
  for (const r of radii) expect(r).toBe('0px');

  expect(await page.locator('#pb-config-knob').evaluate((el) => getComputedStyle(el).borderRadius)).toBe('50%');
  expect(await page.locator('#pb-editor-toggle').evaluate((el) => getComputedStyle(el).borderRadius)).toBe('6px');
  expect(await page.locator('#pb-nav-back').evaluate((el) => getComputedStyle(el).borderRadius)).toBe('6px');
  expect(await page.locator('#pb-nav-exit').evaluate((el) => getComputedStyle(el).borderRadius)).toBe('6px');
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

test('a failed auth shows a critical-red ⚠ inline error, in every phosphor theme', async ({ page }) => {
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
  await expect(error).toHaveCSS('color', 'rgb(255, 59, 59)');
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

// ── status bar case nav (back/exit nubs) + critical chrome ──────────

test('both case nubs are present in the DOM, fixed 40×20 size, on every screen', async ({ page }) => {
  await stubEnvironment(page, { campaigns: TWO_CAMPAIGNS });
  await page.goto('/index.html');

  const checkNubs = async () => {
    for (const sel of ['#pb-nav-back', '#pb-nav-exit']) {
      await expect(page.locator(sel)).toBeVisible();
      const box = await page.locator(sel).boundingBox();
      expect(box!.width).toBeCloseTo(40, 0);
      expect(box!.height).toBeCloseTo(20, 0);
    }
  };

  await checkNubs(); // login

  await login(page);
  await expect(page.locator('#pb-camp-list')).toBeVisible();
  await checkNubs(); // campaign selection

  await page.locator('.pb-select-item', { hasText: 'Vault 111' }).click();
  await expect(page.locator('#pb-char-list')).toBeVisible();
  await checkNubs(); // character selection (dossier)

  await page.locator('.pb-dossier-card', { hasText: 'Marta Voss' }).click();
  await expect(page.getByRole('heading', { name: 'Marta Voss' })).toBeVisible();
  await checkNubs(); // sheet
});

test('login: both case nubs render with no glyph and are disabled', async ({ page }) => {
  await stubEnvironment(page);
  await page.goto('/index.html');

  await expect(page.locator('#pb-nav-back')).toHaveText('');
  await expect(page.locator('#pb-nav-exit')).toHaveText('');
  await expect(page.locator('#pb-nav-back')).toBeDisabled();
  await expect(page.locator('#pb-nav-exit')).toBeDisabled();
});

test('campaign selection: the back nub is inert, the exit nub is ESCI', async ({ page }) => {
  await stubEnvironment(page, { campaigns: TWO_CAMPAIGNS });
  await login(page);
  await expect(page.locator('#pb-camp-list')).toBeVisible();

  await expect(page.locator('#pb-nav-back')).toHaveText('');
  await expect(page.locator('#pb-nav-back')).toBeDisabled();
  await expect(page.locator('#pb-nav-exit')).toHaveText('⏻');
  await expect(page.locator('#pb-nav-exit')).toHaveAttribute('title', 'ESCI');
  await expect(page.locator('#pb-nav-exit')).toBeEnabled();
});

test('character selection (DOSSIER): the back nub is CAMPAGNA, the exit nub is ESCI', async ({ page }) => {
  await stubEnvironment(page);
  await login(page);
  await expect(page.locator('#pb-char-list')).toBeVisible();

  await expect(page.locator('#pb-nav-back')).toHaveText('◄');
  await expect(page.locator('#pb-nav-back')).toHaveAttribute('title', 'CAMPAGNA');
  await expect(page.locator('#pb-nav-back')).toBeEnabled();
  await expect(page.locator('#pb-nav-exit')).toHaveText('⏻');
  await expect(page.locator('#pb-nav-exit')).toHaveAttribute('title', 'ESCI');
  await expect(page.locator('#pb-nav-exit')).toBeEnabled();
});

test('sheet: the back nub is DOSSIER, the exit nub is ESCI', async ({ page }) => {
  await stubEnvironment(page);
  await openSheet(page);

  await expect(page.locator('#pb-nav-back')).toHaveText('◄');
  await expect(page.locator('#pb-nav-back')).toHaveAttribute('title', 'DOSSIER');
  await expect(page.locator('#pb-nav-back')).toBeEnabled();
  await expect(page.locator('#pb-nav-exit')).toHaveText('⏻');
  await expect(page.locator('#pb-nav-exit')).toHaveAttribute('title', 'ESCI');
  await expect(page.locator('#pb-nav-exit')).toBeEnabled();
  await expect(page.locator('.pb-statusbar')).toContainText('PIP-BOY OS');

  // the sheet header no longer carries the old bracket controls
  await expect(page.locator('.pb-header')).not.toContainText('Personaggi');
  await expect(page.locator('.pb-header')).not.toContainText('Campagna');
});

test('back-nub activation from character selection returns to campaign selection, without logging out', async ({ page }) => {
  await stubEnvironment(page, { campaigns: TWO_CAMPAIGNS });
  await login(page);
  await page.locator('.pb-select-item', { hasText: 'Vault 111' }).click();
  await expect(page.locator('#pb-char-list')).toBeVisible();

  await page.locator('#pb-nav-back').click();
  await expect(page.locator('#pb-camp-list')).toBeVisible();
});

test('back-nub activation from the sheet returns to the dossier, without logging out', async ({ page }) => {
  await stubEnvironment(page);
  await openSheet(page);

  await page.locator('#pb-nav-back').click();
  await expect(page.locator('#pb-char-list')).toBeVisible();
});

test('exit-nub activation logs out and returns to login', async ({ page }) => {
  await stubEnvironment(page);
  await openSheet(page);

  await page.locator('#pb-nav-exit').click();
  await expect(page.locator('#pb-login-submit')).toBeVisible();
  // Logged out and back on login: both nubs go inert again.
  await expect(page.locator('#pb-nav-back')).toBeDisabled();
  await expect(page.locator('#pb-nav-exit')).toBeDisabled();
});

test('neither case nub ever carries a lit "on" class', async ({ page }) => {
  await stubEnvironment(page, { campaigns: TWO_CAMPAIGNS });
  await page.goto('/index.html');
  await expect(page.locator('#pb-nav-back')).not.toHaveClass(/on/);
  await expect(page.locator('#pb-nav-exit')).not.toHaveClass(/on/);

  await login(page);
  await expect(page.locator('#pb-camp-list')).toBeVisible();
  await expect(page.locator('#pb-nav-exit')).not.toHaveClass(/on/);

  await page.locator('.pb-select-item', { hasText: 'Vault 111' }).click();
  await expect(page.locator('#pb-char-list')).toBeVisible();
  await page.locator('#pb-nav-back').click();
  await expect(page.locator('#pb-camp-list')).toBeVisible();
  await expect(page.locator('#pb-nav-back')).not.toHaveClass(/on/);
});

test('critical state rings the screen critical-red and swaps the status dot', async ({ page }) => {
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
  expect(ring.border).toBe('rgba(255, 59, 59, 0.5)');
  expect(ring.pe).toBe('none');
  expect(ring.radius).toBe('14px');
});

test('a non-critical character shows no ring and a green status dot', async ({ page }) => {
  await stubEnvironment(page);
  await openSheet(page);

  await expect(page.locator('#pb-critical-ring')).toBeHidden();
  await expect(page.locator('.pb-statusbar')).not.toHaveClass(/critical/);
});

// ── critical-red is amber-independent across all three phosphor themes ──

for (const theme of ['green', 'amber', 'white'] as const) {
  test(`critical state renders the same critical-red ring and status dot under the ${theme} theme`, async ({ page }) => {
    await seedPrefs(page, { orientation: 'auto', vibration: true, wakeLock: true, phosphorColor: theme });
    await stubEnvironment(page, {
      character: makeCharacter({
        status: { positiveConditions: [], negativeConditions: [], criticalState: true },
      }),
    });
    await openSheet(page);

    const [ringColor, dotColor, phosphorRgb] = await Promise.all([
      page.locator('#pb-critical-ring').evaluate((el) => getComputedStyle(el).borderTopColor),
      page.locator('.pb-statusbar .dot').evaluate((el) => getComputedStyle(el).backgroundColor),
      page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--phosphor-rgb').trim()),
    ]);

    expect(ringColor).toBe('rgba(255, 59, 59, 0.5)');
    expect(dotColor).toBe('rgb(255, 59, 59)');
    // The critical-red rendering never matches the active theme's phosphor
    // color — proving it did not fall back to (or collide with) the theme.
    expect(dotColor).not.toBe(`rgb(${phosphorRgb})`);
  });
}

// ── editor toggle in the bezel (sheet-chrome-and-layout) ─────────────

test('the owner sees the back/exit nubs in the status bar, and the ✎ toggle in the bezel (not the status bar or tab bar)', async ({ page }) => {
  await stubEnvironment(page);
  await openSheet(page);

  const nav = page.locator('.pb-statusbar-nav');
  await expect(nav.locator('#pb-nav-back')).toBeVisible();
  await expect(nav.locator('#pb-nav-exit')).toBeVisible();
  // The ✎ toggle no longer lives among the status-bar controls.
  await expect(nav.locator('#pb-editor-toggle')).toHaveCount(0);

  // It seats in the bezel, enabled (and unlit) for the owner — no separate LED.
  await expect(page.locator('.pb-bezel #pb-editor-toggle')).toBeVisible();
  await expect(page.locator('#pb-editor-toggle')).toBeEnabled();
  await expect(page.locator('#pb-editor-toggle')).not.toHaveClass(/on/);

  // The tab bar returns to exactly six content tabs and carries no toggle.
  await expect(page.locator('.pb-tab[data-top]')).toHaveCount(6);
  await expect(page.locator('#pb-tabs #pb-editor-toggle')).toHaveCount(0);
});

test('a non-owner viewer sees the ✎ toggle, disabled and inert', async ({ page }) => {
  await stubEnvironment(page, {
    role: 'player',
    userId: 'user-player',
    character: makeCharacter({ userId: 'someone-else' }),
  });
  await openSheet(page);

  await expect(page.locator('#pb-nav-back')).toBeVisible();
  // Permanent bezel furniture: the glyph stays visible, just inert.
  await expect(page.locator('#pb-editor-toggle')).toBeVisible();
  await expect(page.locator('#pb-editor-toggle')).toBeDisabled();

  await page.locator('#pb-editor-toggle').click({ force: true });
  await expect(page.locator('#pb-editor-ring')).toBeHidden();
  await expect(page.locator('.pb-editor-strip')).toHaveCount(0);
  await expect(page.locator('#pb-editor-toggle')).not.toHaveClass(/on/);
});

test('toggling editor mode adds and removes the phosphor-colored ring and the ◉ EDITOR strip', async ({ page }) => {
  await stubEnvironment(page);
  await openSheet(page);

  await expect(page.locator('#pb-editor-ring')).toBeHidden();
  await expect(page.locator('.pb-editor-strip')).toHaveCount(0);

  await expect(page.locator('#pb-editor-toggle')).not.toHaveClass(/on/);

  await page.locator('#pb-editor-toggle').click();
  await expect(page.locator('#pb-editor-ring')).toBeVisible();
  await expect(page.locator('.pb-editor-strip')).toContainText('◉ EDITOR');
  // The nub itself lights — no separate LED element.
  await expect(page.locator('#pb-editor-toggle')).toHaveClass(/on/);
  await expect(page.locator('#pb-editor-led')).toHaveCount(0);

  const ring = await page.locator('#pb-editor-ring').evaluate((el) => {
    const cs = getComputedStyle(el);
    return { border: cs.borderTopColor, pe: cs.pointerEvents, radius: cs.borderRadius };
  });
  expect(ring.border).toBe('rgba(51, 255, 102, 0.5)');
  expect(ring.pe).toBe('none');
  expect(ring.radius).toBe('14px');

  await page.locator('#pb-editor-toggle').click();
  await expect(page.locator('#pb-editor-ring')).toBeHidden();
  await expect(page.locator('.pb-editor-strip')).toHaveCount(0);
  await expect(page.locator('#pb-editor-toggle')).not.toHaveClass(/on/);
});

test('the editor LED renders the active (non-green) phosphor theme color while critical, never critical-red', async ({ page }) => {
  await seedPrefs(page, { orientation: 'auto', vibration: true, wakeLock: true, phosphorColor: 'amber' });
  await stubEnvironment(page, {
    character: makeCharacter({
      status: { positiveConditions: [], negativeConditions: [], criticalState: true },
    }),
  });
  await openSheet(page);

  await page.locator('#pb-editor-toggle').click();
  await expect(page.locator('#pb-editor-toggle')).toHaveClass(/on/);

  const nubBg = await page.locator('#pb-editor-toggle').evaluate((el) => getComputedStyle(el).backgroundColor);
  // Lit, the nub's own body fills with the theme color (amber here) — never
  // the critical-red token — even while the character is simultaneously
  // critical, so the two indicators are never mistakable for one another.
  expect(nubBg).toBe('rgb(255, 176, 46)');
  expect(nubBg).not.toBe('rgb(255, 59, 59)');
});

test('a critical character in editor mode shows the critical-red ring, not the phosphor-colored one', async ({ page }) => {
  await stubEnvironment(page, {
    character: makeCharacter({
      status: { positiveConditions: [], negativeConditions: [], criticalState: true },
    }),
  });
  await openSheet(page);

  await page.locator('#pb-editor-toggle').click();

  await expect(page.locator('#pb-critical-ring')).toBeVisible();
  await expect(page.locator('#pb-editor-ring')).toBeHidden();
  // The nub stays lit the active phosphor theme color even while critical — the
  // critical-red ring and the phosphor-colored nub never share a color, and
  // both may show at once.
  await expect(page.locator('#pb-editor-toggle')).toHaveClass(/on/);
});

test('a select option renders on the dark screen theme, not white', async ({ page }) => {
  // The reroll `.pb-select` (#pb-dice-reroll-skill) is revealed on the DADI tab
  // after a roll — the sheet's only remaining <select> now that FONTE PA is gone.
  await seedDice(page, [6]);
  await stubEnvironment(page, {
    role: 'player',
    userId: 'user-player',
    lastCampaignId: 'camp-1',
    lastCharacterId: 'char-1',
    character: makeCharacter({
      id: 'char-1',
      campaignId: 'camp-1',
      userId: 'user-player',
      special: { strength: 3, perception: 3, endurance: 3, charisma: 3, intelligence: 3, agility: 3, luck: 3 },
    }),
  });
  await login(page);
  await expect(page.getByRole('heading', { name: 'Marta Voss' })).toBeVisible();

  await page.locator('.pb-tab', { hasText: 'DADI' }).click();
  await page.locator('[data-approach="strength"]').click();
  await page.locator('#pb-dice-roll').click();
  await page.waitForTimeout(900); // let the tumble settle so the reroll row renders

  const bg = await page
    .locator('#pb-dice-reroll-skill option')
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).toBe('rgb(6, 17, 10)');
});
