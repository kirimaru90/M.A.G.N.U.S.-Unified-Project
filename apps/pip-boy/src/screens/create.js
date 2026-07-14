import { mount, esc } from '../engine/render.js';
import { APPROACHES, SKILL_LEVELS, SKILL_LEVEL_LABELS, paSourceLabel, clamp } from '../sheet/model.js';
import { pips } from '../sheet/pips.js';
import { openAddPopup } from '../tabs/add-popup.js';
import {
    createCharacter,
    patchSpecial,
    patchSkills,
    patchPerks,
    patchActionPoints,
    patchResources,
    patchInventory,
    patchStatus,
} from '../api/characters.js';

const STEP_LABELS = [
    'IDENTITÀ',
    'S.P.E.C.I.A.L.',
    'TAG SKILLS',
    'EQUIPAGGIAMENTO',
    'RIEPILOGO',
];

const TOTAL_STEPS = STEP_LABELS.length;

const TOTAL_POINTS = 18;
const ATTR_MIN = 1;
const ATTR_MAX = 4;

/** Maestria costs on the advisory budget: COMPETENTE 1, ESPERTO 2, MAESTRO 3. */
const MAESTRIA_COST = { competent: 1, expert: 2, master: 3 };

// Maestria maps to a filled count on a three-slot square row, identical by
// construction to the sheet's skills squares (COMPETENTE=1, ESPERTO=2, MAESTRO=3).
const SKILL_SLOTS = 3;
const maestriaSquares = (level) => pips(SKILL_LEVELS.indexOf(level) + 1, SKILL_SLOTS);

const freshSpecial = () =>
    Object.fromEntries(APPROACHES.map((a) => [a.key, ATTR_MIN]));

const spent = (special) => Object.values(special).reduce((a, b) => a + b, 0);
const remaining = (special) => TOTAL_POINTS - spent(special);

const maestriaCost = (rows) =>
    rows.reduce((sum, r) => sum + (r.level ? MAESTRIA_COST[r.level] : 0), 0);

// A custom (catalog-less) skill still needs an identity the PATCH .../skills
// contract accepts; we derive a client-side slug from the typed name, mirroring
// the sheet's skills add-flow.
function slugify(name) {
    return name
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'skill';
}

/**
 * The five-step creation wizard. All state is held here; no character document
 * exists until step 5 is submitted, so abandoning the wizard leaves no trace.
 * `paMax`/`paTrackedBy` are derived from the S.P.E.C.I.A.L. values at submit.
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
        // A growable list of added tag skills, shaped like the sheet's model.
        skills: [],
        weaponSlug: null,
        armorSlug: null,
        scraps: 0, // starting scraps are always 0; no wizard control mutates this
        keepsake: '',
    };

    const species = () => speciesCatalog.find((s) => s.slug === draft.speciesSlug);
    const budget = () => species()?.tagSkillBudget ?? 3;
    const skillName = (id) => skillsCatalog.find((s) => s.slug === id)?.name ?? id;

    // PA is derived, not chosen: the tracked attribute is the higher of Agilità
    // and Resistenza (a tie resolving to Agilità), and paMax is its value.
    const paTrackedBy = () =>
        draft.special.agility >= draft.special.endurance ? 'agility' : 'endurance';
    const paMax = () => draft.special[paTrackedBy()];

    // ── per-step validation ──────────────────────────────────────────

    function stepValid() {
        if (step === 1) return draft.name.trim().length > 0;
        if (step === 2) return remaining(draft.special) === 0;
        // Step 3 (Tag Skills) is always valid: the maestria budget is advisory.
        return true;
    }

    // ── steps ────────────────────────────────────────────────────────

    function stepIdentita() {
        const sp = species();
        return `
            <div class="pb-step-intro">Assegna un nome al sopravvissuto e scegli la specie.</div>
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
                <div class="pb-step-intro">18 punti · min 1 · max 4 per attributo</div>
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

    function skillRow(s) {
        const idx = SKILL_LEVELS.indexOf(s.level);
        return `
            <div class="pb-row pb-split-row pb-skill-row" data-skill-row="${esc(s.id)}">
                <span class="pb-skill-name">${esc(skillName(s.id))}</span>
                <span class="pb-label pb-skill-level">${SKILL_LEVEL_LABELS[s.level] ?? ''}</span>
                <div class="pb-stepper pb-stepper--tiny pb-skill-stepper">
                    <button data-skill-dec="${esc(s.id)}" ${idx <= 0 ? 'disabled' : ''}>−</button>
                    ${maestriaSquares(s.level)}
                    <button data-skill-inc="${esc(s.id)}" ${idx >= SKILL_LEVELS.length - 1 ? 'disabled' : ''}>+</button>
                </div>
                <button class="pb-btn pb-btn--icon" data-remove-skill="${esc(s.id)}">✕</button>
            </div>
        `;
    }

    function stepSkills() {
        const cost = maestriaCost(draft.skills);
        return `
            <div class="pb-split-row">
                <div class="pb-step-intro">Aggiungi le abilità del personaggio · budget ${budget()}</div>
                <div class="pb-remaining vt" id="pb-cr-maestria">MAESTRIA ${cost}/${budget()}</div>
            </div>
            <div class="pb-section-head pb-inv-head">
                <span>TAG SKILLS · MAESTRIA</span>
                <button class="pb-btn pb-btn--icon pb-inv-add" data-add-skill aria-label="Aggiungi abilità">+</button>
            </div>
            <div id="pb-cr-skills">
                ${draft.skills.map((s) => skillRow(s)).join('')}
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
            <div class="pb-step-intro">Scegli un'arma e un'armatura di partenza; annota un oggetto significativo.</div>
            <div class="pb-section-head">ARMI</div>
            <div id="pb-cr-weapons">
                ${weapons.map((w) => equipmentRow(w, draft.weaponSlug === w.slug, 'weapon')).join('')}
            </div>

            <div class="pb-section-head">ARMATURE</div>
            <div id="pb-cr-armors">
                ${armors.map((a) => equipmentRow(a, draft.armorSlug === a.slug, 'armor')).join('')}
            </div>

            <label class="pb-field">
                <span class="pb-label">OGGETTO SIGNIFICATIVO</span>
                <input class="pb-input" id="pb-cr-keepsake" value="${esc(draft.keepsake)}" placeholder="un oggetto a cui tieni">
            </label>

            <div class="pb-hint" style="margin-top:8px;">Dotazione fissa: Stimpack incluso.</div>
        `;
    }

    function stepSummary() {
        const sp = species();
        const weapon = weapons.find((w) => w.slug === draft.weaponSlug);
        const armor = armors.find((a) => a.slug === draft.armorSlug);

        return `
            <div class="pb-step-intro">Rivedi la scheda; conferma per creare il personaggio.</div>
            <h2>${esc(draft.name)}</h2>
            <div class="pb-label" id="pb-cr-meta">
                ${esc(sp?.name ?? '')} · PA ${paMax()} (${esc(paSourceLabel(paTrackedBy()))}) · TAPPI ${draft.special.luck}
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
                ${draft.skills.length === 0
                    ? '<div class="pb-empty">Nessuna abilità</div>'
                    : draft.skills.map((r) => `
                        <div class="pb-spend-row">
                            ${esc(skillName(r.id))}
                            <span class="pb-label">${SKILL_LEVEL_LABELS[r.level]}</span>
                        </div>
                    `).join('')}
            </div>

            <div class="pb-section-head">EQUIPAGGIAMENTO</div>
            <ul class="pb-summary-list" id="pb-cr-summary-gear">
                ${weapon ? `<li>${esc(weapon.name)}</li>` : ''}
                ${armor ? `<li>${esc(armor.name)}</li>` : ''}
                ${consumables.map((c) => `<li>${esc(c.name)} ×1</li>`).join('')}
                ${draft.keepsake.trim() ? `<li>${esc(draft.keepsake.trim())}</li>` : ''}
            </ul>
        `;
    }

    const STEP_BODIES = [stepIdentita, stepSpecial, stepSkills, stepEquipment, stepSummary];

    // ── shell ────────────────────────────────────────────────────────

    function draw() {
        const valid = stepValid();

        mount(root, `
            <div class="pb-header">
                <div class="pb-header-top">
                    <h2>CREAZIONE</h2>
                    <span class="pb-label" id="pb-cr-counter">${step}/${TOTAL_STEPS} · ${STEP_LABELS[step - 1]}</span>
                </div>
                <div class="pb-progress" id="pb-cr-progress">
                    ${STEP_LABELS.map((_, i) =>
                        `<span class="pb-progress-seg${i < step ? ' filled' : ''}"></span>`).join('')}
                </div>
            </div>
            <div class="pb-screen-content" id="pb-cr-body">${STEP_BODIES[step - 1]()}</div>
            <div class="pb-wizard-footer">
                <button class="pb-btn" id="pb-cr-back">◄ INDIETRO</button>
                ${error ? `<span class="pb-error" id="pb-cr-error">${esc(error)}</span>` : ''}
                ${step < TOTAL_STEPS
                    ? `<button class="pb-btn pb-btn--primary" id="pb-cr-next" ${valid ? '' : 'disabled'}>AVANTI ▸</button>`
                    : `<button class="pb-btn pb-btn--primary pb-btn--create" id="pb-cr-create" ${submitting ? 'disabled' : ''}>✓ CREA PERSONAGGIO</button>`}
            </div>
        `);

        bind();
    }

    // A small confirm popup: the maestria budget is advisory, so going forward
    // over budget is a deliberate, acknowledged choice rather than a block.
    function confirmOverBudget(onContinue) {
        const overlay = document.createElement('div');
        overlay.className = 'pb-popup-overlay';
        overlay.innerHTML = `
            <div class="pb-popup" role="dialog" aria-modal="true">
                <div class="pb-popup-title">MAESTRIA OLTRE IL BUDGET (${budget()})</div>
                <div class="pb-popup-actions">
                    <button class="pb-btn" data-cancel>ANNULLA</button>
                    <button class="pb-btn pb-btn--primary" data-continue>CONTINUA</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.querySelector('[data-cancel]').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        overlay.querySelector('[data-continue]').addEventListener('click', () => { close(); onContinue(); });
    }

    function bind() {
        root.querySelector('#pb-cr-back').addEventListener('click', () => {
            if (step === 1) return onCancel();
            step -= 1;
            draw();
        });

        const next = root.querySelector('#pb-cr-next');
        if (next) next.addEventListener('click', () => {
            // Over-budget on the Tag Skills step confirms before advancing.
            if (step === 3 && maestriaCost(draft.skills) > budget()) {
                confirmOverBudget(() => { step += 1; draw(); });
                return;
            }
            step += 1;
            draw();
        });

        const create = root.querySelector('#pb-cr-create');
        if (create) create.addEventListener('click', submit);

        if (step === 1) bindIdentita();
        else if (step === 2) bindSpecial();
        else if (step === 3) bindSkills();
        else if (step === 4) bindEquipment();
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

    function bindSkills() {
        // Both the `+` control and the placeholder row open the shared add-popup,
        // configured exactly like the sheet's skills section: a catalog tab over
        // unused skills, and a custom tab (name + maestria toggle). Adding pushes
        // onto the local draft and persists nothing.
        const openAdd = () => {
            const unused = (skillsCatalog ?? []).filter(
                (sc) => !draft.skills.some((s) => s.id === sc.slug));
            openAddPopup({
                title: 'ABILITÀ',
                catalog: {
                    entries: unused,
                    kindNoun: 'abilità',
                    toItem: (entry) => ({ id: entry.slug, level: SKILL_LEVELS[0] }),
                },
                custom: {
                    renderFields: (pane) => {
                        pane.innerHTML = `
                            <input class="pb-input" data-name placeholder="nome abilità">
                            <div class="pb-toggle-row" data-maestria>
                                ${SKILL_LEVELS.map((l, i) =>
                                    `<button class="pb-btn pb-toggle ${i === 0 ? 'active' : ''}" data-level="${l}">${SKILL_LEVEL_LABELS[l]}</button>`).join('')}
                            </div>
                        `;
                        pane.querySelectorAll('[data-maestria] [data-level]').forEach((btn) =>
                            btn.addEventListener('click', () =>
                                pane.querySelectorAll('[data-maestria] [data-level]')
                                    .forEach((b) => b.classList.toggle('active', b === btn))));
                    },
                    readItem: (pane) => {
                        const name = pane.querySelector('[data-name]').value.trim();
                        if (!name) return null;
                        const level = pane.querySelector('[data-maestria] .active')?.dataset.level ?? SKILL_LEVELS[0];
                        return { id: slugify(name), level };
                    },
                },
                onAdd: (item) => {
                    // The catalog tab already excludes added skills; guard the
                    // custom tab against re-adding an existing slug all the same.
                    if (!draft.skills.some((s) => s.id === item.id)) draft.skills.push(item);
                    draw();
                },
            });
        };

        const addBtn = root.querySelector('[data-add-skill]');
        if (addBtn) addBtn.addEventListener('click', openAdd);

        root.querySelectorAll('[data-skill-dec], [data-skill-inc]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.skillDec ?? btn.dataset.skillInc;
                const dir = btn.dataset.skillInc !== undefined ? 1 : -1;
                const s = draft.skills.find((x) => x.id === id);
                if (!s) return;
                const idx = clamp(SKILL_LEVELS.indexOf(s.level) + dir, 0, SKILL_LEVELS.length - 1);
                const level = SKILL_LEVELS[idx];
                if (level === s.level) return;
                s.level = level;
                draw();
            });
        });

        root.querySelectorAll('[data-remove-skill]').forEach((btn) => {
            btn.addEventListener('click', () => {
                draft.skills = draft.skills.filter((s) => s.id !== btn.dataset.removeSkill);
                draw();
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
            const trackedBy = paTrackedBy();
            const max = paMax();

            await patchSpecial(campaignId, created.id, { ...draft.special });

            if (draft.skills.length > 0) {
                await patchSkills(campaignId, created.id, {
                    items: draft.skills.map((r) => ({ id: r.id, level: r.level })),
                });
            }

            await patchActionPoints(campaignId, created.id, {
                paMax: max,
                paCurrent: max,
                paTrackedBy: trackedBy,
            });

            // Seed the health margin from the species template; it lives on the
            // character document thereafter (falling back to 4 if unset).
            await patchStatus(campaignId, created.id, { margin: sp?.margin ?? 4 });

            await patchResources(campaignId, created.id, {
                scraps: 0,
                caps: draft.special.luck,
            });

            const inventory = {};
            if (weapon) inventory.weapons = { items: [copyTemplate(weapon)] };
            if (armor) inventory.equip = { items: [copyTemplate(armor)] };
            if (consumables.length > 0) {
                inventory.consumables = {
                    // Templates carry no quantity; instantiating adds exactly one.
                    items: consumables.map((c) => ({
                        name: c.name,
                        quantity: 1,
                        ...(c.description ? { description: c.description } : {}),
                    })),
                };
            }
            if (draft.keepsake.trim()) {
                inventory.misc = { items: [{ name: draft.keepsake.trim(), quantity: 1 }] };
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
