import { getPrefs, setPref } from '../state/prefs.js';
import { applyOrientation, requestWakeLock, releaseWakeLock } from './device.js';

// The device-preferences popup. Chrome-level — it is opened from the status bar,
// it outlives any screen, and it is not a sheet tab — so it sits beside chrome.js
// rather than in src/tabs/. Like add-popup.js it mounts on document.body, which
// is what makes it safe against the `#app` innerHTML wipe on every screen mount,
// and it reuses that popup's overlay/box/close CSS and the pb-toggle-row
// pick-one treatment so it looks native to the app for free.
//
// It does NOT build on openAddPopup: that function's contract is catalog tab +
// custom tab + OK-assembles-an-item-and-hands-it-to-a-callback. Settings have no
// catalog, no item and no OK, so the shared surface is the CSS, not the behaviour.
//
// There is no OK and no cancel by design: a preference has no cancel semantics,
// and orientation must apply while the popup is open, because seeing it happen is
// the whole way a user judges "do I want landscape?".

const ROWS = [
    {
        key: 'orientation',
        label: 'ORIENTAMENTO',
        options: [
            { value: 'auto', label: 'AUTO' },
            { value: 'portrait', label: 'VERTICALE' },
            { value: 'landscape', label: 'ORIZZONTALE' },
        ],
        // Persisted even when the lock rejects (the browser-tab case), so it
        // takes effect on the first installed launch.
        apply: (value) => { setPref('orientation', value); void applyOrientation(value); },
        isActive: (prefs, value) => prefs.orientation === value,
    },
    {
        key: 'vibration',
        label: 'VIBRAZIONE',
        options: [{ value: 'on', label: 'ON' }, { value: 'off', label: 'OFF' }],
        apply: (value) => setPref('vibration', value === 'on'),
        isActive: (prefs, value) => prefs.vibration === (value === 'on'),
    },
    {
        key: 'wakeLock',
        label: 'SCHERMO SEMPRE ATTIVO',
        options: [{ value: 'on', label: 'ON' }, { value: 'off', label: 'OFF' }],
        // Acts immediately rather than at the next sheet mount. The popup is
        // sheet-only, so a mounted sheet is the only context this runs in.
        apply: (value) => {
            const on = value === 'on';
            setPref('wakeLock', on);
            void (on ? requestWakeLock() : releaseWakeLock());
        },
        isActive: (prefs, value) => prefs.wakeLock === (value === 'on'),
    },
    {
        key: 'audio',
        label: 'AUDIO',
        // The app ships no audio. A live toggle that provably does nothing would
        // read as a defect, so the row is disabled and marked N/D: it reserves
        // the position and states the absence rather than faking the feature.
        disabled: true,
        options: [{ value: 'on', label: 'ON' }, { value: 'off', label: 'OFF' }],
        isActive: () => false,
    },
];

/**
 * The credits view. This is where the app discharges the other half of its
 * basemap licence obligation: the map tab shows attribution for five seconds and
 * then collapses it, which the OSM Foundation's Attribution Guidelines permit
 * only if the licence information stays findable — "for example ... an 'About'
 * option in a menu". This is that menu option. It is not decoration.
 *
 * Leaflet is named as a courtesy rather than an obligation: its BSD-2 notice
 * lives in the vendored source, but the app suppresses its on-screen prefix, so
 * this becomes the only place it is acknowledged.
 *
 * An action, not a preference: it touches nothing in prefs.js and persists
 * nothing.
 */
function openCreditsPopup() {
    const overlay = document.createElement('div');
    overlay.className = 'pb-popup-overlay';
    overlay.innerHTML = `
        <div class="pb-popup" role="dialog" aria-modal="true" id="pb-credits-popup">
            <button class="pb-popup-close" data-close aria-label="Chiudi">✕</button>
            <div class="pb-popup-title">CREDITI</div>
            <div class="pb-popup-body">
                <div class="pb-credits-block">
                    <div class="pb-label">CARTOGRAFIA</div>
                    <p class="pb-credits-text">
                        Dati cartografici © <b>OpenStreetMap</b>, disponibili con licenza ODbL.
                    </p>
                    <p class="pb-credits-text">
                        Mappe di base © <b>CARTO</b>.
                    </p>
                </div>
                <div class="pb-credits-block">
                    <div class="pb-label">LIBRERIE</div>
                    <p class="pb-credits-text">
                        Mappe interattive con <b>Leaflet</b> — © Vladimir Agafonkin,
                        © CloudMade. Licenza BSD-2-Clause.
                    </p>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    // Dismissing returns to the settings popup, which is still mounted beneath.
    const close = () => overlay.remove();
    overlay.querySelector('[data-close]').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
}

// The shell cache is named `pipboy-<BUILD_ID>` by sw.js, stamped from the
// deployed commit at image-build time. Reading the cache name back is how the app
// learns which build it is running without a second source of truth. A local dev
// build (or a browser with no Cache Storage) has no stamped id, shown as such.
const TILE_CACHE_NAME = 'pipboy-tiles-v1';

async function readBuildId() {
    try {
        if (!('caches' in self)) return 'sviluppo';
        const keys = await caches.keys();
        const shell = keys.find((k) => k.startsWith('pipboy-') && k !== TILE_CACHE_NAME);
        const id = shell ? shell.replace(/^pipboy-/, '') : '';
        // The untouched placeholder means the build never had an id stamped in.
        return !id || id === '__BUILD_ID__' ? 'sviluppo' : id;
    } catch (_) {
        return 'sviluppo';
    }
}

/**
 * Check for a newer deploy and, if one is found, reload onto it. The pip-boy is a
 * PWA whose shell is served cache-first, so a player keeps running the cached
 * build until a new service worker installs and takes control — this button is
 * the manual trigger for that. `controllerchange` fires when the fresh worker
 * claims the page, which is the moment a reload will serve the new code.
 */
async function checkForUpdate(btn) {
    if (!('serviceWorker' in navigator)) {
        btn.textContent = 'NON DISPONIBILE';
        return;
    }
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'RICERCA…';

    const restore = () => {
        btn.textContent = original;
        btn.disabled = false;
    };

    try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) {
            // No worker registered yet — a plain reload fetches the latest shell.
            self.location.reload();
            return;
        }

        let reloaded = false;
        const reloadOnce = () => {
            if (reloaded) return;
            reloaded = true;
            self.location.reload();
        };
        navigator.serviceWorker.addEventListener('controllerchange', reloadOnce);

        await reg.update();
        const incoming = reg.installing || reg.waiting;
        if (!incoming) {
            navigator.serviceWorker.removeEventListener('controllerchange', reloadOnce);
            btn.textContent = 'GIÀ AGGIORNATO';
            setTimeout(restore, 2500);
            return;
        }
        // A new worker is installing; nudge it to activate immediately (sw.js also
        // skips waiting on install, so this is belt-and-braces). controllerchange
        // then reloads onto it.
        btn.textContent = 'AGGIORNAMENTO…';
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    } catch (_) {
        btn.textContent = 'ERRORE';
        setTimeout(restore, 2500);
    }
}

export function openSettingsPopup() {
    const prefs = getPrefs();

    const overlay = document.createElement('div');
    overlay.className = 'pb-popup-overlay';
    overlay.innerHTML = `
        <div class="pb-popup" role="dialog" aria-modal="true" id="pb-settings-popup">
            <button class="pb-popup-close" data-close aria-label="Chiudi">✕</button>
            <div class="pb-popup-title">IMPOSTAZIONI</div>
            <div class="pb-popup-body">
                ${ROWS.map((row) => `
                    <div class="pb-settings-row${row.disabled ? ' pb-settings-row--disabled' : ''}" data-row="${row.key}">
                        <div class="pb-split-row">
                            <span class="pb-label">${row.label}</span>
                            ${row.disabled ? '<span class="pb-settings-na">N/D</span>' : ''}
                        </div>
                        <div class="pb-toggle-row">
                            ${row.options.map((opt) => `
                                <button class="pb-btn pb-toggle${row.isActive(prefs, opt.value) ? ' active' : ''}"
                                        data-value="${opt.value}" ${row.disabled ? 'disabled' : ''}>${opt.label}</button>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
                <button class="pb-btn pb-settings-action" data-credits>CREDITI</button>
                <div class="pb-settings-version" data-version-block>
                    <div class="pb-split-row">
                        <span class="pb-label">VERSIONE</span>
                        <span class="pb-settings-version-value" data-version>…</span>
                    </div>
                    <button class="pb-btn pb-settings-action" data-update>CERCA AGGIORNAMENTI</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('[data-close]').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('[data-credits]').addEventListener('click', openCreditsPopup);

    // The build id is read from the shell cache name asynchronously; fill it in
    // once resolved, guarding against the popup having been closed meanwhile.
    const versionEl = overlay.querySelector('[data-version]');
    void readBuildId().then((id) => {
        if (versionEl.isConnected) versionEl.textContent = id;
    });
    overlay.querySelector('[data-update]').addEventListener('click', (e) => {
        void checkForUpdate(e.currentTarget);
    });

    for (const row of ROWS) {
        if (row.disabled) continue;
        const rowEl = overlay.querySelector(`[data-row="${row.key}"]`);
        rowEl.querySelectorAll('[data-value]').forEach((btn) => {
            btn.addEventListener('click', () => {
                row.apply(btn.dataset.value);
                // Pick-one: the tapped option becomes the sole active one. Closing
                // never reverts this — the write already happened.
                rowEl.querySelectorAll('[data-value]').forEach((b) => b.classList.toggle('active', b === btn));
            });
        });
    }
}
