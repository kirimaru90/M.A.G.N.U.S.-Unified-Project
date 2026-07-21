import { esc } from '../engine/render.js';
import { patchSkills, patchPerks } from '../api/characters.js';
import { APPROACHES, SKILL_LEVELS, SKILL_LEVEL_LABELS, clamp } from '../sheet/model.js';
import { pips } from '../sheet/pips.js';
import { openAddPopup } from './add-popup.js';
import { getTalentsCatalog } from '../api/catalogs.js';

// A talent's requirement is "met" when every non-zero minimum in
// `specialRequirement` is at or below the character's corresponding SPECIAL.
// No requirement at all (field absent) is always met.
function meetsRequirement(special, specialRequirement) {
    if (!specialRequirement) return true;
    return APPROACHES.every((a, i) => (specialRequirement[i] || 0) <= (special?.[a.key] ?? 0));
}

// The non-zero SPECIAL minimums a talent's `specialRequirement` carries, as
// `{ letter, min }[]` in S·P·E·C·I·A·L order. Shared by the detail popup and
// the picker row's inline chips so both render off the same derivation.
function talentReqs(entry) {
    return APPROACHES
        .map((a, i) => ({ letter: a.letter, min: entry.specialRequirement?.[i] || 0 }))
        .filter((r) => r.min > 0);
}

// The talent detail popup body: name, description, and — only for stats with a
// non-zero minimum — a compact `LETTERA · N` line per stat. No requirement at
// all renders no requirement line.
function talentDetail(entry) {
    const reqs = talentReqs(entry);
    return `
        <div class="pb-popup-title">${esc(entry.name)}</div>
        ${entry.description ? `<div class="pb-label">${esc(entry.description)}</div>` : ''}
        ${reqs.length > 0 ? `<div class="pb-talent-req">${reqs.map((r) => `<span>${esc(r.letter)} · ${r.min}</span>`).join('')}</div>` : ''}
    `;
}

// Inline picker-row chips: one `LETTERA · N` chip per non-zero minimum, same
// data as `talentDetail`'s requirement line. No requirement → no second line.
function talentReqChips(entry) {
    const reqs = talentReqs(entry);
    if (reqs.length === 0) return '';
    return reqs.map((r) => `<span class="pb-chip">${esc(r.letter)} · ${r.min}</span>`).join('');
}

// Maestria maps to a filled count on a three-slot square row, in the same visual
// language as the SPECIAL pips: COMPETENTE=1, ESPERTO=2, MAESTRO=3.
const SKILL_SLOTS = 3;
function maestriaSquares(level) {
    return pips(SKILL_LEVELS.indexOf(level) + 1, SKILL_SLOTS);
}

// Maestria is narrative only: COMPETENTE raises the Risk a GM applies by one
// grade, ESPERTO leaves it, MAESTRO lowers it. No mechanical dice effect.
const PA_SPEND = [
    ['RITIRA FALLITI ·', '1 PA · richiede la Tag Skill pertinente'],
    ['RUBA LA SCENA ·', '1 PA · agisci fuori turno o di nuovo'],
    ['V.A.T.S. ·', '1 PA · sfrutta un vantaggio, effetto mirato'],
];

function skillName(catalog, slug) {
    return catalog.find((s) => s.slug === slug)?.name ?? slug;
}

// A custom (catalog-less) skill still needs an identity the PATCH .../skills
// contract accepts; we derive a client-side slug from the typed name.
function slugify(name) {
    return name
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'skill';
}

// Display order is alphabetical by catalog name. Identity stays the slug
// (`s.id`) carried in data-* attributes, so sorting never affects edits.
function sortedSkills(skills, catalog) {
    return [...skills].sort((a, b) =>
        skillName(catalog, a.id).localeCompare(skillName(catalog, b.id)));
}

function skillsView(skills, catalog) {
    if (skills.length === 0) return '<div class="pb-empty">Nessuna abilità</div>';
    return sortedSkills(skills, catalog).map((s) => `
        <div class="pb-row pb-split-row">
            <span>${esc(skillName(catalog, s.id))}</span>
            ${maestriaSquares(s.level)}
        </div>
    `).join('');
}

// Editor row: a bounded [−] ▪▪▫ [+] stepper replacing the former <select>. The
// catalog name is the left lateral label; the enum string stays as a lateral
// indicator; `−`/`+` clamp to COMPETENTE..MAESTRO; a `✕` removes the skill.
function skillEditRow(s, catalog) {
    const idx = SKILL_LEVELS.indexOf(s.level);
    return `
        <div class="pb-row pb-split-row pb-skill-row" data-skill-row="${esc(s.id)}">
            <span class="pb-skill-name">${esc(skillName(catalog, s.id))}</span>
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

function skillsEdit(skills, catalog) {
    return sortedSkills(skills, catalog).map((s) => skillEditRow(s, catalog)).join('');
}

function perksView(perks) {
    if (perks.length === 0) return '<div class="pb-empty">Nessun talento</div>';
    return perks.map((p) => `
        <div class="pb-row">
            <strong>${esc(p.name)}</strong>
            ${p.description ? `<div class="pb-label">${esc(p.description)}</div>` : ''}
        </div>
    `).join('');
}

function perksEdit(perks) {
    return perks.map((p) => `
        <div class="pb-row" data-perk-row="${esc(p.id)}">
            <div class="pb-split-row">
                <input class="pb-input" data-perk-name="${esc(p.id)}" value="${esc(p.name)}">
                <button class="pb-btn pb-btn--icon" data-remove-perk="${esc(p.id)}">✕</button>
            </div>
            <input class="pb-input" data-perk-desc="${esc(p.id)}" value="${esc(p.description ?? '')}" placeholder="descrizione">
        </div>
    `).join('');
}

// The maestria selection used by the skills custom-add pane: a single-choice
// toggle row over the three tiers, mirroring the condition sign/weight toggles.
function maestriaToggle() {
    return `
        <div class="pb-toggle-row" data-maestria>
            ${SKILL_LEVELS.map((l, i) =>
                `<button class="pb-btn pb-toggle ${i === 0 ? 'active' : ''}" data-level="${l}">${SKILL_LEVEL_LABELS[l]}</button>`).join('')}
        </div>
    `;
}

/** STATS › Abilità subtab: tag skills (alphabetical) + the read-only SPESA PA block. */
export function renderAbilitaTab(container, ctx) {
    const { character, skillsCatalog, canEdit, editMode, campaignId } = ctx;
    const skills = character.skills ?? [];
    const inEditor = canEdit && editMode;

    container.innerHTML = `
        <div class="pb-section-head pb-inv-head">
            <span>TAG SKILLS · MAESTRIA</span>
            ${canEdit ? '<button class="pb-btn pb-btn--icon pb-inv-add" data-add-skill aria-label="Aggiungi abilità">+</button>' : ''}
        </div>
        <div id="pb-skills-list">${inEditor ? skillsEdit(skills, skillsCatalog) : skillsView(skills, skillsCatalog)}</div>

        <div class="pb-section-head">SPESA PA</div>
        <div class="pb-spend-list" id="pb-pa-spend">
            ${PA_SPEND.map(([head, rest]) =>
                `<div class="pb-spend-row"><span class="pb-spend-head">${head}</span> ${rest}</div>`).join('')}
        </div>
    `;

    const pushSkills = async (body) => {
        const res = await patchSkills(campaignId, character.id, body);
        ctx.onSectionUpdate('skills', res.section ?? res);
    };

    // --- add skill popup (available whenever the user may write the character,
    // in both view and editor mode — matching inventory). Two tabs: pick from
    // the skills catalog (entries not already on the character), or add a custom
    // skill (name + initial maestria) keyed by a client-derived slug.
    const addSkillBtn = container.querySelector('[data-add-skill]');
    if (addSkillBtn) {
        addSkillBtn.addEventListener('click', () => {
            const unused = (skillsCatalog ?? []).filter((sc) => !skills.some((s) => s.id === sc.slug));
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
                            ${maestriaToggle()}
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
                onAdd: (item) => pushSkills({ items: [item] }),
            });
        });
    }

    if (!inEditor) return;

    container.querySelectorAll('[data-skill-dec], [data-skill-inc]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.skillDec ?? btn.dataset.skillInc;
            const dir = btn.dataset.skillInc !== undefined ? 1 : -1;
            const s = skills.find((x) => x.id === id);
            if (!s) return;
            const idx = clamp(SKILL_LEVELS.indexOf(s.level) + dir, 0, SKILL_LEVELS.length - 1);
            const level = SKILL_LEVELS[idx];
            if (level === s.level) return;
            return pushSkills({ items: [{ id, level }] });
        });
    });

    container.querySelectorAll('[data-remove-skill]').forEach((btn) => {
        btn.addEventListener('click', () => pushSkills({ deletedIds: [btn.dataset.removeSkill] }));
    });
}

/** STATS › Talents subtab: perks only. */
export function renderTalentsTab(container, ctx) {
    const { character, canEdit, editMode, campaignId } = ctx;
    const perks = character.perks ?? [];
    const inEditor = canEdit && editMode;

    container.innerHTML = `
        <div class="pb-section-head pb-inv-head">
            <span>TALENTI</span>
            ${canEdit ? '<button class="pb-btn pb-btn--icon pb-inv-add" data-add-talent aria-label="Aggiungi talento">+</button>' : ''}
        </div>
        <div id="pb-perks-list">${inEditor ? perksEdit(perks) : perksView(perks)}</div>
    `;

    const pushPerks = async (body) => {
        const res = await patchPerks(campaignId, character.id, body);
        ctx.onSectionUpdate('perks', res.section ?? res);
    };

    // --- add talent popup (available in both view and editor mode). The talents
    // catalog is fetched defensively — a 400/absent endpoint degrades to an empty
    // "Scegli esistente" tab with no error, and the custom tab stays fully usable.
    const addTalentBtn = container.querySelector('[data-add-talent]');
    if (addTalentBtn) {
        addTalentBtn.addEventListener('click', async () => {
            const catalog = await getTalentsCatalog();
            openAddPopup({
                title: 'TALENTO',
                catalog: {
                    entries: catalog,
                    kindNoun: 'talento',
                    toItem: (entry) => {
                        const item = { name: entry.name };
                        if (entry.description) item.description = entry.description;
                        return item;
                    },
                    rowRank: (entry) => (meetsRequirement(character.special, entry.specialRequirement) ? 0 : 1),
                    rowAccent: (entry) => (meetsRequirement(character.special, entry.specialRequirement) ? '' : 'pb-picker-row--unmet'),
                    renderSub: talentReqChips,
                    detail: talentDetail,
                },
                custom: {
                    renderFields: (pane) => {
                        pane.innerHTML = `
                            <input class="pb-input" data-name placeholder="nome talento">
                            <input class="pb-input" data-desc placeholder="descrizione">
                        `;
                    },
                    readItem: (pane) => {
                        const name = pane.querySelector('[data-name]').value.trim();
                        if (!name) return null;
                        const description = pane.querySelector('[data-desc]').value.trim();
                        const item = { name };
                        if (description) item.description = description;
                        return item;
                    },
                },
                onAdd: (item) => pushPerks({ items: [item] }),
            });
        });
    }

    if (!inEditor) return;

    container.querySelectorAll('[data-remove-perk]').forEach((btn) => {
        btn.addEventListener('click', () => pushPerks({ deletedIds: [btn.dataset.removePerk] }));
    });

    const commitPerk = (id) => {
        const name = container.querySelector(`[data-perk-name="${CSS.escape(id)}"]`).value.trim();
        const description = container.querySelector(`[data-perk-desc="${CSS.escape(id)}"]`).value.trim();
        if (!name) return undefined;
        return pushPerks({ items: [{ id, name, description }] });
    };
    container.querySelectorAll('[data-perk-name], [data-perk-desc]').forEach((input) => {
        input.addEventListener('change', () =>
            commitPerk(input.dataset.perkName ?? input.dataset.perkDesc));
    });
}
