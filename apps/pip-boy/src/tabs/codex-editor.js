import { esc } from '../engine/render.js';
import { openConfirm } from './confirm-dialog.js';
import { openCatalogPicker } from './catalog-picker.js';

// The codex entry editor, on the same `.pb-info-popup` shell as the quest
// editor: explicit SALVA, dirty-close confirmation. The map-place field opens
// the catalog picker over the places of the character's map and stores the
// picked place's slug.
//
//   heading     — NUOVA VOCE or MODIFICA VOCE.
//   entry       — the entry being edited, or nothing for a new one.
//   loadPlaces  — () → Promise<[{ slug, name }]>, the character's map places.
//   onSave(body) → Promise; `body` is the create body (blank optionals left
//                  out) for a new entry, else only the changed fields. Resolves
//                  on success (editor closes), rejects on failure (stays open).
//
// Turning PUBBLICA off on an entry the character did not create asks first: the
// character may be seeing it only because it is public.

export const CODEX_TYPES = [
    { value: 'personaggio', label: 'PERSONAGGIO' },
    { value: 'luogo', label: 'LUOGO' },
    { value: 'fazione', label: 'FAZIONE' },
    { value: 'creatura', label: 'CREATURA' },
];

const UNPUBLISH_WARNING = 'Rendendola privata potresti non vederla più. Continuare?';

const isHttpUrl = (v) => /^https?:\/\/\S+$/i.test(v);

export function openCodexEditor({ heading, entry = null, loadPlaces, onSave } = {}) {
    const initial = {
        type: entry?.type ?? null,
        name: entry?.name ?? '',
        imageUrl: entry?.imageUrl ?? '',
        description: entry?.description ?? '',
        isPublic: !!entry?.isPublic,
        mapPlaceSlug: entry?.mapPlaceSlug ?? null,
    };
    let placeSlug = initial.mapPlaceSlug;

    const overlay = document.createElement('div');
    overlay.className = 'pb-popup-overlay';
    overlay.innerHTML = `
        <div class="pb-info-popup pb-quest-editor pb-codex-editor" role="dialog" aria-modal="true" data-codex-editor>
            <button class="pb-popup-close" data-cancel aria-label="Chiudi">✕</button>
            <div class="pb-popup-title">${esc(heading ?? '')}</div>
            <div class="pb-info-popup-body pb-quest-editor-body">
                <div class="pb-field">
                    <span class="pb-label">TIPO</span>
                    <div class="pb-toggle-row pb-codex-type-row" data-type>
                        ${CODEX_TYPES.map((t) => `
                            <button type="button" class="pb-btn pb-toggle${initial.type === t.value ? ' active' : ''}"
                                    data-type-value="${t.value}">${t.label}</button>
                        `).join('')}
                    </div>
                </div>
                <label class="pb-field">
                    <span class="pb-label">NOME</span>
                    <input class="pb-input" data-name value="${esc(initial.name)}">
                </label>
                <label class="pb-field">
                    <span class="pb-label">IMMAGINE (URL)</span>
                    <input class="pb-input" data-image type="url" inputmode="url" placeholder="https://…" value="${esc(initial.imageUrl)}">
                </label>
                <label class="pb-field">
                    <span class="pb-label">DESCRIZIONE</span>
                    <textarea class="pb-input" data-description rows="6">${esc(initial.description)}</textarea>
                </label>
                <div class="pb-toggle-row">
                    <button type="button" class="pb-btn pb-toggle${initial.isPublic ? ' active' : ''}"
                            data-public aria-pressed="${initial.isPublic}">PUBBLICA</button>
                </div>
                <div class="pb-field">
                    <span class="pb-label">LUOGO SULLA MAPPA</span>
                    <div class="pb-codex-place-field">
                        <button type="button" class="pb-btn pb-codex-place-pick" data-place>${placeSlug ? '…' : 'Nessuno'}</button>
                        <button type="button" class="pb-btn pb-btn--tiny" data-place-clear aria-label="Rimuovi luogo"
                                ${placeSlug ? '' : 'hidden'}>✕</button>
                    </div>
                </div>
            </div>
            <div class="pb-error pb-hidden" data-error>Salvataggio non riuscito. Riprova.</div>
            <div class="pb-note-actions">
                <button class="pb-btn pb-btn--primary" data-save>SALVA</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const typeRow = overlay.querySelector('[data-type]');
    const nameInput = overlay.querySelector('[data-name]');
    const imageInput = overlay.querySelector('[data-image]');
    const descInput = overlay.querySelector('[data-description]');
    const publicBtn = overlay.querySelector('[data-public]');
    const placeBtn = overlay.querySelector('[data-place]');
    const placeClear = overlay.querySelector('[data-place-clear]');
    const saveBtn = overlay.querySelector('[data-save]');
    const errorEl = overlay.querySelector('[data-error]');

    overlay.querySelectorAll('[data-type-value]').forEach((btn) => {
        btn.addEventListener('click', () => {
            overlay.querySelectorAll('[data-type-value]').forEach((b) => b.classList.toggle('active', b === btn));
            typeRow.classList.remove('pb-toggle-row--invalid');
        });
    });
    publicBtn.addEventListener('click', () => {
        const on = !publicBtn.classList.contains('active');
        publicBtn.classList.toggle('active', on);
        publicBtn.setAttribute('aria-pressed', String(on));
    });
    nameInput.addEventListener('input', () => nameInput.classList.remove('pb-input--invalid'));
    imageInput.addEventListener('input', () => imageInput.classList.remove('pb-input--invalid'));

    // --- map place ----------------------------------------------------------

    let placesPromise = null;
    const places = () => (placesPromise ??= Promise.resolve(loadPlaces?.() ?? []).catch(() => []));

    function showPlace(name) {
        placeBtn.textContent = placeSlug ? name : 'Nessuno';
        placeClear.hidden = !placeSlug;
    }

    // A linked place the character's map does not show (hidden, or deleted) is
    // left linked but unnamed: the link is not the character's to see.
    if (placeSlug) {
        places().then((list) => {
            if (!overlay.isConnected) return;
            showPlace(list.find((p) => p.slug === placeSlug)?.name ?? 'Luogo collegato');
        });
    }

    placeBtn.addEventListener('click', async () => {
        const list = await places();
        if (!overlay.isConnected) return;
        openCatalogPicker({
            title: 'LUOGO SULLA MAPPA',
            entries: list.map((p) => ({ name: p.name, slug: p.slug })),
            onPick: (picked) => {
                placeSlug = picked.slug;
                showPlace(picked.name);
            },
        });
    });
    placeClear.addEventListener('click', () => {
        placeSlug = null;
        showPlace('');
    });

    // --- save ---------------------------------------------------------------

    function draft() {
        return {
            type: overlay.querySelector('[data-type-value].active')?.dataset.typeValue ?? null,
            name: nameInput.value.trim(),
            imageUrl: imageInput.value.trim(),
            description: descInput.value.trim(),
            isPublic: publicBtn.classList.contains('active'),
            mapPlaceSlug: placeSlug,
        };
    }

    /** The create body, or for an edit only what changed (cleared → null). */
    function body(d) {
        if (!entry) {
            const out = { type: d.type, name: d.name, isPublic: d.isPublic };
            if (d.description) out.description = d.description;
            if (d.imageUrl) out.imageUrl = d.imageUrl;
            if (d.mapPlaceSlug) out.mapPlaceSlug = d.mapPlaceSlug;
            return out;
        }
        const out = {};
        for (const key of ['type', 'name', 'description', 'isPublic'])
            if (d[key] !== initial[key]) out[key] = d[key];
        if (d.imageUrl !== initial.imageUrl) out.imageUrl = d.imageUrl || null;
        if (d.mapPlaceSlug !== initial.mapPlaceSlug) out.mapPlaceSlug = d.mapPlaceSlug;
        return out;
    }

    const snapshot = JSON.stringify(draft());
    const isDirty = () => JSON.stringify(draft()) !== snapshot;
    const close = () => overlay.remove();

    // Await an action, closing on success and keeping the editor open on failure.
    async function run(action) {
        saveBtn.disabled = true;
        errorEl.classList.add('pb-hidden');
        try {
            await action();
            close();
        } catch (_) {
            saveBtn.disabled = false;
            errorEl.classList.remove('pb-hidden');
        }
    }

    saveBtn.addEventListener('click', () => {
        const d = draft();
        let invalid = false;
        if (!d.type) {
            typeRow.classList.add('pb-toggle-row--invalid');
            invalid = true;
        }
        if (d.imageUrl && !isHttpUrl(d.imageUrl)) {
            imageInput.classList.add('pb-input--invalid');
            invalid = true;
        }
        if (!d.name) {
            nameInput.classList.add('pb-input--invalid');
            nameInput.focus();
            invalid = true;
        }
        if (invalid) return;

        const save = () => run(() => onSave?.(body(d)));
        if (entry && initial.isPublic && !d.isPublic && !entry.isOwn) {
            openConfirm({ message: UNPUBLISH_WARNING, confirmLabel: 'CONTINUA', onConfirm: save });
            return;
        }
        save();
    });

    function requestClose() {
        if (!isDirty()) { close(); return; }
        openConfirm({ message: 'Chiudere senza salvare?', confirmLabel: 'CHIUDI', onConfirm: close });
    }
    overlay.querySelector('[data-cancel]').addEventListener('click', requestClose);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) requestClose(); });

    return { close };
}
