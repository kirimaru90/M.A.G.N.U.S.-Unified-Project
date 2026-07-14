// A tiny, hand-rolled markdown engine for the constrained subset the note
// editor's toolbar exposes: bold (`**`), italic (`*`), heading (`## `), bullet
// list (`- `), quote (`> `) and plain paragraphs. It exists so the Pip-Boy can
// round-trip between a `contenteditable` DOM and *standard* markdown (the same
// bytes the terminal app renders through `marked`) without bundling a markdown
// library. The pair canonicalises so `domToMd(mdToDom(x)) === x` over the
// subset — see the markdown unit spec.
//
// Canonical emitted form (what `domToMd` produces and `mdToDom` consumes):
//   - one blank line between every top-level block;
//   - a paragraph / heading / quote is a single line;
//   - a bullet list is consecutive `- ` lines with no blank line between them.

// Block-level tags we emit and recognise. `DIV` is included because
// contenteditable frequently wraps lines in `<div>` — it is treated as a paragraph.
const BLOCK_TAGS = new Set(['P', 'DIV', 'H2', 'UL', 'BLOCKQUOTE']);

// --- markdown → DOM --------------------------------------------------------

/** Parse the supported markdown subset into a DocumentFragment of block nodes. */
export function mdToDom(md) {
    const frag = document.createDocumentFragment();
    const lines = String(md ?? '').replace(/\r\n?/g, '\n').split('\n');
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (line.trim() === '') { i += 1; continue; }

        // A run of `- ` lines is one <ul>.
        if (line.startsWith('- ')) {
            const ul = document.createElement('ul');
            while (i < lines.length && lines[i].startsWith('- ')) {
                const li = document.createElement('li');
                li.appendChild(parseInline(lines[i].slice(2)));
                ul.appendChild(li);
                i += 1;
            }
            frag.appendChild(ul);
            continue;
        }

        let el;
        if (line.startsWith('## ')) {
            el = document.createElement('h2');
            el.appendChild(parseInline(line.slice(3)));
        } else if (line.startsWith('> ')) {
            el = document.createElement('blockquote');
            el.appendChild(parseInline(line.slice(2)));
        } else {
            el = document.createElement('p');
            el.appendChild(parseInline(line));
        }
        frag.appendChild(el);
        i += 1;
    }
    return frag;
}

/** Index of a lone `*` at/after `from` that is not part of a `**` marker. */
function findEmphasisStar(text, from) {
    for (let k = from; k < text.length; k += 1) {
        if (text[k] === '*') {
            if (text[k + 1] === '*') { k += 1; continue; }
            return k;
        }
    }
    return -1;
}

function unescapeInline(text) {
    return text.replace(/\\([\\*])/g, '$1');
}

/** Parse inline markdown (bold/italic over plain text) into a DocumentFragment. */
function parseInline(text) {
    const frag = document.createDocumentFragment();
    let idx = 0;
    while (idx < text.length) {
        const bold = text.indexOf('**', idx);
        const italic = findEmphasisStar(text, idx);

        let next = -1;
        let kind = null;
        if (bold !== -1) { next = bold; kind = 'bold'; }
        if (italic !== -1 && (next === -1 || italic < next)) { next = italic; kind = 'italic'; }

        if (next === -1) {
            frag.appendChild(document.createTextNode(unescapeInline(text.slice(idx))));
            break;
        }
        if (next > idx) {
            frag.appendChild(document.createTextNode(unescapeInline(text.slice(idx, next))));
        }

        if (kind === 'bold') {
            const close = text.indexOf('**', next + 2);
            if (close === -1) {
                frag.appendChild(document.createTextNode(unescapeInline(text.slice(next))));
                break;
            }
            const strong = document.createElement('strong');
            strong.appendChild(parseInline(text.slice(next + 2, close)));
            frag.appendChild(strong);
            idx = close + 2;
        } else {
            const close = findEmphasisStar(text, next + 1);
            if (close === -1) {
                frag.appendChild(document.createTextNode(unescapeInline(text.slice(next))));
                break;
            }
            const em = document.createElement('em');
            em.appendChild(parseInline(text.slice(next + 1, close)));
            frag.appendChild(em);
            idx = close + 1;
        }
    }
    return frag;
}

// --- DOM → markdown --------------------------------------------------------

/** Serialize an editable DOM root (element or fragment) to canonical markdown. */
export function domToMd(root) {
    const blocks = [];
    let pending = [];

    const flushParagraph = () => {
        if (!pending.length) return;
        const md = pending.map(inlineToMd).join('').trim();
        pending = [];
        if (md) blocks.push(md);
    };

    root.childNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has(node.tagName)) {
            flushParagraph();
            const md = serializeBlock(node);
            if (md) blocks.push(md);
        } else {
            pending.push(node);
        }
    });
    flushParagraph();

    return blocks.join('\n\n');
}

function serializeBlock(el) {
    switch (el.tagName) {
        case 'H2':
            return `## ${childInlineMd(el)}`.trimEnd();
        case 'BLOCKQUOTE':
            return `> ${childInlineMd(el)}`.trimEnd();
        case 'UL': {
            const items = Array.from(el.querySelectorAll(':scope > li'))
                .map((li) => `- ${childInlineMd(li)}`.trimEnd());
            return items.join('\n');
        }
        default: // P, DIV
            return childInlineMd(el).trim();
    }
}

function childInlineMd(el) {
    return Array.from(el.childNodes).map(inlineToMd).join('');
}

function escapeText(text) {
    return text.replace(/[\\*]/g, '\\$&');
}

function inlineToMd(node) {
    if (node.nodeType === Node.TEXT_NODE) return escapeText(node.textContent);
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    switch (node.tagName) {
        case 'STRONG':
        case 'B':
            return `**${childInlineMd(node)}**`;
        case 'EM':
        case 'I':
            return `*${childInlineMd(node)}*`;
        case 'BR':
            return ' ';
        default:
            // Unknown inline wrapper (e.g. a styling span) — keep its text only.
            return childInlineMd(node);
    }
}

// --- paste sanitising ------------------------------------------------------

const INLINE_MAP = { STRONG: 'strong', B: 'strong', EM: 'em', I: 'em' };
const BLOCK_MAP = {
    H1: 'h2', H2: 'h2', H3: 'h2', H4: 'h2', H5: 'h2', H6: 'h2',
    P: 'p', DIV: 'p', BLOCKQUOTE: 'blockquote', UL: 'ul', OL: 'ul',
};

/**
 * Reduce a paste's rich HTML (or plain text) to the supported subset and return
 * a DocumentFragment ready to insert into the editor. Unknown nodes collapse to
 * their text content, so the body can never hold a construct `domToMd` cannot
 * emit. Reuses `domToMd`/`mdToDom` to land on the canonical form.
 */
export function sanitizePaste(dataTransfer) {
    const html = dataTransfer?.getData ? dataTransfer.getData('text/html') : '';
    if (html && html.trim()) {
        const template = document.createElement('template');
        template.innerHTML = html;
        const normalized = document.createElement('div');
        normalizeNodes(template.content.childNodes, normalized);
        return mdToDom(domToMd(normalized));
    }
    const text = dataTransfer?.getData ? dataTransfer.getData('text/plain') : String(dataTransfer ?? '');
    return mdToDom(plainToMd(text));
}

/** Plain-text paste: blank-line-separated blocks become paragraphs. */
function plainToMd(text) {
    return String(text ?? '')
        .replace(/\r\n?/g, '\n')
        .split(/\n{2,}/)
        .map((block) => block.split('\n').map((l) => l.trim()).filter(Boolean).join(' '))
        .filter(Boolean)
        .join('\n\n');
}

/** Rebuild `nodes` under `out` keeping only mapped block/inline tags. */
function normalizeNodes(nodes, out) {
    Array.from(nodes).forEach((node) => normalizeNode(node, out));
}

function normalizeNode(node, out) {
    if (node.nodeType === Node.TEXT_NODE) {
        out.appendChild(document.createTextNode(node.textContent));
        return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const tag = node.tagName;
    if (tag === 'BR') { out.appendChild(document.createElement('br')); return; }

    const inline = INLINE_MAP[tag];
    if (inline) {
        const el = document.createElement(inline);
        normalizeNodes(node.childNodes, el);
        out.appendChild(el);
        return;
    }

    const block = BLOCK_MAP[tag];
    if (block === 'ul') {
        const ul = document.createElement('ul');
        node.querySelectorAll(':scope > li').forEach((li) => {
            const item = document.createElement('li');
            normalizeNodes(li.childNodes, item);
            ul.appendChild(item);
        });
        out.appendChild(ul);
        return;
    }
    if (block) {
        const el = document.createElement(block);
        normalizeNodes(node.childNodes, el);
        out.appendChild(el);
        return;
    }

    // Unknown element (span, a, table, …) — unwrap to its children.
    normalizeNodes(node.childNodes, out);
}
