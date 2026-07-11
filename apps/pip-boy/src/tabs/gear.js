import { esc } from '../engine/render.js';
import { patchInventory, patchResources } from '../api/characters.js';

const RESOURCES = [
    { key: 'caps', label: 'TAPPI' },
    { key: 'scraps', label: 'ROTTAMI' },
    { key: 'bobbleheads', label: 'BOBBLEHEAD' },
];

/** `core` chips are tinted + solid; `extra` chips are unfilled + dashed. */
function tagChip(tag, itemId, section, index, editMode) {
    const cls = `pb-chip pb-chip--${tag.type === 'core' ? 'core' : 'extra'}${tag.damaged ? ' damaged' : ''}`;
    if (editMode) {
        return `
            <span class="${cls}">
                <input class="pb-chip-input" data-tag-name="${esc(itemId)}" data-section="${section}" data-index="${index}" value="${esc(tag.name)}">
                <span class="kind">${tag.type.toUpperCase()}</span>
                <button class="pb-chip-remove" data-remove-tag="${esc(itemId)}" data-section="${section}" data-index="${index}">✕</button>
            </span>
        `;
    }
    // In view mode tapping a chip toggles that tag's damaged flag.
    return `
        <button class="${cls}" data-toggle-tag="${esc(itemId)}" data-section="${section}" data-index="${index}">
            ${esc(tag.name)} <span class="kind">${tag.type.toUpperCase()}</span>
        </button>
    `;
}

function itemRow(item, section, editMode) {
    const tags = item.tags ?? [];
    const damaged = tags.some((t) => t.damaged);
    return `
        <div class="pb-row" data-item="${esc(item.id)}">
            <div class="pb-split-row">
                ${editMode
                    ? `<input class="pb-input" data-item-name="${esc(item.id)}" data-section="${section}" value="${esc(item.name)}">`
                    : `<strong>${esc(item.name)}</strong>`}
                ${damaged ? '<span class="pb-danger-tag">DANNEGGIATA</span>' : ''}
                ${editMode ? `<button class="pb-btn pb-btn--icon" data-remove-item="${esc(item.id)}" data-section="${section}">✕</button>` : ''}
            </div>
            <div class="pb-chip-row">
                ${tags.map((t, i) => tagChip(t, item.id, section, i, editMode)).join('')}
                ${editMode ? `
                    <button class="pb-btn pb-btn--dashed pb-btn--tiny" data-add-tag="${esc(item.id)}" data-section="${section}" data-type="core">+ core</button>
                    <button class="pb-btn pb-btn--dashed pb-btn--tiny" data-add-tag="${esc(item.id)}" data-section="${section}" data-type="extra">+ extra</button>
                ` : ''}
            </div>
        </div>
    `;
}

function consumableRow(item, editMode) {
    return `
        <div class="pb-consumable-row" data-item="${esc(item.id)}">
            <span class="pb-consumable-name">${esc(item.name)}</span>
            <span class="pb-label">×${item.quantity ?? 0}</span>
            <div class="pb-stepper pb-stepper--tiny" data-qty="${esc(item.id)}">
                <button data-dir="-1" ${(item.quantity ?? 0) <= 0 ? 'disabled' : ''}>−</button>
                <button data-dir="1">+</button>
            </div>
            ${editMode ? `<button class="pb-btn pb-btn--icon" data-remove-item="${esc(item.id)}" data-section="consumables">✕</button>` : ''}
        </div>
    `;
}

function itemList(items, section, editMode, addLabel) {
    return `
        <div data-section-list="${section}">
            ${items.length === 0 ? '<div class="pb-empty">Vuoto</div>' : items.map((i) => itemRow(i, section, editMode)).join('')}
        </div>
        ${editMode ? `
            <div class="pb-add-row">
                <input class="pb-input" id="pb-add-${section}-name" placeholder="nome">
                <button class="pb-btn pb-btn--dashed" data-add-item="${section}">${addLabel}</button>
            </div>
        ` : ''}
    `;
}

export function renderGearTab(container, ctx) {
    const { character, canEdit, editMode, campaignId } = ctx;
    const inv = character.inventory ?? {};
    const resources = character.resources ?? {};
    const inEditor = canEdit && editMode;

    container.innerHTML = `
        <div class="pb-resource-row">
            ${RESOURCES.map(({ key, label }) => `
                <div class="pb-resource-box">
                    <div class="pb-label">${label}</div>
                    <div class="pb-stepper pb-stepper--tiny" data-resource="${key}">
                        <button data-dir="-1" ${!canEdit || (resources[key] ?? 0) <= 0 ? 'disabled' : ''}>−</button>
                        <input class="pb-input pb-resource-input" data-resource-input="${key}" type="number" min="0"
                               value="${resources[key] ?? 0}" ${canEdit ? '' : 'disabled'}>
                        <button data-dir="1" ${canEdit ? '' : 'disabled'}>+</button>
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="pb-section-head">ARMI</div>
        ${itemList(inv.weapons ?? [], 'weapons', inEditor, '+ AGGIUNGI ARMA')}

        <div class="pb-section-head">ARMATURE</div>
        ${itemList(inv.equip ?? [], 'equip', inEditor, '+ AGGIUNGI ARMATURA')}

        <div class="pb-section-head">CONSUMABILI</div>
        <div data-section-list="consumables">
            ${(inv.consumables ?? []).length === 0
                ? '<div class="pb-empty">Vuoto</div>'
                : inv.consumables.map((i) => consumableRow(i, inEditor)).join('')}
        </div>
        ${inEditor ? `
            <div class="pb-add-row">
                <input class="pb-input" id="pb-add-consumables-name" placeholder="nome">
                <button class="pb-btn pb-btn--dashed" data-add-item="consumables">+ AGGIUNGI CONSUMABILE</button>
            </div>
        ` : ''}
    `;

    if (!canEdit) return;

    const findItem = (section, id) => (inv[section] ?? []).find((i) => i.id === id);

    async function patchInv(section, body) {
        const res = await patchInventory(campaignId, character.id, { [section]: body });
        ctx.onSectionUpdate('inventory', res.section ?? res);
    }
    async function patchRes(body) {
        const res = await patchResources(campaignId, character.id, body);
        ctx.onSectionUpdate('resources', res.section ?? res);
    }

    // --- resources: stepper and direct numeric entry both write the same field
    container.querySelectorAll('[data-resource]').forEach((stepper) => {
        const key = stepper.dataset.resource;
        stepper.querySelectorAll('button').forEach((btn) => {
            btn.addEventListener('click', () => {
                const next = Math.max(0, (resources[key] ?? 0) + Number(btn.dataset.dir));
                if (next === resources[key]) return;
                return patchRes({ [key]: next });
            });
        });
    });
    container.querySelectorAll('[data-resource-input]').forEach((input) => {
        input.addEventListener('change', () => {
            const value = Math.max(0, Number(input.value) || 0);
            return patchRes({ [input.dataset.resourceInput]: value });
        });
    });

    // --- view mode: tap a chip to toggle its damaged flag
    container.querySelectorAll('[data-toggle-tag]').forEach((chip) => {
        chip.addEventListener('click', () => {
            const { section, index } = chip.dataset;
            const id = chip.dataset.toggleTag;
            const item = findItem(section, id);
            if (!item) return;
            const tags = (item.tags ?? []).map((t, i) =>
                i === Number(index) ? { ...t, damaged: !t.damaged } : t);
            return patchInv(section, { items: [{ id, tags }] });
        });
    });

    // --- consumable quantity: available in view mode, not just the editor
    container.querySelectorAll('[data-qty]').forEach((stepper) => {
        const id = stepper.dataset.qty;
        stepper.querySelectorAll('button').forEach((btn) => {
            btn.addEventListener('click', () => {
                const item = findItem('consumables', id);
                if (!item) return;
                const next = Math.max(0, (item.quantity ?? 0) + Number(btn.dataset.dir));
                if (next === item.quantity) return;
                return patchInv('consumables', { items: [{ id, quantity: next }] });
            });
        });
    });

    if (!inEditor) return;

    // --- editor mode: tag add/remove/rename, item add/remove/rename
    container.querySelectorAll('[data-add-tag]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const { section, type } = btn.dataset;
            const id = btn.dataset.addTag;
            const item = findItem(section, id);
            if (!item) return;
            const tags = [...(item.tags ?? []), { name: 'NUOVO', type, damaged: false }];
            return patchInv(section, { items: [{ id, tags }] });
        });
    });

    container.querySelectorAll('[data-remove-tag]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const { section, index } = btn.dataset;
            const id = btn.dataset.removeTag;
            const item = findItem(section, id);
            if (!item) return;
            const tags = (item.tags ?? []).filter((_, i) => i !== Number(index));
            return patchInv(section, { items: [{ id, tags }] });
        });
    });

    container.querySelectorAll('[data-tag-name]').forEach((input) => {
        input.addEventListener('change', () => {
            const { section, index } = input.dataset;
            const id = input.dataset.tagName;
            const item = findItem(section, id);
            if (!item) return;
            const tags = (item.tags ?? []).map((t, i) =>
                i === Number(index) ? { ...t, name: input.value.trim() } : t);
            return patchInv(section, { items: [{ id, tags }] });
        });
    });

    container.querySelectorAll('[data-item-name]').forEach((input) => {
        input.addEventListener('change', () =>
            patchInv(input.dataset.section, { items: [{ id: input.dataset.itemName, name: input.value.trim() }] }));
    });

    container.querySelectorAll('[data-remove-item]').forEach((btn) => {
        btn.addEventListener('click', () =>
            patchInv(btn.dataset.section, { deletedIds: [btn.dataset.removeItem] }));
    });

    container.querySelectorAll('[data-add-item]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const section = btn.dataset.addItem;
            const nameEl = container.querySelector(`#pb-add-${section}-name`);
            const name = nameEl.value.trim();
            if (!name) return;
            const item = section === 'consumables' ? { name, quantity: 1 } : { name };
            return patchInv(section, { items: [item] });
        });
    });
}
