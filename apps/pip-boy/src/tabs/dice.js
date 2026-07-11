import { esc } from '../engine/render.js';
import { patchActionPoints } from '../api/characters.js';
import { APPROACHES, SKILL_LEVEL_LABELS, clamp } from '../sheet/model.js';
import {
    MODIFIER_MIN,
    MODIFIER_MAX,
    OUTCOME,
    OUTCOME_SHORT,
    REGISTER_SIZE,
    REROLL_COST,
    TUMBLE_TICKS,
    TUMBLE_TICK_MS,
    applyPaDelta,
    poolSize,
    rollDie,
    rollPool,
    rollExpression,
    summarizeRoll,
    tumbleFace,
} from '../engine/dice.js';

const FORTUNA_NOTE = 'FORTUNA · il Rischio sale di un grado · nessun PA dai 6';
const PRE_ROLL = '— TIRA I DADI —';

function skillName(catalog, slug) {
    return catalog.find((s) => s.slug === slug)?.name ?? slug;
}

/** The roller's view state, fresh for each sheet. Held by the sheet, not here. */
export function newDiceState() {
    return {
        register: [],
        approachKey: 'agility',
        advantage: false,
        disadvantage: false,
        modifier: 0,
        faces: null,   // null until the first roll
        result: null,  // summarizeRoll(...) once settled
        rolling: false,
        selected: new Set(),
        rerollSkill: '',
    };
}

export function renderDiceTab(container, ctx) {
    const { character, canEdit, skillsCatalog = [], campaignId } = ctx;
    const special = character.special ?? {};

    // Persisting a refund re-renders this tab, so every field that must outlive
    // a redraw lives in the sheet's state object rather than in a local.
    const s = ctx.diceState ?? newDiceState();
    const register = s.register;

    if (ctx.preselectApproach) s.approachKey = ctx.preselectApproach;

    const approach = () => APPROACHES.find((a) => a.key === s.approachKey);
    const size = () => poolSize(special[s.approachKey] ?? 0, { advantage: s.advantage, modifier: s.modifier });
    const isFortuna = () => s.approachKey === 'luck';
    const ap = () => character.actionPoints ?? {};

    const canReroll = () =>
        !s.rolling && (ap().paCurrent ?? 0) > 0 && !!s.rerollSkill && s.selected.size > 0;

    function dieCell(die, index) {
        if (die.dropped) {
            return `<span class="pb-die dropped" data-die="${index}">${die.value}</span>`;
        }
        const cls = [
            'pb-die',
            `pb-die--${die.kind}`,
            s.selected.has(index) ? 'selected' : '',
        ].filter(Boolean).join(' ');
        return `<button class="${cls}" data-die="${index}" ${s.rolling ? 'disabled' : ''}>${die.value}</button>`;
    }

    function diceGrid() {
        if (!s.faces) return '';
        const dice = s.result && !s.rolling
            ? s.result.classified
            : s.faces.map((value) => ({ value, kind: 'fail', dropped: false }));
        return dice.map(dieCell).join('');
    }

    function draw() {
        const a = approach();
        const paCurrent = ap().paCurrent ?? 0;

        container.innerHTML = `
            <div class="pb-split-row">
                <div class="pb-section-head" style="margin:0;">POOL DI DADI</div>
                <span class="pb-label">${a?.name ?? ''}</span>
            </div>

            <div class="pb-approach-picker" id="pb-dice-approaches">
                ${APPROACHES.map((x) => `
                    <button class="pb-seg${x.key === s.approachKey ? ' active' : ''}" data-approach="${x.key}" title="${x.name}">
                        ${x.letter}
                    </button>
                `).join('')}
            </div>

            <div class="pb-toggle-row">
                <button class="pb-btn pb-toggle${s.advantage ? ' active' : ''}" id="pb-dice-adv">VANTAGGIO</button>
                <button class="pb-btn pb-toggle${s.disadvantage ? ' active' : ''}" id="pb-dice-dis">SVANTAGGIO</button>
            </div>

            <div class="pb-row pb-split-row">
                <span class="pb-label">CONDIZIONI / BONUS — dadi ± al pool</span>
                <div class="pb-stepper pb-stepper--tiny" id="pb-dice-mod">
                    <button data-dir="-1" ${s.modifier <= MODIFIER_MIN ? 'disabled' : ''}>−</button>
                    <span class="value">${s.modifier > 0 ? `+${s.modifier}` : s.modifier}</span>
                    <button data-dir="1" ${s.modifier >= MODIFIER_MAX ? 'disabled' : ''}>+</button>
                </div>
            </div>

            <div class="pb-pool-readout vt" id="pb-dice-pool">${size()}d6</div>

            ${isFortuna() ? `<div class="pb-legend" id="pb-dice-fortuna">${FORTUNA_NOTE}</div>` : ''}

            <div class="pb-dice-grid" id="pb-dice-grid">${diceGrid()}</div>

            <div class="pb-result-box vt" id="pb-dice-result">
                ${s.result && !s.rolling ? OUTCOME[s.result.outcome] : PRE_ROLL}
            </div>

            <button class="pb-btn pb-btn--primary pb-btn--block" id="pb-dice-roll" ${s.rolling ? 'disabled' : ''}>TIRA</button>

            ${s.faces ? `
                <div class="pb-hint" id="pb-dice-hint">Tocca i dadi da ritirare · ${s.selected.size} selezionati</div>
                <div class="pb-add-row">
                    <select class="pb-select" id="pb-dice-reroll-skill">
                        <option value="">— RILANCIA CON —</option>
                        ${(character.skills ?? []).map((sk) => `
                            <option value="${esc(sk.id)}" ${s.rerollSkill === sk.id ? 'selected' : ''}>
                                ${esc(skillName(skillsCatalog, sk.id))} · ${SKILL_LEVEL_LABELS[sk.level] ?? sk.level}
                            </option>
                        `).join('')}
                    </select>
                    <button class="pb-btn" id="pb-dice-reroll" ${canReroll() ? '' : 'disabled'}>
                        RITIRA SELEZIONATI −${REROLL_COST} PA
                    </button>
                </div>
                <div class="pb-hint">Il ritiro richiede la Tag Skill pertinente.</div>
            ` : ''}

            <div class="pb-section-head">REGISTRO</div>
            <div class="pb-register" id="pb-dice-register">
                ${register.length === 0
                    ? '<div class="pb-empty">Nessun tiro</div>'
                    : register.map((r) => `
                        <div class="pb-spend-row pb-split-row">
                            <span>${esc(r.expression)}</span>
                            <span class="pb-label">${OUTCOME_SHORT[r.outcome]}</span>
                        </div>
                    `).join('')}
            </div>

            <div class="pb-label" style="margin-top:10px;">PA ${paCurrent} / ${ap().paMax ?? 0}</div>
        `;

        bind();
    }

    function bind() {
        container.querySelectorAll('[data-approach]').forEach((btn) => {
            btn.addEventListener('click', () => {
                s.approachKey = btn.dataset.approach;
                draw();
            });
        });

        // Vantaggio and Svantaggio are mutually exclusive.
        container.querySelector('#pb-dice-adv').addEventListener('click', () => {
            s.advantage = !s.advantage;
            if (s.advantage) s.disadvantage = false;
            draw();
        });
        container.querySelector('#pb-dice-dis').addEventListener('click', () => {
            s.disadvantage = !s.disadvantage;
            if (s.disadvantage) s.advantage = false;
            draw();
        });

        container.querySelectorAll('#pb-dice-mod button').forEach((btn) => {
            btn.addEventListener('click', () => {
                s.modifier = clamp(s.modifier + Number(btn.dataset.dir), MODIFIER_MIN, MODIFIER_MAX);
                draw();
            });
        });

        container.querySelector('#pb-dice-roll').addEventListener('click', roll);

        // Dropped dice render as spans, so they carry no click handler at all.
        container.querySelectorAll('button[data-die]').forEach((btn) => {
            btn.addEventListener('click', () => {
                if (s.rolling) return;
                const i = Number(btn.dataset.die);
                if (s.selected.has(i)) s.selected.delete(i); else s.selected.add(i);
                draw();
            });
        });

        const skillSel = container.querySelector('#pb-dice-reroll-skill');
        if (skillSel) {
            skillSel.addEventListener('change', () => {
                s.rerollSkill = skillSel.value;
                draw();
            });
        }

        const rerollBtn = container.querySelector('#pb-dice-reroll');
        if (rerollBtn) rerollBtn.addEventListener('click', reroll);
    }

    /** Re-randomise the displayed faces for ~540ms; dice are not selectable. */
    function tumble(finalFaces, onSettled) {
        s.rolling = true;
        s.selected = new Set();
        let tick = 0;

        const spin = () => {
            if (tick >= TUMBLE_TICKS) {
                s.rolling = false;
                s.faces = finalFaces;
                onSettled();
                draw();
                return;
            }
            s.faces = finalFaces.map(() => tumbleFace());
            tick += 1;
            draw();
            setTimeout(spin, TUMBLE_TICK_MS);
        };
        spin();
    }

    async function persistPa(next) {
        const res = await patchActionPoints(campaignId, character.id, { paCurrent: next });
        ctx.onSectionUpdate('actionPoints', res.section ?? res);
    }

    function record(summary) {
        register.unshift({
            expression: rollExpression(approach()?.letter ?? '?', size(), s.modifier),
            outcome: summary.outcome,
        });
        register.length = Math.min(register.length, REGISTER_SIZE);
    }

    function roll() {
        if (s.rolling) return;
        const finalFaces = rollPool(size());

        tumble(finalFaces, () => {
            // FORTUNA never refunds; a die dropped by SVANTAGGIO never counts.
            s.result = summarizeRoll(finalFaces, {
                disadvantage: s.disadvantage,
                rewardOnSixes: !isFortuna(),
            });
            record(s.result);

            if (canEdit && s.result.refund > 0) {
                const next = applyPaDelta(ap().paCurrent, ap().paMax, s.result.refund);
                if (next !== ap().paCurrent) void persistPa(next);
            }
        });
    }

    async function reroll() {
        if (!canReroll()) return;

        // A reroll costs exactly 1 PA regardless of outcome, and never refunds.
        const afterCost = applyPaDelta(ap().paCurrent, ap().paMax, -REROLL_COST);
        await persistPa(afterCost);

        const rerolled = s.faces.map((v, i) => (s.selected.has(i) ? rollDie() : v));

        tumble(rerolled, () => {
            // A reroll never grants PA back — the six-refund rule is roll-only.
            s.result = summarizeRoll(rerolled, { disadvantage: s.disadvantage, rewardOnSixes: false });
            record(s.result);
        });
    }

    draw();
}
