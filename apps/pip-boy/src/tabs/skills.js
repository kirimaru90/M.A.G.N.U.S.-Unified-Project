import { esc } from '../engine/render.js';
import { patchSkills, patchPerks } from '../api/characters.js';
import { SKILL_LEVELS, SKILL_LEVEL_LABELS } from '../sheet/model.js';

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

function skillsView(skills, catalog) {
    if (skills.length === 0) return '<div class="pb-empty">Nessuna abilità</div>';
    return skills.map((s) => `
        <div class="pb-row pb-split-row">
            <span>${esc(skillName(catalog, s.id))}</span>
            <span class="pb-label">${SKILL_LEVEL_LABELS[s.level] ?? s.level}</span>
        </div>
    `).join('');
}

function skillsEdit(skills, catalog) {
    const unused = catalog.filter((sc) => !skills.some((s) => s.id === sc.slug));
    return `
        ${skills.map((s) => `
            <div class="pb-row pb-split-row">
                <span>${esc(skillName(catalog, s.id))}</span>
                <select class="pb-select pb-select--inline" data-skill-level="${esc(s.id)}">
                    ${SKILL_LEVELS.map((l) =>
                        `<option value="${l}" ${s.level === l ? 'selected' : ''}>${SKILL_LEVEL_LABELS[l]}</option>`).join('')}
                </select>
                <button class="pb-btn pb-btn--icon" data-remove-skill="${esc(s.id)}">✕</button>
            </div>
        `).join('')}
        ${unused.length > 0 ? `
            <div class="pb-row pb-add-row">
                <select class="pb-select" id="pb-skill-add-slug">
                    ${unused.map((sc) => `<option value="${esc(sc.slug)}">${esc(sc.name)}</option>`).join('')}
                </select>
                <select class="pb-select pb-select--inline" id="pb-skill-add-level">
                    ${SKILL_LEVELS.map((l) => `<option value="${l}">${SKILL_LEVEL_LABELS[l]}</option>`).join('')}
                </select>
                <button class="pb-btn pb-btn--dashed" id="pb-skill-add-btn">+ ABILITÀ</button>
            </div>
        ` : ''}
    `;
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
    return `
        ${perks.map((p) => `
            <div class="pb-row" data-perk-row="${esc(p.id)}">
                <div class="pb-split-row">
                    <input class="pb-input" data-perk-name="${esc(p.id)}" value="${esc(p.name)}">
                    <button class="pb-btn pb-btn--icon" data-remove-perk="${esc(p.id)}">✕</button>
                </div>
                <input class="pb-input" data-perk-desc="${esc(p.id)}" value="${esc(p.description ?? '')}" placeholder="descrizione">
            </div>
        `).join('')}
        <div class="pb-row pb-add-row">
            <input class="pb-input" id="pb-perk-add-name" placeholder="nome talento">
            <button class="pb-btn pb-btn--dashed" id="pb-perk-add-btn">+ TALENTO</button>
        </div>
    `;
}

export function renderSkillsTab(container, ctx) {
    const { character, skillsCatalog, canEdit, editMode, campaignId } = ctx;
    const skills = character.skills ?? [];
    const perks = character.perks ?? [];
    const inEditor = canEdit && editMode;

    container.innerHTML = `
        <div class="pb-section-head">TAG SKILLS · MAESTRIA</div>
        <div id="pb-skills-list">${inEditor ? skillsEdit(skills, skillsCatalog) : skillsView(skills, skillsCatalog)}</div>

        <div class="pb-section-head">TALENTI</div>
        <div id="pb-perks-list">${inEditor ? perksEdit(perks) : perksView(perks)}</div>

        <div class="pb-section-head">SPESA PA</div>
        <div class="pb-spend-list" id="pb-pa-spend">
            ${PA_SPEND.map(([head, rest]) =>
                `<div class="pb-spend-row"><span class="pb-spend-head">${head}</span> ${rest}</div>`).join('')}
        </div>
    `;

    if (!inEditor) return;

    const pushSkills = async (body) => {
        const res = await patchSkills(campaignId, character.id, body);
        ctx.onSectionUpdate('skills', res.section ?? res);
    };
    const pushPerks = async (body) => {
        const res = await patchPerks(campaignId, character.id, body);
        ctx.onSectionUpdate('perks', res.section ?? res);
    };

    container.querySelectorAll('[data-skill-level]').forEach((sel) => {
        sel.addEventListener('change', () =>
            pushSkills({ items: [{ id: sel.dataset.skillLevel, level: sel.value }] }));
    });

    container.querySelectorAll('[data-remove-skill]').forEach((btn) => {
        btn.addEventListener('click', () => pushSkills({ deletedIds: [btn.dataset.removeSkill] }));
    });

    const addSkillBtn = container.querySelector('#pb-skill-add-btn');
    if (addSkillBtn) {
        addSkillBtn.addEventListener('click', () => {
            const id = container.querySelector('#pb-skill-add-slug').value;
            const level = container.querySelector('#pb-skill-add-level').value;
            if (!id) return;
            return pushSkills({ items: [{ id, level }] });
        });
    }

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

    container.querySelector('#pb-perk-add-btn').addEventListener('click', () => {
        const nameEl = container.querySelector('#pb-perk-add-name');
        const name = nameEl.value.trim();
        if (!name) return;
        return pushPerks({ items: [{ name }] });
    });
}
