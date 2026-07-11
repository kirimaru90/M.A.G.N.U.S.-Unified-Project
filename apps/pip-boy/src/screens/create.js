import { mount, esc } from '../engine/render.js';
import { APPROACHES, SKILL_LEVELS, SKILL_LEVEL_LABELS } from '../sheet/model.js';
import {
    createCharacter,
    patchSpecial,
    patchSkills,
    patchPerks,
    patchActionPoints,
    patchResources,
    patchInventory,
} from '../api/characters.js';

const STEP_LABELS = [
    'IDENTITÀ',
    'S.P.E.C.I.A.L.',
    'PUNTI AZIONE MASSIMI',
    'TAG SKILLS',
    'EQUIPAGGIAMENTO',
    'RIEPILOGO',
];

const TOTAL_POINTS = 18;
const ATTR_MIN = 1;
const ATTR_MAX = 4;

/** Maestria costs. A row left at `—` contributes no skill and no cost. */
const MAESTRIA_COST = { competent: 1, expert: 2, master: 3 };
const MAESTRIA_SHORT = { competent: 'COMP', expert: 'ESP', master: 'MAE' };

const PA_PANELS = [
    { key: 'agility', trackedBy: 'agility', label: 'AGILITÀ' },
    { key: 'endurance', trackedBy: 'endurance', label: 'RESISTENZA' },
];

const freshSpecial = () =>
    Object.fromEntries(APPROACHES.map((a) => [a.key, ATTR_MIN]));

const spent = (special) => Object.values(special).reduce((a, b) => a + b, 0);
const remaining = (special) => TOTAL_POINTS - spent(special);

const maestriaCost = (rows) =>
    rows.reduce((sum, r) => sum + (r.level ? MAESTRIA_COST[r.level] : 0), 0);

const chosenRows = (rows) => rows.filter((r) => r.slug && r.level);

function hasDuplicates(rows) {
    const slugs = chosenRows(rows).map((r) => r.slug);
    return new Set(slugs).size !== slugs.length;
}

/**
 * The six-step creation wizard. All state is held here; no character document
 * exists until step 6 is submitted, so abandoning the wizard leaves no trace.
 */
export function renderCreate(root, opts) {
    const {
        campaignId,
        speciesCatalog,
        skillsCatalog,
        starterEquipment,
        ownerUserId, // admin only; a player omits it and owns the character
        onCancel,
        onCreated,
        rollScraps = () => Math.floor(Math.random() * 6) + 1,
    } = opts;

    const weapons = starterEquipment.filter((e) => e.kind === 'weapon');
    const armors = starterEquipment.filter((e) => e.kind === 'armor');
    const consumables = starterEquipment.filter((e) => e.kind === 'consumable');

    let step = 1;
    let submitting = false;
    let error = null;

    const draft = {
        name: '',
        speciesSlug: speciesCatalog[0]?.slug ?? '',
        special: freshSpecial(),
        paTrackedBy: 'agility',
        skills: [
            { slug: '', level: null },
            { slug: '', level: null },
            { slug: '', level: null },
        ],
        weaponSlug: null,
        armorSlug: null,
        scraps: 0,
        keepsake: '',
    };

    const species = () => speciesCatalog.find((s) => s.slug === draft.speciesSlug);
    const budget = () => species()?.tagSkillBudget ?? 3;
    const paMax = () => draft.special[draft.paTrackedBy] ?? 0;

    // ── per-step validation ──────────────────────────────────────────

    function stepWarning() {
        if (step === 4) {
            if (hasDuplicates(draft.skills)) return 'ABILITÀ DUPLICATE';
            if (maestriaCost(draft.skills) > budget()) return `MAESTRIA OLTRE IL BUDGET (${budget()})`;
        }
        return null;
    }

    function stepValid() {
        if (step === 1) return draft.name.trim().length > 0;
        if (step === 2) return remaining(draft.special) === 0;
        if (step === 4) return stepWarning() === null;
        return true;
    }

    // ── steps ────────────────────────────────────────────────────────

    function stepIdentita() {
        const sp = species();
        return `
            <label class="pb-field">
                <span class="pb-label">NOME</span>
                <input class="pb-input" id="pb-cr-name" value="${esc(draft.name)}" placeholder="nome del personaggio">
            </label>
            <div class="pb-species-grid" id="pb-cr-species">
                ${speciesCatalog.map((s) => `
                    <button class="pb-btn pb-species-option${s.slug === draft.speciesSlug ? ' active' : ''}" data-species="${esc(s.slug)}">
                        ${esc(s.name)}
                    </button>
                `).join('')}
            </div>
            ${sp ? `
                <div class="pb-info-box">
                    <div class="pb-info-perm"><span class="pb-label">PERMESSO —</span> ${esc(sp.permesso)}</div>
                    <div class="pb-info-svan"><span class="pb-label">SVANTAGGIO —</span> ${esc(sp.svantaggio)}</div>
                </div>
            ` : ''}
        `;
    }

    function stepSpecial() {
        const left = remaining(draft.special);
        return `
            <div class="pb-split-row">
                <div class="pb-hint">18 punti · min 1 · max 4 per attributo</div>
                <div class="pb-remaining vt${left > 0 ? ' amber' : ' zero'}" id="pb-cr-remaining">${left} rimasti</div>
            </div>
            <div id="pb-cr-special">
                ${APPROACHES.map((a) => {
                    const v = draft.special[a.key];
                    return `
                        <div class="pb-row pb-stepper-row">
                            <span class="pb-approach-letter vt">${a.letter}</span>
                            <span class="pb-approach-name">${a.name}</span>
                            <div class="pb-stepper" data-attr="${a.key}">
                                <button data-dir="-1" ${v <= ATTR_MIN ? 'disabled' : ''}>−</button>
                                <span class="value">${v}</span>
                                <button data-dir="1" ${v >= ATTR_MAX || left <= 0 ? 'disabled' : ''}>+</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    function stepPa() {
        return `
            <div class="pb-hint">Scelta permanente: i Punti Azione derivano da Agilità o Resistenza.</div>
            <div class="pb-pa-panels" id="pb-cr-pa">
                ${PA_PANELS.map((p) => `
                    <button class="pb-btn pb-pa-panel${draft.paTrackedBy === p.trackedBy ? ' active' : ''}" data-pa="${p.trackedBy}">
                        <span class="pb-label">${p.label}</span>
                        <span class="pb-pa-panel-value vt">${draft.special[p.key]}</span>
                    </button>
                `).join('')}
            </div>
            <div class="pb-info-box">
                <div class="pb-label">PA MASSIMI</div>
                <div class="pb-net-value vt" id="pb-cr-pamax">${paMax()}</div>
            </div>
        `;
    }

    function stepSkills() {
        const cost = maestriaCost(draft.skills);
        return `
            <div class="pb-split-row">
                <div class="pb-hint">Competente 1 · Esperto 2 · Maestro 3 · budget ${budget()} (Umano +1) · «—» azzera</div>
                <div class="pb-remaining vt" id="pb-cr-maestria">MAESTRIA ${cost}/${budget()}</div>
            </div>
            <div id="pb-cr-skills">
                ${draft.skills.map((row, i) => `
                    <div class="pb-row">
                        <select class="pb-select" data-skill-slug="${i}">
                            <option value="">— abilità —</option>
                            ${skillsCatalog.map((s) =>
                                `<option value="${esc(s.slug)}" ${row.slug === s.slug ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
                        </select>
                        <div class="pb-segmented" data-skill-level="${i}">
                            <button class="pb-seg${row.level === null ? ' active' : ''}" data-level="">—</button>
                            ${SKILL_LEVELS.map((l) =>
                                `<button class="pb-seg${row.level === l ? ' active' : ''}" data-level="${l}">${MAESTRIA_SHORT[l]}</button>`).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function equipmentRow(entry, selected, kind) {
        const tags = (entry.tags ?? []).map((t) => t.name).join(' · ');
        return `
            <button class="pb-btn pb-equip-row${selected ? ' active' : ''}" data-equip="${esc(entry.slug)}" data-kind="${kind}">
                <span>${esc(entry.name)}</span>
                <span class="pb-label">${esc(tags)}</span>
            </button>
        `;
    }

    function stepEquipment() {
        return `
            <div class="pb-section-head">ARMI</div>
            <div id="pb-cr-weapons">
                ${weapons.map((w) => equipmentRow(w, draft.weaponSlug === w.slug, 'weapon')).join('')}
            </div>

            <div class="pb-section-head">ARMATURE</div>
            <div id="pb-cr-armors">
                ${armors.map((a) => equipmentRow(a, draft.armorSlug === a.slug, 'armor')).join('')}
            </div>

            <div class="pb-row pb-split-row">
                <span class="pb-label">ROTTAMI INIZIALI · 1d6</span>
                <span class="vt pb-scraps-value" id="pb-cr-scraps">${draft.scraps}</span>
                <button class="pb-btn" id="pb-cr-roll-scraps">TIRA</button>
            </div>

            <label class="pb-field">
                <span class="pb-label">OGGETTO SIGNIFICATIVO</span>
                <input class="pb-input" id="pb-cr-keepsake" value="${esc(draft.keepsake)}" placeholder="un oggetto a cui tieni">
            </label>

            <div class="pb-hint" style="margin-top:8px;">Dotazione fissa: 2 Stimpack inclusi.</div>
        `;
    }

    function stepSummary() {
        const sp = species();
        const weapon = weapons.find((w) => w.slug === draft.weaponSlug);
        const armor = armors.find((a) => a.slug === draft.armorSlug);
        const source = PA_PANELS.find((p) => p.trackedBy === draft.paTrackedBy);
        const picked = chosenRows(draft.skills);

        return `
            <h2>${esc(draft.name)}</h2>
            <div class="pb-label" id="pb-cr-meta">
                ${esc(sp?.name ?? '')} · PA ${paMax()} (${esc(source?.label ?? '')}) · TAPPI ${draft.special.luck}
            </div>

            <div class="pb-mini-special" id="pb-cr-mini">
                ${APPROACHES.map((a) => `
                    <span class="pb-mini-stat">
                        <span class="pb-mini-letter vt">${a.letter}</span>
                        <span class="pb-mini-value vt">${draft.special[a.key]}</span>
                    </span>
                `).join('')}
            </div>

            <div class="pb-section-head">ABILITÀ</div>
            <div id="pb-cr-summary-skills">
                ${picked.length === 0
                    ? '<div class="pb-empty">Nessuna abilità</div>'
                    : picked.map((r) => `
                        <div class="pb-spend-row">
                            ${esc(skillsCatalog.find((s) => s.slug === r.slug)?.name ?? r.slug)}
                            <span class="pb-label">${SKILL_LEVEL_LABELS[r.level]}</span>
                        </div>
                    `).join('')}
            </div>

            <div class="pb-section-head">EQUIPAGGIAMENTO</div>
            <ul class="pb-summary-list" id="pb-cr-summary-gear">
                ${weapon ? `<li>${esc(weapon.name)}</li>` : ''}
                ${armor ? `<li>${esc(armor.name)}</li>` : ''}
                <li>Rottami iniziali · ${draft.scraps}</li>
                ${consumables.map((c) => `<li>${esc(c.name)} ×${c.defaultQuantity ?? 1}</li>`).join('')}
                ${draft.keepsake.trim() ? `<li>${esc(draft.keepsake.trim())}</li>` : ''}
            </ul>
        `;
    }

    const STEP_BODIES = [stepIdentita, stepSpecial, stepPa, stepSkills, stepEquipment, stepSummary];

    // ── shell ────────────────────────────────────────────────────────

    function draw() {
        const valid = stepValid();
        const warning = stepWarning();

        mount(root, `
            <div class="pb-header">
                <div class="pb-header-top">
                    <h2>CREAZIONE</h2>
                    <span class="pb-label" id="pb-cr-counter">${step}/6 · ${STEP_LABELS[step - 1]}</span>
                </div>
                <div class="pb-progress" id="pb-cr-progress">
                    ${STEP_LABELS.map((_, i) =>
                        `<span class="pb-progress-seg${i < step ? ' filled' : ''}"></span>`).join('')}
                </div>
            </div>
            <div class="pb-screen-content" id="pb-cr-body">${STEP_BODIES[step - 1]()}</div>
            <div class="pb-wizard-footer">
                <button class="pb-btn" id="pb-cr-back">◄ INDIETRO</button>
                ${warning ? `<span class="pb-error" id="pb-cr-warning">${warning}</span>` : ''}
                ${error ? `<span class="pb-error" id="pb-cr-error">${esc(error)}</span>` : ''}
                ${step < 6
                    ? `<button class="pb-btn pb-btn--primary" id="pb-cr-next" ${valid ? '' : 'disabled'}>AVANTI ▸</button>`
                    : `<button class="pb-btn pb-btn--primary pb-btn--create" id="pb-cr-create" ${submitting ? 'disabled' : ''}>✓ CREA PERSONAGGIO</button>`}
            </div>
        `);

        bind();
    }

    function bind() {
        root.querySelector('#pb-cr-back').addEventListener('click', () => {
            if (step === 1) return onCancel();
            step -= 1;
            draw();
        });

        const next = root.querySelector('#pb-cr-next');
        if (next) next.addEventListener('click', () => { step += 1; draw(); });

        const create = root.querySelector('#pb-cr-create');
        if (create) create.addEventListener('click', submit);

        if (step === 1) bindIdentita();
        else if (step === 2) bindSpecial();
        else if (step === 3) bindPa();
        else if (step === 4) bindSkills();
        else if (step === 5) bindEquipment();
    }

    function bindIdentita() {
        const nameEl = root.querySelector('#pb-cr-name');
        nameEl.addEventListener('input', () => {
            draft.name = nameEl.value;
            root.querySelector('#pb-cr-next').disabled = !stepValid();
        });
        root.querySelectorAll('[data-species]').forEach((btn) => {
            btn.addEventListener('click', () => {
                draft.speciesSlug = btn.dataset.species;
                draw();
            });
        });
    }

    function bindSpecial() {
        root.querySelectorAll('[data-attr]').forEach((stepper) => {
            const key = stepper.dataset.attr;
            stepper.querySelectorAll('button').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const dir = Number(btn.dataset.dir);
                    const nextValue = draft.special[key] + dir;
                    if (nextValue < ATTR_MIN || nextValue > ATTR_MAX) return;
                    if (dir > 0 && remaining(draft.special) <= 0) return;
                    draft.special[key] = nextValue;
                    draw();
                });
            });
        });
    }

    function bindPa() {
        root.querySelectorAll('[data-pa]').forEach((btn) => {
            btn.addEventListener('click', () => {
                draft.paTrackedBy = btn.dataset.pa;
                draw();
            });
        });
    }

    function bindSkills() {
        root.querySelectorAll('[data-skill-slug]').forEach((sel) => {
            sel.addEventListener('change', () => {
                draft.skills[Number(sel.dataset.skillSlug)].slug = sel.value;
                draw();
            });
        });
        root.querySelectorAll('[data-skill-level]').forEach((group) => {
            const i = Number(group.dataset.skillLevel);
            group.querySelectorAll('button').forEach((btn) => {
                btn.addEventListener('click', () => {
                    // `—` clears the row entirely: no skill, no cost.
                    draft.skills[i].level = btn.dataset.level || null;
                    draw();
                });
            });
        });
    }

    function bindEquipment() {
        root.querySelectorAll('[data-equip]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const slug = btn.dataset.equip;
                if (btn.dataset.kind === 'weapon') {
                    draft.weaponSlug = draft.weaponSlug === slug ? null : slug;
                } else {
                    draft.armorSlug = draft.armorSlug === slug ? null : slug;
                }
                draw();
            });
        });

        root.querySelector('#pb-cr-roll-scraps').addEventListener('click', () => {
            draft.scraps = rollScraps();
            root.querySelector('#pb-cr-scraps').textContent = String(draft.scraps);
        });

        const keepsakeEl = root.querySelector('#pb-cr-keepsake');
        keepsakeEl.addEventListener('input', () => { draft.keepsake = keepsakeEl.value; });
    }

    // ── submit ───────────────────────────────────────────────────────

    /** Copy a template's name and tags; the catalog slug is never persisted. */
    function copyTemplate(entry) {
        return {
            name: entry.name,
            tags: (entry.tags ?? []).map((t) => ({ name: t.name, type: t.type, damaged: false })),
        };
    }

    async function submit() {
        if (submitting) return;
        submitting = true;
        error = null;

        let created;
        try {
            created = await createCharacter(campaignId, {
                name: draft.name.trim(),
                species: draft.speciesSlug,
                ...(ownerUserId ? { userId: ownerUserId } : {}),
            });
        } catch (_) {
            submitting = false;
            error = 'ERRORE — creazione fallita';
            draw();
            return;
        }

        // The document now exists. A later failure surfaces an error and opens
        // the partially populated sheet rather than discarding the character.
        try {
            const sp = species();
            const weapon = weapons.find((w) => w.slug === draft.weaponSlug);
            const armor = armors.find((a) => a.slug === draft.armorSlug);
            const picked = chosenRows(draft.skills);

            await patchSpecial(campaignId, created.id, { ...draft.special });

            if (picked.length > 0) {
                await patchSkills(campaignId, created.id, {
                    items: picked.map((r) => ({ id: r.slug, level: r.level })),
                });
            }

            await patchActionPoints(campaignId, created.id, {
                paMax: paMax(),
                paCurrent: paMax(),
                paTrackedBy: draft.paTrackedBy,
            });

            await patchResources(campaignId, created.id, {
                scraps: draft.scraps,
                caps: draft.special.luck,
            });

            const inventory = {};
            if (weapon) inventory.weapons = { items: [copyTemplate(weapon)] };
            if (armor) inventory.equip = { items: [copyTemplate(armor)] };
            if (consumables.length > 0) {
                inventory.consumables = {
                    items: consumables.map((c) => ({
                        name: c.name,
                        quantity: c.defaultQuantity ?? 1,
                        ...(c.description ? { description: c.description } : {}),
                    })),
                };
            }
            if (draft.keepsake.trim()) {
                inventory.other = { items: [{ name: draft.keepsake.trim(), quantity: 1 }] };
            }
            if (Object.keys(inventory).length > 0) {
                await patchInventory(campaignId, created.id, inventory);
            }

            if (sp) {
                await patchPerks(campaignId, created.id, {
                    items: [
                        { name: `SPECIE · ${sp.name}`, description: sp.permesso },
                        { name: 'SVANTAGGIO', description: sp.svantaggio },
                    ],
                });
            }
        } catch (_) {
            submitting = false;
            onCreated(created.id, 'ERRORE — personaggio creato, dati incompleti');
            return;
        }

        submitting = false;
        onCreated(created.id, null);
    }

    draw();
}
