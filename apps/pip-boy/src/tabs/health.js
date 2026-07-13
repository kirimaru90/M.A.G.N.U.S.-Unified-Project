import { esc } from '../engine/render.js';
import { patchStatus } from '../api/characters.js';
import { conditionWeight, netWear, isCritical } from '../sheet/model.js';
import { openConditionPopup } from './condition-popup.js';

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

    // A single add-path: the `+ AGGIUNGI CONDIZIONE` trigger opens the two-tab
    // add-condition popup. It owns no persistence; on OK it hands back the chosen
    // collection + condition, which we commit exactly as the inline builder did.
    // The catalog-fetch-failure fallback presets are surfaced inside the popup's
    // "Scegli esistente" tab.
    container.querySelector('#pb-cond-add').addEventListener('click', () => {
        openConditionPopup({
            presets,
            onAdd: ({ collection, item }) => {
                const projected = project(collection, (list) => [...list, item]);
                return commit(collection, { items: [item] }, projected);
            },
        });
    });
}
