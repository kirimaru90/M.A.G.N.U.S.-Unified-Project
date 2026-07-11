import { esc } from '../engine/render.js';
import { patchStatus } from '../api/characters.js';
import { conditionWeight, netWear, isCritical } from '../sheet/model.js';

/**
 * Used only when `GET /conditions-catalog` fails, so the quick-condition row
 * never renders empty. Mirrors the reference's `conditions.json`.
 */
export const FALLBACK_PRESETS = [
    { slug: 'ferito', name: 'FERITO', polarity: 'negative', defaultSeverity: 'minor', description: 'Strength e Agility' },
    { slug: 'stremato', name: 'STREMATO', polarity: 'negative', defaultSeverity: 'minor', description: 'Endurance e azioni prolungate' },
    { slug: 'irradiato', name: 'IRRADIATO', polarity: 'negative', defaultSeverity: 'minor', description: 'Endurance e azioni fisiche pesanti' },
    { slug: 'scosso', name: 'SCOSSO', polarity: 'negative', defaultSeverity: 'minor', description: 'Charisma, Intelligence, Perception' },
    { slug: 'in-down', name: 'IN DOWN', polarity: 'negative', defaultSeverity: 'minor', description: '-1 a TUTTI i tiri' },
    { slug: 'cieco', name: 'CIECO', polarity: 'negative', defaultSeverity: 'minor', description: 'tiri che richiedono la vista' },
    { slug: 'sordo', name: 'SORDO', polarity: 'negative', defaultSeverity: 'minor', description: "tiri che richiedono l'udito" },
];

const weightTag = (cond) => (conditionWeight(cond) === 2 ? 'MODERATA ×2' : 'BASE');
const collectionOf = (polarity) => (polarity === 'positive' ? 'positiveConditions' : 'negativeConditions');

/** Negatives sort above positives; within a collection, insertion order stands. */
function orderedConditions(status) {
    return [
        ...(status.negativeConditions ?? []).map((c) => ({ cond: c, collection: 'negativeConditions', neg: true })),
        ...(status.positiveConditions ?? []).map((c) => ({ cond: c, collection: 'positiveConditions', neg: false })),
    ];
}

function conditionRow({ cond, collection, neg }, canEdit) {
    const tag = `<span class="pb-cond-tag">${weightTag(cond)}</span>`;
    const body = `
        <span class="pb-cond-sign">${neg ? '−' : '+'}</span>
        <span class="pb-cond-name">${esc(cond.name)}</span>
        ${tag}
        ${canEdit ? '<span class="pb-cond-remove">✕</span>' : ''}
    `;
    return canEdit
        ? `<button class="pb-cond-row${neg ? '' : ' positive'}" data-remove-condition="${esc(cond.id)}" data-collection="${collection}">${body}</button>`
        : `<div class="pb-cond-row${neg ? '' : ' positive'}">${body}</div>`;
}

export function renderHealthTab(container, ctx) {
    const { character, conditionsCatalog, canEdit, campaignId } = ctx;
    const status = character.status ?? { positiveConditions: [], negativeConditions: [] };

    const net = netWear(status);
    const rows = orderedConditions(status);
    // An empty catalog means the fetch failed; never render an empty preset row.
    const presets = conditionsCatalog?.length ? conditionsCatalog : FALLBACK_PRESETS;

    container.innerHTML = `
        <div class="pb-net-box">
            <div class="pb-label">VALORE NETTO</div>
            <div class="pb-net-value vt${net > 0 ? ' amber' : ''}" id="pb-net-value">${net}</div>
        </div>

        <div id="pb-cond-list">
            ${rows.length === 0
                ? '<div class="pb-empty-dashed">nessuna condizione attiva</div>'
                : rows.map((r) => conditionRow(r, canEdit)).join('')}
        </div>

        ${canEdit ? `
            <div class="pb-section-head">CONDIZIONI RAPIDE</div>
            <div class="pb-preset-row" id="pb-cond-presets">
                ${presets.map((p) => `
                    <button class="pb-btn pb-preset" data-preset="${esc(p.slug)}">
                        ${p.polarity === 'positive' ? '+' : '−'} ${esc(p.name)}${p.defaultSeverity === 'major' ? ' ×2' : ''}
                    </button>
                `).join('')}
            </div>

            <div class="pb-section-head">CONDIZIONE PERSONALIZZATA</div>
            <input class="pb-input" id="pb-cond-name" placeholder="nome condizione">
            <div class="pb-toggle-row">
                <button class="pb-btn pb-toggle active" data-sign="negative">NEGATIVA</button>
                <button class="pb-btn pb-toggle" data-sign="positive">POSITIVA</button>
            </div>
            <div class="pb-toggle-row">
                <button class="pb-btn pb-toggle active" data-weight="minor">BASE ×1</button>
                <button class="pb-btn pb-toggle" data-weight="major">MODERATA ×2</button>
            </div>
            <button class="pb-btn pb-btn--block pb-btn--submit vt" id="pb-cond-add">+ AGGIUNGI CONDIZIONE</button>
        ` : ''}
    `;

    if (!canEdit) return;

    /**
     * Persist a condition change together with the client-derived
     * `criticalState` (net wear >= CRIT), computed from the projected status so
     * both land in a single PATCH.
     */
    async function commit(collection, body, projected) {
        const res = await patchStatus(campaignId, character.id, {
            [collection]: body,
            criticalState: isCritical(projected),
        });
        ctx.onSectionUpdate('status', res.section ?? res);
    }

    function project(collection, mutate) {
        const next = {
            positiveConditions: [...(status.positiveConditions ?? [])],
            negativeConditions: [...(status.negativeConditions ?? [])],
        };
        next[collection] = mutate(next[collection]);
        return next;
    }

    container.querySelectorAll('[data-remove-condition]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.removeCondition;
            const collection = btn.dataset.collection;
            const projected = project(collection, (list) => list.filter((c) => c.id !== id));
            return commit(collection, { deletedIds: [id] }, projected);
        });
    });

    container.querySelectorAll('[data-preset]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const entry = presets.find((p) => p.slug === btn.dataset.preset);
            if (!entry) return;
            // A preset's polarity decides its collection; the routing is client-side.
            const collection = collectionOf(entry.polarity);
            const item = { name: entry.name, severity: entry.defaultSeverity, description: entry.description };
            const projected = project(collection, (list) => [...list, item]);
            return commit(collection, { items: [item] }, projected);
        });
    });

    const pickOne = (attr) => (btn) => {
        container.querySelectorAll(`[data-${attr}]`).forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
    };
    container.querySelectorAll('[data-sign]').forEach((btn) =>
        btn.addEventListener('click', () => pickOne('sign')(btn)));
    container.querySelectorAll('[data-weight]').forEach((btn) =>
        btn.addEventListener('click', () => pickOne('weight')(btn)));

    container.querySelector('#pb-cond-add').addEventListener('click', () => {
        const name = container.querySelector('#pb-cond-name').value.trim();
        if (!name) return;
        const polarity = container.querySelector('[data-sign].active').dataset.sign;
        const severity = container.querySelector('[data-weight].active').dataset.weight;
        const collection = collectionOf(polarity);
        const item = { name, severity };
        const projected = project(collection, (list) => [...list, item]);
        return commit(collection, { items: [item] }, projected);
    });
}
