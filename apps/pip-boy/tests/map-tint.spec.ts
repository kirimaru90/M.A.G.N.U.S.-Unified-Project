import { test, expect, type Page } from '@playwright/test';
import { PHOSPHOR_THEMES, filterOutput, tintPixels, tintTables } from '../src/shared/map-core/style.js';
import { TILE_HEADERS, TILE_LAND, TILE_PNG } from './fixtures';

// Pure unit tests for the lookup-table tint the tinted tile layer runs on each
// tile (map-shared-core, map-tinted-tiles design D3): no page, no DOM. The
// reference is `filterOutput`, the unrounded maths; the tables round the
// luminance to 8 bits, so they may differ from it by up to 2/255.

const LAND = [14, 14, 14];
const WATER = [44, 53, 60];
const MINOR_ROAD = [38, 38, 38];
const MAJOR_ROAD = [73, 73, 73];
const BLACK = [0, 0, 0];
const WHITE = [255, 255, 255];

/** A coastline pixel: land and water antialiased together, `t` of the way to water. */
const mix = (t: number) => LAND.map((c, i) => Math.round(c * (1 - t) + WATER[i] * t));

const SAMPLES: Record<string, number[]> = {
  land: LAND,
  water: WATER,
  'minor road': MINOR_ROAD,
  'major road': MAJOR_ROAD,
  black: BLACK,
  white: WHITE,
  'coast 25%': mix(0.25),
  'coast 50%': mix(0.5),
  'coast 75%': mix(0.75),
};

/** Runs `tintPixels` over one opaque pixel and returns its RGB bytes. */
function tinted(px: number[], rgb: string) {
  const data = new Uint8ClampedArray([...px, 255]);
  tintPixels(data, tintTables(rgb));
  return [...data];
}

const luma = ([r, g, b]: number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

for (const [name, theme] of Object.entries(PHOSPHOR_THEMES)) {
  test(`${name}: the tables match the reference tint within 2/255`, () => {
    for (const [label, px] of Object.entries(SAMPLES)) {
      const want = filterOutput(px, theme.rgb).map((ch) => ch * 255);
      const got = tinted(px, theme.rgb);
      for (let c = 0; c < 3; c++) {
        expect(Math.abs(got[c] - want[c]), `${label} channel ${c}`).toBeLessThanOrEqual(2);
      }
      expect(got[3], `${label} alpha`).toBe(255);
    }
  });

  test(`${name}: every grey matches the reference tint within 2/255`, () => {
    for (let v = 0; v < 256; v++) {
      const want = filterOutput([v, v, v], theme.rgb).map((ch) => ch * 255);
      const got = tinted([v, v, v], theme.rgb);
      for (let c = 0; c < 3; c++) expect(Math.abs(got[c] - want[c]), `grey ${v}`).toBeLessThanOrEqual(2);
    }
  });

  test(`${name}: water sits below land, land below roads`, () => {
    expect(luma(tinted(WATER, theme.rgb))).toBeLessThan(luma(tinted(LAND, theme.rgb)));
    expect(luma(tinted(LAND, theme.rgb))).toBeLessThan(luma(tinted(MINOR_ROAD, theme.rgb)));
    expect(luma(tinted(MINOR_ROAD, theme.rgb))).toBeLessThan(luma(tinted(MAJOR_ROAD, theme.rgb)));
  });
}

test('alpha passes through', () => {
  const data = new Uint8ClampedArray([...LAND, 128]);
  tintPixels(data, tintTables(PHOSPHOR_THEMES.green.rgb));
  expect(data[3]).toBe(128);
});

test('null tables leave the pixels untouched', () => {
  const src = [...LAND, 255, ...WATER, 255, ...WHITE, 200];
  const data = new Uint8ClampedArray(src);
  expect(tintPixels(data, null)).toBe(data);
  expect([...data]).toEqual(src);
});

// The tinted tile layer in a page of its own: Leaflet, the layer and, when
// asked, its worker, over tiles stubbed in CARTO land. No app shell.

const LAB = '/__tint-layer.html';
const LAB_HTML = `<!doctype html>
<link rel="stylesheet" href="/src/vendor/leaflet/leaflet.css">
<div id="map" style="width: 512px; height: 512px"></div>
<script type="module">
  import * as L from '/src/vendor/leaflet/leaflet.esm.js';
  import { createTintedTileLayer } from '/src/shared/map-core/tint-tiles.js';
  Object.assign(window, { L, createTintedTileLayer });
</script>`;

/** The tile stub's colour through `rgb`'s tint, or as served for null. */
function expectedPixel(rgb: string | null) {
  const data = new Uint8ClampedArray([...TILE_LAND, 255]);
  return [...tintPixels(data, rgb ? tintTables(rgb) : null)];
}

async function mountLayer(page: Page, { tint, worker }: { tint: string | null; worker: boolean }) {
  await page.route(`**${LAB}`, (route) => route.fulfill({ contentType: 'text/html', body: LAB_HTML }));
  await page.route(/basemaps\.cartocdn\.com/, (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', headers: TILE_HEADERS, body: TILE_PNG }),
  );
  await page.goto(LAB);
  await page.waitForFunction(() => 'createTintedTileLayer' in window);
  return page.evaluate(
    ({ tint, worker }) =>
      new Promise<boolean>((resolve) => {
        const w = window as any;
        const map = w.L.map('map', { zoomControl: false, attributionControl: false }).setView([41.9, 12.5], 10);
        const layer = w.createTintedTileLayer(w.L, 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png', {
          tint,
          createWorker: worker
            ? () => new Worker('/src/shared/map-core/tint-worker.js', { type: 'module' })
            : undefined,
        });
        w.__layer = layer;
        layer.once('load', () => resolve(!!layer._worker));
        layer.addTo(map);
      }),
    { tint, worker },
  );
}

/** Every tile canvas's centre pixel, with a mark left on each node to prove it survives. */
const tilePixels = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLCanvasElement>('.leaflet-tile')].map((c) => {
      const [r, g, b, a] = c.getContext('2d')!.getImageData(c.width / 2, c.height / 2, 1, 1).data;
      return { tag: c.tagName, same: (c as any).__mark === true, mark: ((c as any).__mark = true), px: [r, g, b, a] };
    }),
  );

const setTint = (page: Page, rgb: string | null) =>
  page.evaluate((rgb) => {
    (window as any).__layer.setTint(rgb);
  }, rgb);

for (const worker of [true, false]) {
  const how = worker ? 'in the worker' : 'on the main thread';

  test(`the layer draws tinted canvases ${how}`, async ({ page }) => {
    const usedWorker = await mountLayer(page, { tint: PHOSPHOR_THEMES.green.rgb, worker });
    expect(usedWorker).toBe(worker);
    const tiles = await tilePixels(page);
    expect(tiles.length).toBeGreaterThan(0);
    for (const t of tiles) {
      expect(t.tag).toBe('CANVAS');
      expect(t.px).toEqual(expectedPixel(PHOSPHOR_THEMES.green.rgb));
    }
  });

  test(`setTint repaints the same canvases ${how}`, async ({ page }) => {
    await mountLayer(page, { tint: PHOSPHOR_THEMES.green.rgb, worker });
    const before = await tilePixels(page);

    await setTint(page, PHOSPHOR_THEMES.amber.rgb);
    await expect.poll(async () => (await tilePixels(page)).map((t) => t.px)).toEqual(
      before.map(() => expectedPixel(PHOSPHOR_THEMES.amber.rgb)),
    );
    const amber = await tilePixels(page);
    expect(amber.every((t) => t.same)).toBe(true);

    await setTint(page, null);
    await expect.poll(async () => (await tilePixels(page)).map((t) => t.px)).toEqual(
      before.map(() => [...TILE_LAND, 255]),
    );
    expect((await tilePixels(page)).every((t) => t.same)).toBe(true);
  });
}

test('a worker that fails to load falls back to the main thread', async ({ page }) => {
  await page.route(`**${LAB}`, (route) => route.fulfill({ contentType: 'text/html', body: LAB_HTML }));
  await page.route(/basemaps\.cartocdn\.com/, (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', headers: TILE_HEADERS, body: TILE_PNG }),
  );
  await page.goto(LAB);
  await page.waitForFunction(() => 'createTintedTileLayer' in window);
  await page.evaluate(
    (tint) =>
      new Promise<void>((resolve) => {
        const w = window as any;
        const map = w.L.map('map', { zoomControl: false, attributionControl: false }).setView([41.9, 12.5], 10);
        const layer = w.createTintedTileLayer(w.L, 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png', {
          tint,
          createWorker: () => new Worker('/no-such-worker.js', { type: 'module' }),
        });
        layer.once('load', () => resolve());
        layer.addTo(map);
      }),
    PHOSPHOR_THEMES.white.rgb,
  );
  for (const t of await tilePixels(page)) expect(t.px).toEqual(expectedPixel(PHOSPHOR_THEMES.white.rgb));
});

// Playwright's route.fulfill skips the CORS check, so a missing header cannot be
// staged here; an unreadable tile takes the same path as a failed one.
test('a tile that fails to load stays blank and the layer carries on', async ({ page }) => {
  await page.route(`**${LAB}`, (route) => route.fulfill({ contentType: 'text/html', body: LAB_HTML }));
  await page.route(/basemaps\.cartocdn\.com/, (route) => route.abort('failed'));
  await page.goto(LAB);
  await page.waitForFunction(() => 'createTintedTileLayer' in window);
  const errors = await page.evaluate(
    (tint) =>
      new Promise<number>((resolve) => {
        const w = window as any;
        const map = w.L.map('map', { zoomControl: false, attributionControl: false }).setView([41.9, 12.5], 10);
        const layer = w.createTintedTileLayer(w.L, 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png', { tint });
        let n = 0;
        layer.on('tileerror', () => n++);
        layer.once('load', () => resolve(n));
        layer.addTo(map);
      }),
    PHOSPHOR_THEMES.green.rgb,
  );
  expect(errors).toBeGreaterThan(0);
  const sizes = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLCanvasElement>('.leaflet-tile')].map((c) => c.width),
  );
  expect(sizes.length).toBeGreaterThan(0);
  expect(sizes.every((w) => w === 300)).toBe(true); // a canvas's default width: never drawn
});
