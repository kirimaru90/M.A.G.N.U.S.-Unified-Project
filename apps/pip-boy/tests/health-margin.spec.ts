import { test, expect, type Page } from '@playwright/test';
import { stubEnvironment, login, makeCharacter, type StubOptions } from './fixtures';

// Covers the health-margin model on the SALUTE tab (pipboy-character-sheet,
// add-health-margin): health = margin − net wear, overshoot above margin, a
// margin editor, the two-column major→minor condition list, and the colour-coded
// condition catalog picker.

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
  await page.locator('.pb-tab', { hasText: 'SALUTE' }).click();
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

  const req = page.waitForRequest((r) => r.url().includes('/status') && r.method() === 'PATCH');
  await page.locator('#pb-margin-stepper button[data-dir="1"]').click();
  // net wear 2 < 7 → still not critical
  expect((await req).postDataJSON()).toEqual({ margin: 7, criticalState: false });
  await expect(page.locator('#pb-health-value')).toHaveText('5/7');
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

// ── catalog picker: colour-coded polarity + weight abbreviation ──────

test('the condition catalog picker colour-codes polarity and shows a weight abbreviation', async ({ page }) => {
  await openSheet(page, { character: withStatus({}) });

  await page.locator('#pb-cond-add').click();
  await page.locator('#pb-cond-existing').click();
  await expect(page.locator('.pb-picker')).toBeVisible();

  // Avvelenato: negative/major → neg accent + ×2 ; Ben Nutrito: positive/minor → pos accent + ×1
  const neg = page.locator('.pb-picker-row', { hasText: 'Avvelenato' });
  await expect(neg).toHaveClass(/pb-picker-row--neg/);
  await expect(neg.locator('.pb-picker-meta')).toHaveText('×2');

  const pos = page.locator('.pb-picker-row', { hasText: 'Ben Nutrito' });
  await expect(pos).toHaveClass(/pb-picker-row--pos/);
  await expect(pos.locator('.pb-picker-meta')).toHaveText('×1');

  // Polarity is colour only — no NEGATIVA/POSITIVA text on the rows.
  await expect(neg).not.toContainText('NEGATIVA');
  await expect(pos).not.toContainText('POSITIVA');
});
