import { patchSpecial, patchActionPoints } from '../api/characters.js';
import { APPROACHES, PA_SOURCES, SPECIAL_MIN, SPECIAL_MAX, clamp } from '../sheet/model.js';

const DICE_LEGEND =
    '6 = Successo Pieno · 4/5 = Successo con Costo · 1/2/3 = Fallimento. Ogni 6 oltre il primo restituisce 1 PA.';

/** Five slots: the reference's pip row, independent of the 0..8 stored range. */
function pips(value) {
    return `<div class="pb-pips">${Array.from({ length: 5 }, (_, i) =>
        `<span class="pb-pip${i < value ? ' filled' : ''}"></span>`).join('')}</div>`;
}

function viewMode(special) {
    return `
        <div class="pb-section-head">APPROCCI · TOCCA PER TIRARE</div>
        <div class="pb-hint">Il valore = numero di d6 nel pool</div>
        <div id="pb-approach-list">
            ${APPROACHES.map((a) => `
                <button class="pb-approach-row" data-approach="${a.key}">
                    <span class="pb-approach-letter vt">${a.letter}</span>
                    <span class="pb-approach-text">
                        <span class="pb-approach-name">${a.name}</span>
                        <span class="pb-approach-desc">${a.desc}</span>
                    </span>
                    ${pips(special[a.key] ?? 0)}
                </button>
            `).join('')}
        </div>
        <div class="pb-legend">
            <span class="pb-legend-label">ESITO DADI —</span> ${DICE_LEGEND}
        </div>
    `;
}

function editorMode(special, ap) {
    const paMax = ap.paMax ?? 0;
    return `
        <div class="pb-section-head">MODIFICA S.P.E.C.I.A.L.</div>
        <div id="pb-special-grid">
            ${APPROACHES.map((a) => {
                const value = special[a.key] ?? 0;
                return `
                    <div class="pb-row pb-stepper-row">
                        <span class="pb-approach-letter vt">${a.letter}</span>
                        <span class="pb-approach-name">${a.name}</span>
                        <div class="pb-stepper" data-key="${a.key}">
                            <button data-dir="-1" ${value <= SPECIAL_MIN ? 'disabled' : ''}>−</button>
                            <span class="value">${value}</span>
                            <button data-dir="1" ${value >= SPECIAL_MAX ? 'disabled' : ''}>+</button>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>

        <div class="pb-section-head">FONTE PA</div>
        <select class="pb-select" id="pb-pa-source">
            ${PA_SOURCES.map((s) =>
                `<option value="${s.value}" ${ap.paTrackedBy === s.value ? 'selected' : ''}>${s.label}</option>`).join('')}
        </select>

        <div class="pb-section-head">MAX PA</div>
        <div class="pb-row pb-stepper-row">
            <div class="pb-stepper" id="pb-pa-max-stepper">
                <button data-dir="-1" ${paMax <= SPECIAL_MIN ? 'disabled' : ''}>−</button>
                <span class="value">${paMax}</span>
                <button data-dir="1" ${paMax >= SPECIAL_MAX ? 'disabled' : ''}>+</button>
            </div>
        </div>
    `;
}

export function renderSpecialTab(container, ctx) {
    const { character, canEdit, editMode, campaignId } = ctx;
    const special = character.special ?? {};
    const ap = character.actionPoints ?? {};

    const inEditor = canEdit && editMode;
    container.innerHTML = inEditor ? editorMode(special, ap) : viewMode(special);

    if (!inEditor) {
        container.querySelectorAll('[data-approach]').forEach((row) => {
            row.addEventListener('click', () => ctx.goToDice(row.dataset.approach));
        });
        return;
    }

    container.querySelectorAll('#pb-special-grid .pb-stepper').forEach((stepperEl) => {
        stepperEl.querySelectorAll('button').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const key = stepperEl.dataset.key;
                const next = clamp((special[key] ?? 0) + Number(btn.dataset.dir), SPECIAL_MIN, SPECIAL_MAX);
                if (next === special[key]) return;
                const res = await patchSpecial(campaignId, character.id, { [key]: next });
                ctx.onSectionUpdate('special', res.section ?? res);
            });
        });
    });

    container.querySelector('#pb-pa-source').addEventListener('change', async (e) => {
        const res = await patchActionPoints(campaignId, character.id, { paTrackedBy: e.target.value });
        ctx.onSectionUpdate('actionPoints', res.section ?? res);
    });

    container.querySelectorAll('#pb-pa-max-stepper button').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const current = ap.paMax ?? 0;
            const next = clamp(current + Number(btn.dataset.dir), SPECIAL_MIN, SPECIAL_MAX);
            if (next === current) return;

            // Lowering paMax beneath paCurrent clamps and persists the current value too.
            const body = { paMax: next };
            if ((ap.paCurrent ?? 0) > next) body.paCurrent = next;

            const res = await patchActionPoints(campaignId, character.id, body);
            ctx.onSectionUpdate('actionPoints', res.section ?? res);
        });
    });
}
