import { test, expect, type Page } from '@playwright/test';
import { stubEnvironment, login, makeCharacter, gotoTab, type StubOptions } from './fixtures';

// Covers the health-margin model on the SALUTE tab (pipboy-character-sheet,
// add-health-margin): health = margin − net wear, overshoot above margin, a
// margin editor, the two-column major→minor condition list, the split polarity
// add triggers, and the colour-coded condition catalog picker.

async function openSheet(page: Page, opts: StubOptions = {}) {
  await stubEnvironment(page, {
    role: 'player',
    userId: 'user-player',
    lastCampaignId: 'camp-1',
    lastCharacterId: 'char-1',
    ...opts,
  });
  await login(page);
  await expect(page.getByRole('heading', { name: 'Marta Voss' })).toBeVisible();
  await gotoTab(page, 'STATS', 'Salute');
}

const withStatus = (status: Record<string, unknown>) =>
  makeCharacter({
    id: 'char-1',
    campaignId: 'camp-1',
    userId: 'user-player',
    status: { criticalState: false, positiveConditions: [], negativeConditions: [], ...status },
  });

// ── health = margin − net wear, with the depleting bar ──────────────

test('SALUTE reads health over the character margin and fills the bar', async ({ page }) => {
  await openSheet(page, {
    character: withStatus({
      margin: 6,
      negativeConditions: [{ id: 'n1', name: 'FERITO', severity: 'major' }],
    }),
  });

  // margin 6, net wear 2 → health 4
  await expect(page.locator('#pb-health-value')).toHaveText('4/6');
  await expect(page.locator('#pb-health-value')).not.toHaveClass(/neg/);
  // bar fills to health/margin = 4/6 ≈ 66.7%
  const width = await page.locator('.pb-health-bar-fill').evaluate((el) => el.style.width);
  expect(parseFloat(width)).toBeGreaterThan(60);
  expect(parseFloat(width)).toBeLessThan(70);
});

// ── overshoot: positives can push health above margin, bar clamps ───

test('a positive condition can push health above margin (overshoot), bar clamped', async ({ page }) => {
  await openSheet(page, {
    character: withStatus({
      margin: 6,
      positiveConditions: [{ id: 'p1', name: 'BEN NUTRITO', severity: 'major' }],
    }),
  });

  // margin 6, net wear −2 → health 8 (above margin)
  await expect(page.locator('#pb-health-value')).toHaveText('8/6');
  const width = await page.locator('.pb-health-bar-fill').evaluate((el) => el.style.width);
  expect(parseFloat(width)).toBe(100); // clamped at full
});

// ── critical is health ≤ 0, driven by the character's margin ────────

test('the same net wear is critical at a low margin but not at a high one', async ({ page }) => {
  // margin 3, net wear 3 → health 0 → critical (unlike the legacy fixed 4)
  await openSheet(page, {
    character: withStatus({
      margin: 3,
      negativeConditions: [
        { id: 'n1', name: 'FERITO', severity: 'major' },
        { id: 'n2', name: 'SCOSSO', severity: 'minor' },
      ],
    }),
  });
  await expect(page.locator('#pb-health-value')).toHaveText('0/3');
  await expect(page.locator('#pb-health-value')).toHaveClass(/neg/);
});

// ── margin editor ───────────────────────────────────────────────────

test('the MARGINE stepper writes margin and re-derives criticalState', async ({ page }) => {
  await openSheet(page, {
    character: withStatus({
      margin: 6,
      negativeConditions: [{ id: 'n1', name: 'FERITO', severity: 'major' }],
    }),
  });
  await expect(page.locator('#pb-health-value')).toHaveText('4/6');

  // The MARGINE stepper is an editor-mode structural edit; toggle it on.
  await page.locator('#pb-editor-toggle').click();

  const req = page.waitForRequest((r) => r.url().includes('/status') && r.method() === 'PATCH');
  await page.locator('#pb-margin-stepper button[data-dir="1"]').click();
  // net wear 2 < 7 → still not critical
  expect((await req).postDataJSON()).toEqual({ margin: 7, criticalState: false });
  await expect(page.locator('#pb-health-value')).toHaveText('5/7');
});

// ── margin stepper is editor-mode only ──────────────────────────────

test('the MARGINE stepper is hidden outside editor mode and appears after the ✎ toggle', async ({ page }) => {
  await openSheet(page, { character: withStatus({ margin: 6 }) });

  // Editor mode is off by default: the owner sees no MARGINE stepper…
  await expect(page.locator('#pb-margin-stepper')).toHaveCount(0);
  // …but the polarity add triggers (plain canEdit) are still available.
  await expect(page.locator('#pb-cond-add-neg')).toBeVisible();
  await expect(page.locator('#pb-cond-add-pos')).toBeVisible();

  // Toggling editor mode reveals the stepper.
  await page.locator('#pb-editor-toggle').click();
  await expect(page.locator('#pb-margin-stepper')).toBeVisible();
});

// ── two-column list, ordered major → minor within each column ────────

test('conditions render negatives-left, positives-right, each major before minor', async ({ page }) => {
  await openSheet(page, {
    character: withStatus({
      margin: 8,
      negativeConditions: [
        { id: 'n1', name: 'MINORE', severity: 'minor' },
        { id: 'n2', name: 'MAGGIORE', severity: 'major' },
      ],
      positiveConditions: [
        { id: 'p1', name: 'POS-MIN', severity: 'minor' },
        { id: 'p2', name: 'POS-MAG', severity: 'major' },
      ],
    }),
  });

  // Each column is sorted major → minor regardless of insertion order.
  await expect(page.locator('.pb-cond-col--neg .pb-cond-name')).toHaveText(['MAGGIORE', 'MINORE']);
  await expect(page.locator('.pb-cond-col--pos .pb-cond-name')).toHaveText(['POS-MAG', 'POS-MIN']);
});

// ── split polarity triggers ──────────────────────────────────────────

test('the owner sees − NEGATIVA and + POSITIVA triggers and no single add trigger', async ({ page }) => {
  await openSheet(page, { character: withStatus({}) });

  await expect(page.locator('#pb-cond-add-neg')).toHaveText('− NEGATIVA');
  await expect(page.locator('#pb-cond-add-pos')).toHaveText('+ POSITIVA');
  await expect(page.locator('#pb-cond-add')).toHaveCount(0);
  await expect(page.getByText('+ AGGIUNGI CONDIZIONE')).toHaveCount(0);

  // Side by side, beneath the condition list.
  const negBox = (await page.locator('#pb-cond-add-neg').boundingBox())!;
  const posBox = (await page.locator('#pb-cond-add-pos').boundingBox())!;
  expect(Math.abs(negBox.y - posBox.y)).toBeLessThan(1);
  expect(negBox.x).toBeLessThan(posBox.x);
});

test('a read-only viewer sees neither polarity trigger', async ({ page }) => {
  await openSheet(page, {
    character: makeCharacter({
      id: 'char-1', campaignId: 'camp-1', userId: 'user-player-2',
      status: { criticalState: false, positiveConditions: [], negativeConditions: [] },
    }),
  });

  await expect(page.locator('#pb-cond-add-neg')).toHaveCount(0);
  await expect(page.locator('#pb-cond-add-pos')).toHaveCount(0);
});

// ── catalog picker: colour-coded polarity + signed value ─────────────

test('each polarity picker colour-codes its rows and leads with a signed value', async ({ page }) => {
  await openSheet(page, { character: withStatus({}) });

  // Avvelenato: negative/major → neg accent + −2
  await page.locator('#pb-cond-add-neg').click();
  await page.locator('#pb-cond-existing').click();
  const neg = page.locator('.pb-picker-row', { hasText: 'Avvelenato' });
  await expect(neg).toHaveClass(/pb-picker-row--neg/);
  await expect(neg.locator('.pb-picker-lead')).toHaveText('−2');
  await expect(neg.locator('.pb-picker-meta')).toHaveCount(0);
  await expect(neg).not.toContainText('NEGATIVA');
  await page.locator('.pb-picker-close').click();
  await page.locator('.pb-popup-close').click();

  // Ben Nutrito: positive/minor → pos accent + +1
  await page.locator('#pb-cond-add-pos').click();
  await page.locator('#pb-cond-existing').click();
  const pos = page.locator('.pb-picker-row', { hasText: 'Ben Nutrito' });
  await expect(pos).toHaveClass(/pb-picker-row--pos/);
  await expect(pos.locator('.pb-picker-lead')).toHaveText('+1');
  await expect(pos).not.toContainText('POSITIVA');
});

// The accent must be *visibly rendered*, not merely present as a class: the base
// `.pb-picker-row` rule (declared far below) must not repaint every row green.
test('the catalog picker renders the negative row in the negative colour, not phosphor green', async ({ page }) => {
  await openSheet(page, { character: withStatus({}) });

  // Resolve the theme's accent colours to rgb via a probe element so we can
  // assert the row's *computed* colour, not just its class.
  const colours = await page.evaluate(() => {
    const probe = document.createElement('span');
    document.body.appendChild(probe);
    probe.style.color = 'var(--phosphor)';
    const phosphor = getComputedStyle(probe).color;
    probe.style.color = 'var(--neg)';
    const neg = getComputedStyle(probe).color;
    probe.style.color = 'var(--pos)';
    const pos = getComputedStyle(probe).color;
    probe.remove();
    return { phosphor, neg, pos };
  });

  // The negative row paints the negative accent (not phosphor green)…
  await page.locator('#pb-cond-add-neg').click();
  await page.locator('#pb-cond-existing').click();
  await expect(page.locator('.pb-picker-row', { hasText: 'Avvelenato' })).toHaveCSS('color', colours.neg);
  expect(colours.neg).not.toBe(colours.phosphor);
  await page.locator('.pb-picker-close').click();
  await page.locator('.pb-popup-close').click();

  // …and the positive row stays green.
  await page.locator('#pb-cond-add-pos').click();
  await page.locator('#pb-cond-existing').click();
  await expect(page.locator('.pb-picker-row', { hasText: 'Ben Nutrito' })).toHaveCSS('color', colours.pos);
});

// ── compact rows: signed value + name only ──────────────────────────

test('condition rows show only a signed weight value and the name', async ({ page }) => {
  await openSheet(page, {
    character: withStatus({
      margin: 8,
      negativeConditions: [{ id: 'n1', name: 'STREMATO', severity: 'major' }],
      positiveConditions: [{ id: 'p1', name: 'BEN NUTRITO', severity: 'minor' }],
    }),
  });

  const neg = page.locator('.pb-cond-col--neg .pb-cond-row').first();
  const pos = page.locator('.pb-cond-col--pos .pb-cond-row').first();
  // True minus sign (U+2212), not a hyphen.
  await expect(neg.locator('.pb-cond-value')).toHaveText('−2');
  await expect(neg.locator('.pb-cond-name')).toHaveText('STREMATO');
  await expect(pos.locator('.pb-cond-value')).toHaveText('+1');
  await expect(pos.locator('.pb-cond-name')).toHaveText('BEN NUTRITO');

  // No weight tag, no ✕.
  for (const row of [neg, pos]) {
    const text = await row.innerText();
    for (const gone of ['BASE', 'MODERATA', '×2', '✕']) expect(text).not.toContain(gone);
  }
});

// ── long condition names truncate with … at a constant row height ────
// (the exception to the wrap rule; the picker test below still wraps)

test('a long condition name truncates with an ellipsis and keeps the row height of a short one', async ({ page }) => {
  const longName = 'CONDIZIONELUNGA'.repeat(15);
  await openSheet(page, {
    character: withStatus({
      margin: 8,
      negativeConditions: [
        { id: 'n1', name: longName, severity: 'major' },
        { id: 'n2', name: 'FERITO', severity: 'minor' },
      ],
    }),
  });

  const rows = page.locator('.pb-cond-col--neg .pb-cond-row');
  const longRow = rows.nth(0);
  const shortRow = rows.nth(1);
  const name = longRow.locator('.pb-cond-name');

  await expect(longRow.locator('.pb-cond-value')).toBeVisible();
  await expect(name).toHaveCSS('white-space', 'nowrap');
  await expect(name).toHaveCSS('text-overflow', 'ellipsis');
  // The name is clipped (its content is wider than its box)…
  expect(await name.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  // …while the row itself does not overflow its column.
  expect(await longRow.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);

  // Constant height: the long row is no taller than the short one.
  const longBox = (await longRow.boundingBox())!;
  const shortBox = (await shortRow.boundingBox())!;
  expect(Math.abs(longBox.height - shortBox.height)).toBeLessThanOrEqual(1);

  // The full name is still readable via the tooltip.
  await expect(longRow).toHaveAttribute('title', longName);
});

test('a long catalog-entry name wraps in the picker with its signed lead value visible', async ({ page }) => {
  const longName = 'VOCECATALOGOLUNGA'.repeat(15);
  await openSheet(page, {
    character: withStatus({}),
    conditionsCatalog: [
      { slug: 'long-neg', name: longName, defaultSeverity: 'major', polarity: 'negative' },
    ],
  });

  await page.locator('#pb-cond-add-neg').click();
  await page.locator('#pb-cond-existing').click();
  await expect(page.locator('.pb-picker')).toBeVisible();

  const row = page.locator('.pb-picker-row', { hasText: longName });
  const name = row.locator('.pb-picker-name');
  const lead = row.locator('.pb-picker-lead');

  await expect(lead).toBeVisible();
  await expect(lead).toHaveText('−2');

  const rowBox = (await row.boundingBox())!;
  const nameBox = (await name.boundingBox())!;
  const leadBox = (await lead.boundingBox())!;

  // The lead sits before the name and the name stays inside the row.
  expect(leadBox.x).toBeGreaterThanOrEqual(rowBox.x);
  expect(leadBox.x + leadBox.width).toBeLessThanOrEqual(nameBox.x + 1);
  expect(nameBox.x + nameBox.width).toBeLessThanOrEqual(rowBox.x + rowBox.width + 1);
  const noOverflow = await row.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
  expect(noOverflow).toBe(true);
  // The unbroken token wrapped onto multiple lines rather than being clipped.
  expect(nameBox.height).toBeGreaterThan(30);
});
