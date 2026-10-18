import { esc } from '../engine/render.js';
import { patchStatus } from '../api/characters.js';
import {
    conditionWeight,
    health,
    isCritical,
    DEFAULT_MARGIN,
} from '../sheet/model.js';
import { openConditionPopup } from './condition-popup.js';
import { openConditionDetail } from './condition-detail.js';

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

/** Signed weight label: `−1`/`−2` (U+2212) for negatives, `+1`/`+2` for positives. */
const signedValue = (cond, neg) => `${neg ? '−' : '+'}${conditionWeight(cond)}`;

/** Major (weight 2) sorts above minor (weight 1); stable within a weight. */
const majorFirst = (list) =>
    [...(list ?? [])].sort((a, b) => conditionWeight(b) - conditionWeight(a));

// The name truncates with `…` on one line (constant row height), so the full
// name rides along in `title` / `aria-label` and in the detail card. Every row
// is a button — read-only viewers can open the card too (without RIMUOVI).
function conditionRow(cond, neg) {
    const accent = neg ? 'pb-cond-row--neg' : 'pb-cond-row--pos';
    const value = signedValue(cond, neg);
    const body = `
        <span class="pb-cond-value">${value}</span>
        <span class="pb-cond-name">${esc(cond.name)}</span>
    `;
    const label = `title="${esc(cond.name)}" aria-label="${esc(`${value} ${cond.name}`)}"`;
    const collection = neg ? 'negativeConditions' : 'positiveConditions';
    return `<button class="pb-cond-row ${accent}" ${label} data-condition-id="${esc(cond.id)}" data-collection="${collection}">${body}</button>`;
}

function conditionColumn(list, neg) {
    const rows = majorFirst(list);
    return `
        <div class="pb-cond-col ${neg ? 'pb-cond-col--neg' : 'pb-cond-col--pos'}">
            ${rows.length === 0
                ? '<div class="pb-empty-dashed">—</div>'
                : rows.map((c) => conditionRow(c, neg)).join('')}
        </div>
    `;
}

export function renderHealthTab(container, ctx) {
    const { character, canEdit, editMode, campaignId } = ctx;
    // Structural edits (the MARGINE stepper) show only when the ✎ editor mode is
    // toggled on, matching the S.P.E.C.I.A.L. / skills / talents / inventory
    // editors. The `− NEGATIVA` / `+ POSITIVA` add triggers and the detail
    // card's RIMUOVI stay on plain `canEdit` (per the change's scope).
    const inEditor = canEdit && editMode;
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
                    ${conditionColumn(neg, true)}
                    ${conditionColumn(pos, false)}
                </div>
            `}

        ${inEditor ? `
            <div class="pb-row pb-stepper-row pb-margin-row">
                <span class="pb-approach-name">MARGINE</span>
                <div class="pb-stepper" id="pb-margin-stepper">
                    <button data-dir="-1" ${margin <= 1 ? 'disabled' : ''}>−</button>
                    <span class="value">${margin}</span>
                    <button data-dir="1">+</button>
                </div>
            </div>
        ` : ''}
        ${canEdit ? `
            <div class="pb-cond-add-row">
                <button class="pb-btn pb-btn--submit pb-cond-add pb-cond-add--neg vt" id="pb-cond-add-neg" data-polarity="negative">− NEGATIVA</button>
                <button class="pb-btn pb-btn--submit pb-cond-add pb-cond-add--pos vt" id="pb-cond-add-pos" data-polarity="positive">+ POSITIVA</button>
            </div>
        ` : ''}
    `;

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

    // Every viewer can open a condition's detail card; only writers get RIMUOVI,
    // which removes directly (the card is the confirmation step).
    container.querySelectorAll('[data-condition-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const { conditionId: id, collection } = btn.dataset;
            const condition = (status[collection] ?? []).find((c) => c.id === id);
            if (!condition) return;
            openConditionDetail({
                condition,
                polarity: collection === 'positiveConditions' ? 'positive' : 'negative',
                canRemove: canEdit,
                onRemove: () => {
                    const projected = project(collection, (list) => list.filter((c) => c.id !== id));
                    return commit({ [collection]: { deletedIds: [id] } }, projected, margin);
                },
            });
        });
    });

    if (!canEdit) return;

    // The MARGINE stepper writes the new margin and re-derives criticalState
    // against it (lowering margin can cross the critical threshold).
    container.querySelectorAll('#pb-margin-stepper button').forEach((btn) => {
        btn.addEventListener('click', () => {
            const nextMargin = Math.max(1, margin + Number(btn.dataset.dir));
            if (nextMargin === margin) return;
            return commit({ margin: nextMargin }, status, nextMargin);
        });
    });

    // One add trigger per polarity: each opens the add-condition popup scoped
    // to it, which hands back the collection + condition on OK; we commit with
    // the current margin driving criticalState.
    container.querySelectorAll('.pb-cond-add[data-polarity]').forEach((btn) => {
        btn.addEventListener('click', () => {
            openConditionPopup({
                polarity: btn.dataset.polarity,
                presets,
                onAdd: ({ collection, item }) => {
                    const projected = project(collection, (list) => [...list, item]);
                    return commit({ [collection]: { items: [item] } }, projected, margin);
                },
            });
        });
    });
}
