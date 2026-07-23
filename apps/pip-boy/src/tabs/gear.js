import { esc } from '../engine/render.js';
import { patchInventory } from '../api/characters.js';
import { openAddItemPopup } from './add-item-popup.js';
import { openInfoPopup } from './info-popup.js';
import { openCatalogPicker } from './catalog-picker.js';
import { openConfirm } from './confirm-dialog.js';

// Weapons/armor render tag chips; consumables/misc render quantity rows. A
// consumable/misc description is no longer shown inline — the name is an
// activatable control opening the read-only detail popup.
const TAG_SECTIONS = new Set(['weapons', 'equip']);

// Tags arrive from the API already in canonical order (`core` first, then
// `extra`, alphabetical by name within each group — see api-character-inventory),
// so the client renders the stored array directly and per-tag edit handlers
// (toggle damaged / rename / remove) target tags by their stored index.

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
                ${editMode ? `<button class="pb-btn pb-btn--danger pb-btn--icon" data-remove-item="${esc(item.id)}" data-section="${section}">✕</button>` : ''}
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

/**
 * Compact quantity row for consumables and Vari (`misc`). The `[−][+]` stepper
 * is right-aligned and no description renders inline. In view mode the name is
 * an activatable control that opens the read-only detail popup; in editor mode
 * it is an inline text input (and the description is editable there).
 */
function qtyItemRow(item, section, editMode) {
    return `
        <div class="pb-consumable-row" data-item="${esc(item.id)}">
            ${editMode
                ? `<input class="pb-input pb-consumable-name" data-item-name="${esc(item.id)}" data-section="${section}" value="${esc(item.name)}">`
                : `<button class="pb-consumable-name" data-info-name="${esc(item.id)}" data-section="${section}">${esc(item.name)}</button>`}
            <span class="pb-label pb-consumable-qty">×${item.quantity ?? 0}</span>
            <div class="pb-stepper pb-stepper--tiny pb-consumable-stepper" data-qty="${esc(item.id)}" data-section="${section}">
                <button data-dir="-1" ${(item.quantity ?? 0) <= 0 ? 'disabled' : ''}>−</button>
                <button data-dir="1">+</button>
            </div>
            ${editMode ? `<button class="pb-btn pb-btn--danger pb-btn--icon" data-remove-item="${esc(item.id)}" data-section="${section}">✕</button>` : ''}
            ${editMode
                ? `<input class="pb-input pb-consumable-desc" data-item-desc="${esc(item.id)}" data-section="${section}" value="${esc(item.description ?? '')}" placeholder="descrizione">`
                : ''}
        </div>
    `;
}

/**
 * Renders one INV subtab: exactly one inventory collection and its `+` add
 * trigger (view and editor mode both). The resources band is rendered by the
 * sheet shell (screens/sheet.js) as a fixed strip above the footer, not here.
 * `node` carries `invKey` (the collection) and `invKind` (the catalog kind the
 * add-item popup filters by).
 */
export function renderInvSubtab(container, ctx, node) {
    const { character, canEdit, editMode, campaignId } = ctx;
    const section = node.invKey;
    const isTagSection = TAG_SECTIONS.has(section);
    const inv = character.inventory ?? {};
    const items = inv[section] ?? [];
    const inEditor = canEdit && editMode;

    const listHtml = items.length === 0
        ? '<div class="pb-empty">Vuoto</div>'
        : items.map((i) => isTagSection
            ? tagItemRow(i, section, inEditor)
            : qtyItemRow(i, section, inEditor)).join('');

    container.innerHTML = `
        <div class="pb-section-head pb-inv-head">
            <span>${esc(node.label.toUpperCase())}</span>
            ${canEdit ? '<button class="pb-btn pb-btn--icon pb-inv-add" data-add-open aria-label="Aggiungi">+</button>' : ''}
        </div>
        <div class="pb-inv-list" data-section-list="${section}">${listHtml}</div>
    `;

    const findItem = (sec, id) => (inv[sec] ?? []).find((i) => i.id === id);

    // --- view mode: tapping a consumable/misc name opens its read-only detail
    // popup. Available to every viewer (it writes nothing), so wired before the
    // editor-only guards below.
    container.querySelectorAll('[data-info-name]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const item = findItem(btn.dataset.section, btn.dataset.infoName);
            if (!item) return;
            openInfoPopup({ title: item.name, body: item.description ?? '' });
        });
    });

    if (!canEdit) return;

    async function patchInv(sec, body) {
        const res = await patchInventory(campaignId, character.id, { [sec]: body });
        ctx.onSectionUpdate('inventory', res.section ?? res);
    }

    // --- add-item popup (available in both view and editor mode) ------------
    const addBtn = container.querySelector('[data-add-open]');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            openAddItemPopup({
                kind: node.invKind,
                label: node.label,
                catalog: ctx.getEquipmentCatalog?.() ?? null,
                tagCatalog: ctx.getTagCatalog?.() ?? null,
                onAdd: (item) => patchInv(section, { items: [item] }),
            });
        });
    }

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
    // Adding a tag opens the picker over the tag catalog; the chosen (or
    // free-typed) name fills the new tag, whose `core`/`extra` type comes from
    // which affordance was tapped. A non-catalog name stays valid (allowFreeText).
    container.querySelectorAll('[data-add-tag]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const { section: sec, type } = btn.dataset;
            const id = btn.dataset.addTag;
            const item = findItem(sec, id);
            if (!item) return;
            openCatalogPicker({
                title: 'Scegli tag',
                entries: ctx.getTagCatalog?.() ?? [],
                allowFreeText: true,
                onPick: (entry) => {
                    const name = (entry.name ?? '').trim() || 'NUOVO';
                    const tags = [...(item.tags ?? []), { name, type, damaged: false }];
                    return patchInv(sec, { items: [{ id, tags }] });
                },
            });
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
        btn.addEventListener('click', () => {
            openConfirm({
                message: 'Rimuovere questo oggetto?',
                onConfirm: () => patchInv(btn.dataset.section, { deletedIds: [btn.dataset.removeItem] }),
            });
        });
    });
}
