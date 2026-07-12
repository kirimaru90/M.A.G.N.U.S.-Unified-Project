import { esc } from '../engine/render.js';
import { patchInventory, patchResources } from '../api/characters.js';
import { openAddItemPopup } from './add-item-popup.js';

const RESOURCES = [
    { key: 'caps', label: 'TAPPI' },
    { key: 'scraps', label: 'ROTTAMI' },
    { key: 'bobbleheads', label: 'BOBBLEHEAD' },
];

// Weapons/armor render tag chips; consumables/other render quantity rows (with
// an optional description on Vari).
const TAG_SECTIONS = new Set(['weapons', 'equip']);

/**
 * Display order for an item's tags: all `core` first, then all `extra`,
 * alphabetical by name within each group. This is display-only — it never
 * reorders the stored array. Each entry keeps its ORIGINAL stored index so the
 * per-tag edit handlers (toggle damaged / rename / remove) still target the
 * right stored slot even when display order differs.
 */
function orderedTags(tags) {
    return (tags ?? [])
        .map((t, i) => ({ t, i }))
        .sort((a, b) => {
            const ra = a.t.type === 'core' ? 0 : 1;
            const rb = b.t.type === 'core' ? 0 : 1;
            if (ra !== rb) return ra - rb;
            return (a.t.name ?? '').localeCompare(b.t.name ?? '');
        });
}

/** `core` chips are tinted + solid; `extra` chips are unfilled + dashed. `index` is the stored index. */
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

function tagItemRow(item, section, editMode) {
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
                ${orderedTags(tags).map(({ t, i }) => tagChip(t, item.id, section, i, editMode)).join('')}
                ${editMode ? `
                    <button class="pb-btn pb-btn--dashed pb-btn--tiny" data-add-tag="${esc(item.id)}" data-section="${section}" data-type="core">+ core</button>
                    <button class="pb-btn pb-btn--dashed pb-btn--tiny" data-add-tag="${esc(item.id)}" data-section="${section}" data-type="extra">+ extra</button>
                ` : ''}
            </div>
        </div>
    `;
}

/** Compact quantity row for consumables and Vari (`other`). Vari also shows a description. */
function qtyItemRow(item, section, editMode, withDesc) {
    return `
        <div class="pb-consumable-row" data-item="${esc(item.id)}">
            <div class="pb-split-row">
                ${editMode
                    ? `<input class="pb-input pb-consumable-name" data-item-name="${esc(item.id)}" data-section="${section}" value="${esc(item.name)}">`
                    : `<span class="pb-consumable-name">${esc(item.name)}</span>`}
                <span class="pb-label">×${item.quantity ?? 0}</span>
                <div class="pb-stepper pb-stepper--tiny" data-qty="${esc(item.id)}" data-section="${section}">
                    <button data-dir="-1" ${(item.quantity ?? 0) <= 0 ? 'disabled' : ''}>−</button>
                    <button data-dir="1">+</button>
                </div>
                ${editMode ? `<button class="pb-btn pb-btn--icon" data-remove-item="${esc(item.id)}" data-section="${section}">✕</button>` : ''}
            </div>
            ${withDesc ? (editMode
                ? `<input class="pb-input" data-item-desc="${esc(item.id)}" data-section="${section}" value="${esc(item.description ?? '')}" placeholder="descrizione">`
                : (item.description ? `<div class="pb-label">${esc(item.description)}</div>` : '')) : ''}
        </div>
    `;
}

/**
 * Renders one INV subtab: exactly one inventory collection, its `+` add trigger
 * (view and editor mode both), and the resources row pinned at the bottom.
 * `node` carries `invKey` (the collection) and `invKind` (the catalog kind the
 * add-item popup filters by; null for Vari).
 */
export function renderInvSubtab(container, ctx, node) {
    const { character, canEdit, editMode, campaignId } = ctx;
    const section = node.invKey;
    const isTagSection = TAG_SECTIONS.has(section);
    const withDesc = section === 'other';
    const inv = character.inventory ?? {};
    const resources = character.resources ?? {};
    const items = inv[section] ?? [];
    const inEditor = canEdit && editMode;

    const listHtml = items.length === 0
        ? '<div class="pb-empty">Vuoto</div>'
        : items.map((i) => isTagSection
            ? tagItemRow(i, section, inEditor)
            : qtyItemRow(i, section, inEditor, withDesc)).join('');

    container.innerHTML = `
        <div class="pb-section-head pb-inv-head">
            <span>${esc(node.label.toUpperCase())}</span>
            ${canEdit ? '<button class="pb-btn pb-btn--icon pb-inv-add" data-add-open aria-label="Aggiungi">+</button>' : ''}
        </div>
        <div data-section-list="${section}">${listHtml}</div>

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
    `;

    if (!canEdit) return;

    const findItem = (sec, id) => (inv[sec] ?? []).find((i) => i.id === id);

    async function patchInv(sec, body) {
        const res = await patchInventory(campaignId, character.id, { [sec]: body });
        ctx.onSectionUpdate('inventory', res.section ?? res);
    }
    async function patchRes(body) {
        const res = await patchResources(campaignId, character.id, body);
        ctx.onSectionUpdate('resources', res.section ?? res);
    }

    // --- add-item popup (available in both view and editor mode) ------------
    const addBtn = container.querySelector('[data-add-open]');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            openAddItemPopup({
                kind: node.invKind,
                label: node.label,
                catalog: ctx.getEquipmentCatalog?.() ?? null,
                onAdd: (item) => patchInv(section, { items: [item] }),
            });
        });
    }

    // --- resources: stepper and direct numeric entry both write the same field
    container.querySelectorAll('[data-resource]').forEach((stepper) => {
        const key = stepper.dataset.resource;
        stepper.querySelectorAll('button').forEach((btn) => {
            btn.addEventListener('click', () => {
                const nextVal = Math.max(0, (resources[key] ?? 0) + Number(btn.dataset.dir));
                if (nextVal === resources[key]) return;
                return patchRes({ [key]: nextVal });
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
            const { section: sec, index } = chip.dataset;
            const id = chip.dataset.toggleTag;
            const item = findItem(sec, id);
            if (!item) return;
            const tags = (item.tags ?? []).map((t, i) =>
                i === Number(index) ? { ...t, damaged: !t.damaged } : t);
            return patchInv(sec, { items: [{ id, tags }] });
        });
    });

    // --- quantity: available in view mode, not just the editor
    container.querySelectorAll('[data-qty]').forEach((stepper) => {
        const id = stepper.dataset.qty;
        const sec = stepper.dataset.section;
        stepper.querySelectorAll('button').forEach((btn) => {
            btn.addEventListener('click', () => {
                const item = findItem(sec, id);
                if (!item) return;
                const nextVal = Math.max(0, (item.quantity ?? 0) + Number(btn.dataset.dir));
                if (nextVal === item.quantity) return;
                return patchInv(sec, { items: [{ id, quantity: nextVal }] });
            });
        });
    });

    if (!inEditor) return;

    // --- editor mode: tag add/remove/rename, item name/description/remove
    container.querySelectorAll('[data-add-tag]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const { section: sec, type } = btn.dataset;
            const id = btn.dataset.addTag;
            const item = findItem(sec, id);
            if (!item) return;
            const tags = [...(item.tags ?? []), { name: 'NUOVO', type, damaged: false }];
            return patchInv(sec, { items: [{ id, tags }] });
        });
    });

    container.querySelectorAll('[data-remove-tag]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const { section: sec, index } = btn.dataset;
            const id = btn.dataset.removeTag;
            const item = findItem(sec, id);
            if (!item) return;
            const tags = (item.tags ?? []).filter((_, i) => i !== Number(index));
            return patchInv(sec, { items: [{ id, tags }] });
        });
    });

    container.querySelectorAll('[data-tag-name]').forEach((input) => {
        input.addEventListener('change', () => {
            const { section: sec, index } = input.dataset;
            const id = input.dataset.tagName;
            const item = findItem(sec, id);
            if (!item) return;
            const tags = (item.tags ?? []).map((t, i) =>
                i === Number(index) ? { ...t, name: input.value.trim() } : t);
            return patchInv(sec, { items: [{ id, tags }] });
        });
    });

    container.querySelectorAll('[data-item-name]').forEach((input) => {
        input.addEventListener('change', () =>
            patchInv(input.dataset.section, { items: [{ id: input.dataset.itemName, name: input.value.trim() }] }));
    });

    container.querySelectorAll('[data-item-desc]').forEach((input) => {
        input.addEventListener('change', () =>
            patchInv(input.dataset.section, { items: [{ id: input.dataset.itemDesc, description: input.value.trim() }] }));
    });

    container.querySelectorAll('[data-remove-item]').forEach((btn) => {
        btn.addEventListener('click', () =>
            patchInv(btn.dataset.section, { deletedIds: [btn.dataset.removeItem] }));
    });
}
