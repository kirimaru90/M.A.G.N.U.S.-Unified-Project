import { esc } from '../engine/render.js';
import { patchStatus } from '../api/characters.js';
import {
    conditionWeight,
    health,
    isCritical,
    DEFAULT_MARGIN,
} from '../sheet/model.js';
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

/** Major (weight 2) sorts above minor (weight 1); stable within a weight. */
const majorFirst = (list) =>
    [...(list ?? [])].sort((a, b) => conditionWeight(b) - conditionWeight(a));

function conditionRow(cond, neg, canEdit) {
    const accent = neg ? 'pb-cond-row--neg' : 'pb-cond-row--pos';
    const body = `
        <span class="pb-cond-sign">${neg ? '−' : '+'}</span>
        <span class="pb-cond-name">${esc(cond.name)}</span>
        <span class="pb-cond-tag">${weightTag(cond)}</span>
        ${canEdit ? '<span class="pb-cond-remove">✕</span>' : ''}
    `;
    const collection = neg ? 'negativeConditions' : 'positiveConditions';
    return canEdit
        ? `<button class="pb-cond-row ${accent}" data-remove-condition="${esc(cond.id)}" data-collection="${collection}">${body}</button>`
        : `<div class="pb-cond-row ${accent}">${body}</div>`;
}

function conditionColumn(list, neg, canEdit) {
    const rows = majorFirst(list);
    return `
        <div class="pb-cond-col ${neg ? 'pb-cond-col--neg' : 'pb-cond-col--pos'}">
            ${rows.length === 0
                ? '<div class="pb-empty-dashed">—</div>'
                : rows.map((c) => conditionRow(c, neg, canEdit)).join('')}
        </div>
    `;
}

export function renderHealthTab(container, ctx) {
    const { character, canEdit, campaignId } = ctx;
    const status = character.status ?? { positiveConditions: [], negativeConditions: [] };

    const margin = status.margin ?? DEFAULT_MARGIN;
    const hp = health(status, margin);
    const pos = status.positiveConditions ?? [];
    const neg = status.negativeConditions ?? [];
    // Presets: an empty catalog means the fetch failed; never render an empty row.
    const presets = ctx.conditionsCatalog?.length ? ctx.conditionsCatalog : FALLBACK_PRESETS;

    // Bar fill is clamped 0..100%; the numeric readout carries the true value
    // (which may exceed margin on overshoot, or fall below 0).
    const fillPct = Math.max(0, Math.min(1, margin > 0 ? hp / margin : 0)) * 100;
    const bothEmpty = pos.length === 0 && neg.length === 0;

    container.innerHTML = `
        <div class="pb-health-box">
            <div class="pb-label">SALUTE</div>
            <div class="pb-health-readout vt${hp <= 0 ? ' neg' : ''}" id="pb-health-value">${hp}/${margin}</div>
            <div class="pb-health-bar">
                <div class="pb-health-bar-fill${hp <= 0 ? ' empty' : ''}" style="width:${fillPct}%"></div>
            </div>
        </div>

        ${bothEmpty
            ? '<div class="pb-empty-dashed">nessuna condizione attiva</div>'
            : `
                <div class="pb-cond-columns" id="pb-cond-list">
                    ${conditionColumn(neg, true, canEdit)}
                    ${conditionColumn(pos, false, canEdit)}
                </div>
            `}

        ${canEdit ? `
            <div class="pb-row pb-stepper-row pb-margin-row">
                <span class="pb-approach-name">MARGINE</span>
                <div class="pb-stepper" id="pb-margin-stepper">
                    <button data-dir="-1" ${margin <= 1 ? 'disabled' : ''}>−</button>
                    <span class="value">${margin}</span>
                    <button data-dir="1">+</button>
                </div>
            </div>
            <button class="pb-btn pb-btn--block pb-btn--submit vt" id="pb-cond-add">+ AGGIUNGI CONDIZIONE</button>
        ` : ''}
    `;

    if (!canEdit) return;

    /**
     * Persist a status change together with the client-derived `criticalState`
     * (health ≤ 0), computed from the projected status and the margin that will
     * be in effect, so both land in a single PATCH.
     */
    async function commit(body, projected, marginForCrit) {
        const res = await patchStatus(campaignId, character.id, {
            ...body,
            criticalState: isCritical(projected, marginForCrit),
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
            return commit({ [collection]: { deletedIds: [id] } }, projected, margin);
        });
    });

    // The MARGINE stepper writes the new margin and re-derives criticalState
    // against it (lowering margin can cross the critical threshold).
    container.querySelectorAll('#pb-margin-stepper button').forEach((btn) => {
        btn.addEventListener('click', () => {
            const nextMargin = Math.max(1, margin + Number(btn.dataset.dir));
            if (nextMargin === margin) return;
            return commit({ margin: nextMargin }, status, nextMargin);
        });
    });

    // A single add-path: the `+ AGGIUNGI CONDIZIONE` trigger opens the two-tab
    // add-condition popup. On OK it hands back the chosen collection + condition,
    // which we commit with the current margin driving criticalState.
    container.querySelector('#pb-cond-add').addEventListener('click', () => {
        openConditionPopup({
            presets,
            onAdd: ({ collection, item }) => {
                const projected = project(collection, (list) => [...list, item]);
                return commit({ [collection]: { items: [item] } }, projected, margin);
            },
        });
    });
}
