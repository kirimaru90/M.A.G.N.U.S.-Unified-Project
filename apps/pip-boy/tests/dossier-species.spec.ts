import { test, expect } from '@playwright/test';
import { stubEnvironment, login, makeCharacter } from './fixtures';

// The dossier card's species/PA/tappi meta line names the species as the
// catalog does, resolved the same way as the sheet header's species chip.

test('the dossier meta line uses the species catalog name', async ({ page }) => {
  await stubEnvironment(page, {
    characters: [
      makeCharacter({ id: 'char-1', name: 'Marta Voss', species: 'human' }),
      makeCharacter({ id: 'char-2', name: 'Fawkes', species: 'super_mutant' }),
    ],
  });
  await login(page);

  const marta = page.locator('.pb-dossier-card', { hasText: 'Marta Voss' }).locator('.pb-label').first();
  const fawkes = page.locator('.pb-dossier-card', { hasText: 'Fawkes' }).locator('.pb-label').first();
  await expect(marta).toHaveText(/^\s*Umano · PA /);
  await expect(fawkes).toHaveText(/^\s*Supermutante · PA /);
});

test('the dossier meta line falls back to the slug for a species missing from the catalog', async ({ page }) => {
  await stubEnvironment(page, {
    characters: [makeCharacter({ id: 'char-1', name: 'Marta Voss', species: 'deathclaw' })],
  });
  await login(page);

  const meta = page.locator('.pb-dossier-card', { hasText: 'Marta Voss' }).locator('.pb-label').first();
  await expect(meta).toHaveText(/^\s*deathclaw · PA /);
});
