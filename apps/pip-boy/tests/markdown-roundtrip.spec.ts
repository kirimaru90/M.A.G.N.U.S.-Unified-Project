import { test, expect } from '@playwright/test';

// Unit coverage for src/sheet/markdown.js, exercised in a real browser DOM (the
// engine builds and walks DOM nodes). The module is imported directly over the
// static server; no API stub is needed. This spec deliberately does NOT call
// stubEnvironment, so the marked CDN is reachable when the suite runs online.

// Canonical subset samples — each MUST survive `domToMd(mdToDom(x)) === x`.
const SAMPLES = [
  'hello world',
  '**bold**',
  '*italic*',
  'a **b** c',
  'lead *em* and **strong** tail',
  '## Titolo',
  '> una citazione',
  '- uno\n- due\n- tre',
  '## Titolo\n\nUn paragrafo con **grassetto**.\n\n- primo\n- secondo\n\n> chiusura',
  'riga uno\n\nriga due',
];

test('domToMd(mdToDom(x)) === x over the supported subset', async ({ page }) => {
  await page.goto('/index.html');
  const results = await page.evaluate(async (samples) => {
    const { mdToDom, domToMd } = await import('/src/sheet/markdown.js');
    return samples.map((x) => {
      const container = document.createElement('div');
      container.appendChild(mdToDom(x));
      const once = domToMd(container);
      // Re-serialize a second pass to prove the form is a fixed point.
      const container2 = document.createElement('div');
      container2.appendChild(mdToDom(once));
      const twice = domToMd(container2);
      return { x, once, twice };
    });
  }, SAMPLES);

  for (const r of results) {
    expect(r.once, `round-trip of: ${JSON.stringify(r.x)}`).toBe(r.x);
    expect(r.twice, `idempotence of: ${JSON.stringify(r.x)}`).toBe(r.x);
  }
});

test('mdToDom builds the intended block/inline structure', async ({ page }) => {
  await page.goto('/index.html');
  const tags = await page.evaluate(async () => {
    const { mdToDom } = await import('/src/sheet/markdown.js');
    const container = document.createElement('div');
    container.appendChild(mdToDom('## Head\n\npara **b** and *i*\n\n- a\n- b\n\n> q'));
    return {
      h2: container.querySelectorAll('h2').length,
      strong: container.querySelectorAll('strong').length,
      em: container.querySelectorAll('em').length,
      li: container.querySelectorAll('ul > li').length,
      blockquote: container.querySelectorAll('blockquote').length,
      // no raw markdown markers leak into the rendered text
      hasMarkers: /[*#>]|(^|\n)- /.test(container.textContent || ''),
    };
  });
  expect(tags.h2).toBe(1);
  expect(tags.strong).toBe(1);
  expect(tags.em).toBe(1);
  expect(tags.li).toBe(2);
  expect(tags.blockquote).toBe(1);
  expect(tags.hasMarkers).toBe(false);
});

test('sanitizePaste reduces rich HTML to the supported subset', async ({ page }) => {
  await page.goto('/index.html');
  const md = await page.evaluate(async () => {
    const { sanitizePaste, domToMd } = await import('/src/sheet/markdown.js');
    const html =
      '<h3>Titolo</h3><p>testo <b>forte</b> con <span style="color:red">span</span> e <a href="#">link</a></p><ul><li>uno</li><li>due</li></ul>';
    const dt = {
      getData: (type: string) => (type === 'text/html' ? html : ''),
    } as unknown as DataTransfer;
    const container = document.createElement('div');
    container.appendChild(sanitizePaste(dt));
    return domToMd(container);
  });
  // Unknown nodes (span, a) collapse to their text; h3 → h2; list preserved.
  expect(md).toContain('## Titolo');
  expect(md).toContain('**forte**');
  expect(md).toContain('span');
  expect(md).toContain('link');
  expect(md).toContain('- uno');
  expect(md).toContain('- due');
});

test('emitted markdown parses in marked to the intended structure', async ({ page }) => {
  await page.goto('/index.html');
  // Load marked from the CDN (the same renderer the terminal app uses). If the
  // suite is offline the CDN is unreachable — skip rather than fail, since the
  // round-trip specs above already pin the emitted structure.
  let loaded = true;
  try {
    await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/marked/marked.min.js' });
  } catch {
    loaded = false;
  }
  test.skip(!loaded, 'marked CDN unreachable (offline run)');

  const html = await page.evaluate(async () => {
    const { mdToDom, domToMd } = await import('/src/sheet/markdown.js');
    const container = document.createElement('div');
    container.appendChild(mdToDom('## Head\n\npara **b** and *i*\n\n- a\n- b\n\n> q'));
    const md = domToMd(container);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).marked.parse(md);
  });
  expect(html).toMatch(/<h2[^>]*>Head<\/h2>/);
  expect(html).toContain('<strong>b</strong>');
  expect(html).toContain('<em>i</em>');
  expect(html).toMatch(/<ul>[\s\S]*<li>a<\/li>[\s\S]*<li>b<\/li>[\s\S]*<\/ul>/);
  expect(html).toContain('<blockquote>');
});
