import { test, expect } from '@playwright/test';
import {
  MAP_TONE,
  PHOSPHOR_THEMES,
  filterOutput,
  toneLevel,
  toneTable,
} from '../src/shared/map-core/style.js';

// Pure unit tests for the basemap tint's maths (pipboy-map-tab, design D8/D9):
// no page, no DOM. The pixel colours are the ones measured on CARTO's
// dark_nolabels tiles; if CARTO restyles, these are the numbers to re-measure
// (apps/pip-boy/tools/map-lab shows the tiles through the same tint). The
// lookup tables the tiles are tinted with are checked against this reference
// in map-tint.spec.ts.

const LAND = [14, 14, 14];
const WATER = [44, 53, 60];
const ROAD = [73, 73, 73];

const lin = (u: number) => (u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4);
const relLum = ([r, g, b]: number[]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrast = (a: number[], b: number[]) => {
  const [hi, lo] = [relLum(a), relLum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const triplet = (rgb: string) => rgb.split(',').map((n) => Number(n) / 255);

test('the tone curve passes through its knots', () => {
  expect(toneLevel(0)).toBe(0);
  expect(toneLevel(0.055)).toBeCloseTo(MAP_TONE.land, 6);
  expect(toneLevel(0.13)).toBeCloseTo(MAP_TONE.lineLo, 6);
  expect(toneLevel(0.5)).toBeCloseTo(MAP_TONE.lineHi, 6);
  expect(toneLevel(1)).toBeCloseTo(MAP_TONE.lineHi, 6);
});

test('the tone table has 256 entries matching the curve', () => {
  const table = toneTable();
  expect(table).toHaveLength(256);
  expect(table[0]).toBe(0);
  expect(table[255]).toBeCloseTo(MAP_TONE.lineHi, 4);
  expect(table[64]).toBeCloseTo(toneLevel(64 / 255), 4);
});

for (const [name, theme] of Object.entries(PHOSPHOR_THEMES)) {
  test(`${name}: water sits below land, land below roads`, () => {
    const lum = (px: number[]) => relLum(filterOutput(px, theme.rgb));
    expect(lum(WATER)).toBeLessThan(lum(LAND));
    expect(lum(LAND)).toBeLessThan(lum(ROAD));
  });

  test(`${name}: markers reach 4.5:1 against land, water and roads`, () => {
    const marker = triplet(theme.brightRgb);
    for (const px of [LAND, WATER, ROAD]) {
      expect(contrast(marker, filterOutput(px, theme.rgb))).toBeGreaterThanOrEqual(4.5);
    }
  });
}

test('the water mask takes water and leaves land', () => {
  const rgb = PHOSPHOR_THEMES.green.rgb;
  // Water lands on the water level whatever its luminance; land follows the curve.
  const water = filterOutput(WATER, rgb);
  const land = filterOutput(LAND, rgb);
  const greenTint = filterOutput([255, 255, 255], rgb).map((ch) => ch / MAP_TONE.lineHi);
  expect(water[1]).toBeCloseTo(greenTint[1] * MAP_TONE.water, 3);
  expect(land[1]).toBeCloseTo(greenTint[1] * MAP_TONE.land, 2);
});
