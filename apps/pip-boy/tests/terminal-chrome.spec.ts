import { test, expect, type Page } from '@playwright/test';
import { stubEnvironment, login, makeCharacter, seedDice, seedPrefs, rollAndSettle } from './fixtures';

/**
 * The only elements permitted a non-zero border-radius. The status LED is
 * round in the reference design (a 9px circle in the case status bar), so it
 * joins the case, screen, and the three bezel parts as case chrome. The bezel
 * knob and nub carry their own lit state directly — there is no separate LED
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

test('the bottom bezel renders exactly one knob, a ridged grille and a slider nub', async ({ page }) => {
  await stubEnvironment(page);
  await page.goto('/index.html');

  await expect(page.locator('.pb-bezel')).toBeVisible();
  // Exactly three children, in order: the ⚙ knob, the grille, the ✎ nub.
  const children = await page.locator('.pb-bezel > *').evaluateAll((els) => els.map((el) => el.id || el.className));
  expect(children).toEqual(['pb-config-knob', 'pb-grille', 'pb-editor-toggle']);
  await expect(page.locator('.pb-bezel .pb-knob')).toHaveCount(1);

  const knob = await page.locator('#pb-config-knob').boundingBox();
  expect(knob!.width).toBeCloseTo(38, 0);
  expect(knob!.height).toBeCloseTo(38, 0);

  const nub = await page.locator('#pb-editor-toggle').boundingBox();
  expect(nub!.width).toBeCloseTo(64, 0);
  expect(nub!.height).toBeCloseTo(38, 0);
});

test('the bezel controls are at least 36px tap targets on every viewport', async ({ page }) => {
  await stubEnvironment(page);
  await page.goto('/index.html');

  for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(size);
    const knob = await page.locator('#pb-config-knob').boundingBox();
    const nub = await page.locator('#pb-editor-toggle').boundingBox();
    expect(knob!.width, `knob width at ${size.width}x${size.height}`).toBeGreaterThanOrEqual(36);
    expect(knob!.height, `knob height at ${size.width}x${size.height}`).toBeGreaterThanOrEqual(36);
    expect(nub!.height, `nub height at ${size.width}x${size.height}`).toBeGreaterThanOrEqual(36);
  }
});

test('the larger bezel controls do not shrink the screen: the screen-to-case-bottom band is 56px', async ({ page }) => {
  await stubEnvironment(page);
  await page.goto('/index.html');

  // From the screen's bottom edge to the case's inner bottom edge (its 1px
  // outline is not part of the band).
  const band = () =>
    page.evaluate(() => {
      const screen = document.querySelector('.pb-screen')!.getBoundingClientRect();
      const kase = document.querySelector('.pb-case')!;
      return kase.getBoundingClientRect().bottom - parseFloat(getComputedStyle(kase).borderBottomWidth) - screen.bottom;
    });

  await page.setViewportSize({ width: 1280, height: 800 });
  expect(Math.abs((await band()) - 56)).toBeLessThanOrEqual(1);

  // The phone breakpoint's tighter case keeps its own, unchanged band
  // (8px case padding instead of 12px).
  await page.setViewportSize({ width: 390, height: 844 });
  expect(Math.abs((await band()) - 52)).toBeLessThanOrEqual(1);
});

test('the status bar holds only the status and OS labels, no control', async ({ page }) => {
  await stubEnvironment(page);
  await openSheet(page);

  const bar = page.locator('.pb-statusbar');
  await expect(bar.locator('button')).toHaveCount(0);
  await expect(bar.locator('#pb-status-label')).toBeVisible();
  await expect(bar.locator('.pb-status-os')).toHaveText('PIP-BOY OS');
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

test('buttons and inputs are square-cornered, except the bezel knob and the nub', async ({ page }) => {
  await stubEnvironment(page);
  await page.goto('/index.html');

  const radii = await page.$$eval(
    'button:not(#pb-config-knob):not(#pb-editor-toggle), input, select',
    (els) => els.map((el) => getComputedStyle(el).borderRadius),
  );
  expect(radii.length).toBeGreaterThan(0);
  for (const r of radii) expect(r).toBe('0px');

  expect(await page.locator('#pb-config-knob').evaluate((el) => getComputedStyle(el).borderRadius)).toBe('50%');
  expect(await page.locator('#pb-editor-toggle').evaluate((el) => getComputedStyle(el).borderRadius)).toBe('6px');
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

// ── critical chrome ─────────────────────────────────────────────────

test('the sheet header no longer carries the old bracket controls', async ({ page }) => {
  await stubEnvironment(page);
  await openSheet(page);

  await expect(page.locator('.pb-statusbar')).toContainText('PIP-BOY OS');
  await expect(page.locator('.pb-header')).not.toContainText('Personaggi');
  await expect(page.locator('.pb-header')).not.toContainText('Campagna');
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

test('the owner sees the ✎ toggle in the bezel (not the status bar or tab bar)', async ({ page }) => {
  await stubEnvironment(page);
  await openSheet(page);

  await expect(page.locator('.pb-statusbar #pb-editor-toggle')).toHaveCount(0);

  // It seats in the bezel, enabled (and unlit) for the owner — no separate LED.
  await expect(page.locator('.pb-bezel #pb-editor-toggle')).toBeVisible();
  await expect(page.locator('#pb-editor-toggle')).toBeEnabled();
  await expect(page.locator('#pb-editor-toggle')).not.toHaveClass(/on/);

  // The tab bar carries exactly the five content tabs and no toggle.
  await expect(page.locator('.pb-tab[data-top]')).toHaveCount(5);
  await expect(page.locator('#pb-tabs #pb-editor-toggle')).toHaveCount(0);
});

test('a non-owner viewer sees the ✎ toggle, disabled and inert', async ({ page }) => {
  await stubEnvironment(page, {
    role: 'player',
    userId: 'user-player',
    character: makeCharacter({ userId: 'someone-else' }),
  });
  await openSheet(page);

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
  await rollAndSettle(page); // the reroll row renders once the tumble settles

  const bg = await page
    .locator('#pb-dice-reroll-skill option')
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).toBe('rgb(6, 17, 10)');
});
