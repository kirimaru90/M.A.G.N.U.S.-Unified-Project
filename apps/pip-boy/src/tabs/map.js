import { esc } from '../engine/render.js';
import { getCampaignMap } from '../api/campaign-map.js';
import { getCharacterCodex } from '../api/codex.js';
import * as L from '../vendor/leaflet/leaflet.esm.js';
import {
    chain,
    containZoom,
    effectiveMinZoom,
    effectiveRadius,
    kids,
    revealZoom,
    viewportRadius,
} from '../shared/map-core/geometry.js';
import { createMarkerLayer } from '../shared/map-core/marker-layer.js';
import { createTintedTileLayer } from '../shared/map-core/tint-tiles.js';
import { currentPhosphorRgb } from '../engine/theme.js';
import { pushBackStep } from '../engine/back.js';
import { ATTRIBUTION_COLLAPSE_MS, ATTRIBUTION_HTML, tileUrl } from './basemap.js';

// The MAPPA tab. Follows the notes.js pattern: render synchronously, paint a
// skeleton, fill in when its own fetch resolves. A failed fetch degrades to an
// empty map — getCampaignMap already swallows the error — so the tab shows an
// empty state and the sheet stays usable.
//
// No visibility filtering happens here. The API strips non-public places and
// their whole subtree before they reach the wire; the client renders what it is
// given. Filtering client-side would put the GM's secrets in the network tab.

/**
 * The attribution's lifetime: ATTRIBUTION_COLLAPSE_MS in basemap.js decides
 * (null = permanent, the CARTO-compliant default). The override exists only so
 * the Playwright spec can exercise both modes and need not wait real seconds;
 * nothing in the app sets it. `null` is a legitimate override value, so the
 * check is `in`, not `??`.
 */
const attributionDelay = () =>
    ('__PB_MAP_ATTRIBUTION_MS__' in globalThis ? globalThis.__PB_MAP_ATTRIBUTION_MS__ : ATTRIBUTION_COLLAPSE_MS);

/**
 * The budget (ms) after which a mode toggle revalidates the map size when no
 * size-driving `transitionend` fires. Entering/leaving immersive is an instant
 * flex reflow — the CSS transition (see pipboy.css) is a non-size flourish — so
 * this timeout is what actually drives `invalidateSize` against the final size,
 * matching design.md Decision 4's fallback branch. The override exists only so
 * the Playwright spec need not wait it out; nothing in the app sets it.
 */
export const IMMERSIVE_TRANSITION_MS = 220;
const immersiveDelay = () =>
    Number(globalThis.__PB_MAP_IMMERSIVE_MS__ ?? IMMERSIVE_TRANSITION_MS);

// The corner-cluster icons for the immersive toggle: arrows out to enter
// full-screen, arrows in to leave. Swapped by updateImmersiveControl.
const FS_EXPAND_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
const FS_COLLAPSE_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';

// Shown only when the centre is inside no open place — never beside a named
// level (renderZone returns early with it, or omits it entirely).
const ROOT_LABEL = 'Terre contaminate';

// The breadcrumb shows at most the three deepest open levels; a deeper chain
// leads with this elision marker to signal the omitted ancestry.
const CHAIN_MAX = 3;
const CHAIN_ELISION = '…';

/** Mirrors PLACE_TYPE_OPTIONS[].label in the CMS — the popup's type line. */
const TYPE_LABEL = {
    region: 'Regione',
    settlement: 'Insediamento',
    vault: 'Vault',
    building: 'Edificio',
    room: 'Stanza',
    landmark: 'Punto di riferimento',
    poi: 'Punto di interesse',
};

// A tab re-render replaces the container's innerHTML, which orphans the previous
// L.Map and leaves its window listeners attached. Track and dispose it.
let currentMap = null;

/**
 * The live map instance, published for the Playwright suite: with no bundler
 * there is no other way for a spec to reach it, and driving zoom through
 * synthetic wheel events cannot land on an exact zoom level — which is the whole
 * variable the level-of-detail rules turn on. Same seam convention as
 * `__PB_DICE_RANDOM__` and `__PB_DEVICE__`. Nothing in the app reads it.
 */
function publishForTests(map) {
    globalThis.__PB_MAP__ = map;
}

export function renderMapTab(container, ctx = {}) {
    const { campaignId, character, canEdit, setImmersive, isImmersive, goToCodex, focusPlaceSlug } = ctx;

    if (currentMap) {
        currentMap.remove();
        currentMap = null;
        publishForTests(null);
    }

    // The breadcrumb is a floating overlay *inside* the canvas (like the search
    // and attribution controls), not a reserved row above it — so it survives
    // into immersive mode without costing vertical space, and serves both modes
    // with one code path (design.md Decision 3). renderZone still writes into the
    // same `[data-map-zone]` element; only its placement/CSS changed.
    container.innerHTML = `
        <div class="pb-map-screen">
            <div class="pb-map-canvas" data-map-canvas data-pb-no-swipe>
                <div class="pb-map-zone" data-map-zone>
                    <span class="pb-map-chain"><bdi>${ROOT_LABEL}</bdi></span>
                </div>
                <div class="pb-label pb-map-skeleton" data-map-skeleton>Caricamento mappa…</div>
            </div>
        </div>
    `;

    const canvas = container.querySelector('[data-map-canvas]');
    const zoneEl = container.querySelector('[data-map-zone]');

    // The ids of the codex entries this character sees, fetched once per mount
    // alongside the map: a place's CODEX action shows only for one of them. Any
    // failure (or a viewer who cannot read the codex) just leaves CODEX out.
    const codexIds = canEdit && character
        ? getCharacterCodex(campaignId, character.id)
            .then((entries) => new Set((entries ?? []).map((e) => e.id)))
            .catch(() => new Set())
        : Promise.resolve(new Set());

    Promise.all([getCampaignMap(campaignId), codexIds]).then(([map, visibleCodex]) => {
        // The tab may have been left while the fetch was in flight.
        if (!container.isConnected || !canvas.isConnected) return;
        canvas.querySelector('[data-map-skeleton]')?.remove();
        mountMap(canvas, zoneEl, map, {
            setImmersive,
            isImmersive,
            visibleCodex,
            goToCodex,
            focusSlug: focusPlaceSlug,
        });
    });
}

function mountMap(canvas, zoneEl, { config, places }, hooks = {}) {
    const { setImmersive, isImmersive, visibleCodex = new Set(), goToCodex, focusSlug } = hooks;
    const bounds = L.latLngBounds(
        [config.bounds.south, config.bounds.west],
        [config.bounds.north, config.bounds.east],
    );

    const map = L.map(canvas, {
        center: [config.startLat, config.startLng],
        zoom: config.startZoom,
        minZoom: config.minZoom,
        maxZoom: config.maxZoom,
        maxBounds: bounds,
        maxBoundsViscosity: 1,
        // focusPlace / Vedi mappa jump to whole zoom levels (containZoom rounds
        // *up* to the level that opens the place). Raise the animation threshold
        // past the campaign's whole zoom span so even a multi-level jump animates
        // rather than snapping instantly — a tap always eases to its target.
        zoomAnimationThreshold: config.maxZoom - config.minZoom + 1,
        zoomControl: false,
        // Disabling the control also drops Leaflet's own "Leaflet" prefix. Its
        // BSD-2 licence wants the notice in the source, which the vendored copy
        // keeps verbatim — not on screen. The basemap attribution is instead our
        // own phosphor-styled line below, plus the always-reachable CREDITI view.
        attributionControl: false,
    });
    currentMap = map;
    publishForTests(map);

    // Each tile is tinted once, when it loads, in the theme's colour: zooming
    // then only moves finished bitmaps. A theme change repaints them in place.
    const tiles = createTintedTileLayer(L, tileUrl(), {
        tint: currentPhosphorRgb(),
        createWorker: () => new Worker(new URL('../shared/map-core/tint-worker.js', import.meta.url), { type: 'module' }),
        minZoom: config.minZoom,
        maxZoom: config.maxZoom,
    }).addTo(map);
    const onPhosphorChange = (e) => tiles.setTint(e.detail.rgb);
    document.addEventListener('pb-phosphor-change', onPhosphorChange);
    map.on('unload', () => document.removeEventListener('pb-phosphor-change', onPhosphorChange));

    showAttribution(canvas);

    const radii = effectiveRadius(places);

    const vrNow = (zoom = map.getZoom(), centre = map.getCenter()) => {
        const size = map.getSize();
        return viewportRadius({ width: size.x, height: size.y }, zoom, centre.lat);
    };

    const viewportPxNow = () => {
        const size = map.getSize();
        return { width: size.x, height: size.y };
    };

    /**
     * The zoom range derived zooms clamp to: the live floor (raised to the
     * bounds by applyZoomFloor), not the raw config minimum.
     */
    const zoomRangeNow = () => ({ minZoom: map.getMinZoom(), maxZoom: config.maxZoom });

    /**
     * The whole-level zoom at which the bounds fit the canvas, or NaN before the
     * canvas has a size. Leaflet's own getBoundsZoom clamps to the *current* min
     * zoom, so once the floor is raised it could never come back down when the
     * canvas shrinks; this is the same formula without that clamp, including its
     * 1% snap tolerance.
     */
    function boundsZoomNow() {
        const size = map.getSize();
        if (!size.x || !size.y) return NaN;
        const z = map.getZoom();
        const span = map.project(bounds.getSouthEast(), z).subtract(map.project(bounds.getNorthWest(), z));
        const exact = map.getScaleZoom(Math.min(size.x / span.x, size.y / span.y), z);
        return Math.floor(Math.round(exact * 100) / 100);
    }

    /**
     * maxBounds resists panning but not zooming out, so the floor is raised to
     * the zoom at which the bounds fill the canvas. Leaflet raises a current zoom
     * below the new floor itself. Re-run whenever the canvas changes size.
     */
    function applyZoomFloor() {
        const floor = effectiveMinZoom(config.minZoom, config.maxZoom, boundsZoomNow());
        if (floor !== map.getMinZoom()) map.setMinZoom(floor);
    }

    // The place a focus (tap, search, codex MAPPA) targeted, placed ahead of the
    // declutter's priority while its popup is open. Set before setView so the
    // transition's plan already honours it.
    let focusedSlug = null;

    // True from zoomstart to zoomend. A popup closing mid-transition (its
    // marker collapsing) must not re-plan at the zoom being left. Registered
    // before the marker layer, so the flag is down by the time its zoomend
    // re-plans.
    let zooming = false;
    map.on('zoomstart', () => { zooming = true; });
    map.on('zoomend', () => { zooming = false; });

    // Level of detail, declutter, labels, the +N badge and bloom/collapse are
    // the shared marker layer's (apps/packages/map-core). The popup is this
    // tab's: bound to each new marker, rebuilt when its "Nelle vicinanze" changes.
    //
    // forceFocused is off: unlike the CMS's selected place, a focused place here
    // still obeys level of detail. Its marker leaving the set as the place opens
    // is what closes its popup.
    const layer = createMarkerLayer(L, map, {
        places: () => places,
        radii: () => radii,
        focused: () => focusedSlug,
        forceFocused: false,
        zoomRange: zoomRangeNow,
        onAdd(place, marker) {
            // The popup is bound to the marker, so Leaflet's own `remove`
            // handler tears it down when the layer removes the marker — that is
            // what closes it as the place opens. `closeOnClick` closes it on a
            // genuine tap of the empty map: Leaflet fires that via `preclick`,
            // which it suppresses after a drag (so a pan never closes it) and
            // does not fire on wheel/pinch zoom — and the marker and popup body
            // stop it themselves, so only a click *outside* closes it. A pan
            // that carries the place off screen is still handled explicitly on
            // 'moveend' below. autoPan off so opening it never shifts the centre
            // away from the place focusPlace just centred.
            marker.bindPopup(popupContent(place), {
                className: 'pb-map-popup-wrap',
                closeButton: false,
                autoClose: false,
                closeOnClick: true,
                autoPan: false,
            });
            // Drop Leaflet's default click-to-open (it pops at the pre-move
            // position); onClick routes the tap through focusPlace so tap and
            // search share one path.
            marker.off('click');
        },
        onClick: (place) => focusPlace(place, { open: false }),
        onGroupChange: (place, nearby, marker) => marker.setPopupContent(popupContent(place, nearby)),
    });

    /**
     * A marker's popup: the place name, its type, its description, the places
     * the declutter folded into it ("Nelle vicinanze"), and — for a
     * place with a local map (`hasLocalMap` and at least one child) — a
     * *Vedi mappa* action that opens the interior. A place linked to a codex
     * entry the character sees also gets CODEX, which opens that entry. Built as
     * a DOM node so the listeners are wired directly; Leaflet keeps the node.
     */
    function popupContent(place, nearby = []) {
        const canOpen = place.hasLocalMap && kids(places, place.slug).length > 0;
        const codexId = place.codexEntryId && visibleCodex.has(place.codexEntryId) ? place.codexEntryId : null;
        const el = document.createElement('div');
        el.className = 'pb-map-popup';
        el.innerHTML = `
            <div class="pb-map-popup-name">${esc(place.name)}</div>
            <div class="pb-map-popup-type">${esc(TYPE_LABEL[place.type] ?? place.type)}</div>
            ${place.desc ? `<div class="pb-map-popup-desc">${esc(place.desc)}</div>` : ''}
            ${nearby.length ? `<div class="pb-map-popup-near" data-map-near>Nelle vicinanze: ${nearby.map((p) => esc(p.name)).join(', ')}</div>` : ''}
            ${canOpen ? `<button type="button" class="pb-map-popup-open" data-map-open>Vedi mappa</button>` : ''}
            ${codexId ? `<button type="button" class="pb-map-popup-open" data-map-codex>CODEX</button>` : ''}
        `;
        if (canOpen) {
            el.querySelector('[data-map-open]').addEventListener('click', () => {
                focusPlace(place, { open: true });
            });
        }
        if (codexId) {
            el.querySelector('[data-map-codex]').addEventListener('click', () => goToCodex?.(codexId));
        }
        return el;
    }

    // The slug whose popup is currently open, so a pan that carries it off screen
    // can close it (its marker survives the pan — see the 'panning' test — so the
    // popup, not the marker, is what closes). Cleared whenever any popup closes.
    let openSlug = null;

    /**
     * Open the popup for `place`. If its marker exists now, open immediately;
     * otherwise the marker is being created during setView's transition (a hidden
     * place revealed by revealZoom), so defer the open to the transition's end.
     */
    function openPopupFor(place) {
        const open = () => {
            const marker = layer.markerFor(place.slug);
            if (!marker) return;
            marker.openPopup();
            openSlug = place.slug;
        };
        if (layer.markerFor(place.slug)) open();
        else map.once('moveend', open);
    }

    /**
     * The one primitive behind marker taps, *Vedi mappa*, and search. Centre the
     * place and zoom to `containZoom` (its interior fills the view) when `open`,
     * else `revealZoom` (its own marker renders). When opening the interior the
     * place's marker leaves the set and its popup dies with it, so only the
     * non-open path re-opens a popup.
     */
    function focusPlace(place, { open = false } = {}) {
        const zoom = open
            ? containZoom(place, radii, viewportPxNow(), zoomRangeNow())
            : revealZoom(place, places, radii, viewportPxNow(), zoomRangeNow());
        if (!open) {
            // Placed first from here on. Re-plan now: when the target zoom is
            // the current one there is no zoom transition to pick it up, and an
            // absorbed place would never get a marker to open.
            focusedSlug = place.slug;
            layer.sync();
        }
        // Explicit animate so the centre eases in; paired with the map's raised
        // zoomAnimationThreshold it holds even for a big jump (search across the
        // map), rather than teleporting.
        map.setView([place.lat, place.lng], zoom, { animate: true });
        if (!open) openPopupFor(place);
    }

    // A test seam for focusing a place with no rendered marker (a hidden place
    // reached by search, before §5's UI exists): there is no DOM element to
    // click. Same convention as the published `__PB_MAP__`; nothing in the app
    // reads it.
    map.__pbFocus = (slug, opts = {}) => {
        const place = places.find((p) => p.slug === slug);
        if (place) focusPlace(place, opts);
    };

    function renderZone(vr = vrNow(), centre = map.getCenter()) {
        const line = chain(places, { lat: centre.lat, lng: centre.lng }, vr, radii);
        if (line.length === 0) {
            zoneEl.innerHTML = `<span class="pb-map-chain"><bdi>${ROOT_LABEL}</bdi></span>`;
            return;
        }
        // Cap to the three deepest levels; a deeper chain leads with an elision
        // marker. Left-side truncation (see pipboy.css) is the width fallback
        // beyond that: where you are matters more than distant ancestry, so the
        // deepest entries survive.
        const shown = line.slice(-CHAIN_MAX);
        const parts = shown.map((p, i) =>
            i === shown.length - 1
                ? `<b class="pb-map-chain-here">${esc(p.name)}</b>`
                : esc(p.name),
        );
        const prefix = line.length > CHAIN_MAX ? `${CHAIN_ELISION} › ` : '';
        zoneEl.innerHTML = `<span class="pb-map-chain"><bdi>${prefix}${parts.join(' › ')}</bdi></span>`;
    }

    // The breadcrumb follows the destination zoom, alongside the layer's bloom.
    map.on('zoomanim', (e) => renderZone(vrNow(e.zoom, e.center), e.center));

    // Panning changes DENTRO but never APERTA, so it moves the breadcrumb and
    // animates nothing.
    map.on('move', () => renderZone());
    map.on('zoomend', () => renderZone());

    // A window resize (Leaflet's trackResize) or immersive toggle changes the
    // canvas: the floor follows the bounds, and the level of detail follows vr.
    map.on('resize', () => {
        applyZoomFloor();
        layer.sync();
        renderZone();
    });

    // A pan leaves the marker set untouched (APERTA is zoom-only), so an open
    // popup whose place has been carried off the viewport is closed here rather
    // than by removing its marker.
    map.on('moveend', () => {
        if (!openSlug) return;
        const marker = layer.markerFor(openSlug);
        if (!marker) return;
        const p = places.find((q) => q.slug === openSlug);
        if (p && !map.getBounds().contains([p.lat, p.lng])) marker.closePopup();
    });
    map.on('popupclose', () => {
        openSlug = null;
        if (!focusedSlug) return;
        // The focused place loses its priority with its popup. Re-plan at the
        // same zoom — a snap, not an animation — unless a zoom is in flight,
        // whose zoomend re-plans anyway.
        focusedSlug = null;
        if (!zooming) layer.sync();
    });

    // --- immersive (full-screen) mode ---------------------------------------
    // The sheet shell owns the mode (design.md Decision 1); this tab only asks,
    // via the ctx hooks, and manages its own exit affordances — a toggle control
    // and Escape — because immersive hides the first-level tab bar.

    /**
     * The immersive toggle: a sibling of the search lens in the corner cluster.
     * `disableClickPropagation` keeps a tap off the map beneath it, exactly like
     * the search box. Wired to enter/leave via the ctx hooks.
     */
    function mountImmersiveToggle() {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pb-map-fs';
        btn.setAttribute('data-map-fs', '');
        canvas.appendChild(btn);
        L.DomEvent.disableClickPropagation(btn);
        L.DomEvent.disableScrollPropagation(btn);
        btn.addEventListener('click', () => applyImmersive(!immersiveOn()));
        return btn;
    }

    const immersiveOn = () => !!isImmersive?.();

    /** Reflect the current mode on the toggle: glyph, label, pressed state. */
    function updateImmersiveControl(on) {
        if (!fsToggle) return;
        fsToggle.innerHTML = on ? FS_COLLAPSE_ICON : FS_EXPAND_ICON;
        const label = on ? 'Esci da schermo intero' : 'Schermo intero';
        fsToggle.setAttribute('aria-label', label);
        fsToggle.title = label;
        fsToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
    }

    // Escape leaves immersive, but the search box's own Escape (collapse) must
    // win when it is open: that handler lives on the search input and
    // stopPropagation()s, so a keydown from the focused field never reaches this
    // document listener — and the guard below makes it a no-op even if focus is
    // elsewhere while the box is open. Bound only while immersive, torn down on
    // leaving (and on map unload), matching the wake-lock bind/unbind pattern.
    function onImmersiveKeydown(e) {
        if (e.key !== 'Escape') return;
        // Self-heal: if this map was orphaned (the tab/sheet was left without a
        // re-render firing map.remove()), drop the listener rather than acting on
        // a detached shell — the same tolerance the orphaned-Leaflet pattern relies
        // on above.
        if (!canvas.isConnected) { unbindEscape(); return; }
        if (canvas.querySelector('.pb-map-search.is-open')) return;
        if (!immersiveOn()) return;
        e.preventDefault();
        applyImmersive(false);
    }

    let escBound = false;
    function bindEscape() {
        if (escBound) return;
        document.addEventListener('keydown', onImmersiveKeydown);
        escBound = true;
    }
    function unbindEscape() {
        if (!escBound) return;
        document.removeEventListener('keydown', onImmersiveKeydown);
        escBound = false;
    }
    // The system back action leaves immersive too (engine/back.js), ahead of
    // the sheet's "up one level". Registered and dropped alongside Escape, with
    // the same self-heal: an orphaned map declares its step stale (`false`) so
    // back falls through to the next step.
    let disposeBackStep = null;
    function bindBackStep() {
        if (disposeBackStep) return;
        disposeBackStep = pushBackStep(() => {
            disposeBackStep = null;
            if (!canvas.isConnected || !immersiveOn()) return false;
            applyImmersive(false);
        });
    }
    function unbindBackStep() {
        disposeBackStep?.();
        disposeBackStep = null;
    }

    // A stray listener would outlive the map otherwise — Leaflet fires `unload`
    // from map.remove() (the tab's teardown on re-render).
    map.on('unload', () => { unbindEscape(); unbindBackStep(); });

    /**
     * Enter or leave immersive: ask the shell to (un)hide its chrome, bind/unbind
     * Escape and the back step, refresh the control, then revalidate the level
     * of detail against the resized canvas.
     */
    function applyImmersive(on) {
        if (!setImmersive) return;
        setImmersive(on);
        if (on) { bindEscape(); bindBackStep(); } else { unbindEscape(); unbindBackStep(); }
        updateImmersiveControl(on);
        revalidateAfterResize();
    }

    /**
     * After the canvas resizes (design.md Decision 4): re-measure Leaflet, then
     * re-sync the marker set and breadcrumb to the new viewport radius — `vr`
     * grows/shrinks with the canvas, so the visible-place set changes. Run on the
     * canvas's `transitionend` guarded to a size-driving property, with a timeout
     * fallback (the reflow is instant, so in practice the timeout fires) — either
     * way Leaflet measures the *final* size, never an intermediate one.
     */
    function revalidateAfterResize() {
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            canvas.removeEventListener('transitionend', onEnd);
            clearTimeout(timer);
            map.invalidateSize();
            applyZoomFloor();
            layer.sync();
            renderZone();
        };
        const onEnd = (e) => {
            if (e.target === canvas && (e.propertyName === 'width' || e.propertyName === 'height')) {
                finish();
            }
        };
        canvas.addEventListener('transitionend', onEnd);
        const timer = setTimeout(finish, immersiveDelay());
    }

    /**
     * The name-search control: a lens button in a corner of the canvas that
     * toggles an autocomplete field over the received `places`. The index is the
     * received set only — the API already stripped non-public places server-side,
     * so this cannot name a secret the client was never sent (design.md).
     */
    function mountSearch() {
        const box = document.createElement('div');
        box.className = 'pb-map-search';
        box.setAttribute('data-map-search', '');
        box.innerHTML = `
            <button type="button" class="pb-map-search-lens" data-search-lens aria-label="Cerca un luogo">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
            </button>
            <input type="text" class="pb-map-search-input" data-search-input placeholder="Cerca…" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Cerca un luogo">
            <ul class="pb-map-search-list" data-search-list></ul>
        `;
        canvas.appendChild(box);
        // Keep taps/scrolls on the control off the map beneath it — it sits inside
        // the Leaflet container.
        L.DomEvent.disableClickPropagation(box);
        L.DomEvent.disableScrollPropagation(box);

        const lens = box.querySelector('[data-search-lens]');
        const input = box.querySelector('[data-search-input]');
        const list = box.querySelector('[data-search-list]');

        // Case- and accent-insensitive: decompose, drop combining marks, fold case.
        const fold = (s) => [...s.normalize('NFD')].filter((c) => c.charCodeAt(0) < 0x300 || c.charCodeAt(0) > 0x36f).join('').toLowerCase();
        const index = places.map((p) => ({ place: p, key: fold(p.name) }));

        let results = [];
        let active = -1;

        function renderList() {
            list.innerHTML = results
                .map((p, i) =>
                    `<li class="pb-map-search-item${i === active ? ' is-active' : ''}" data-i="${i}"><bdi>${esc(p.name)}</bdi></li>`,
                )
                .join('');
        }

        function search(q) {
            const needle = fold(q).trim();
            if (!needle) return [];
            return index
                .map(({ place, key }) => ({ place, at: key.indexOf(needle) }))
                .filter((r) => r.at !== -1)
                // Earliest match position wins; ties broken by name for stability.
                .sort((a, b) => a.at - b.at || a.place.name.localeCompare(b.place.name))
                .slice(0, 8)
                .map((r) => r.place);
        }

        function collapse() {
            box.classList.remove('is-open');
            input.value = '';
            results = [];
            active = -1;
            renderList();
            // Release focus from the now-hidden field. The input stopPropagation()s
            // every keydown to stay off Leaflet's keyboard panning, so a lingering
            // focus here would also swallow the *next* Escape — which in immersive
            // mode is the one meant to leave full-screen (see map-fullscreen.spec).
            input.blur();
        }

        function commit(place) {
            if (!place) return;
            focusPlace(place, { open: false });
            collapse();
        }

        lens.addEventListener('click', () => {
            if (box.classList.contains('is-open')) collapse();
            else {
                box.classList.add('is-open');
                input.focus();
            }
        });

        input.addEventListener('input', () => {
            results = search(input.value);
            active = results.length ? 0 : -1;
            renderList();
        });

        input.addEventListener('keydown', (e) => {
            // Isolate from Leaflet's own keyboard panning on the container.
            e.stopPropagation();
            if (e.key === 'Escape') {
                collapse();
            } else if (e.key === 'ArrowDown' && results.length) {
                e.preventDefault();
                active = (active + 1) % results.length;
                renderList();
            } else if (e.key === 'ArrowUp' && results.length) {
                e.preventDefault();
                active = (active - 1 + results.length) % results.length;
                renderList();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                commit(results[active] ?? results[0]);
            }
        });

        list.addEventListener('click', (e) => {
            const li = e.target.closest('[data-i]');
            if (li) commit(results[Number(li.dataset.i)]);
        });
    }
    mountSearch();
    const fsToggle = mountImmersiveToggle();

    // If the tab re-mounts while the shell is already immersive (e.g. the editor
    // `✎` toggle in the statusbar — which stays visible in immersive — re-rendered
    // the tab), reflect that on the fresh control and re-bind Escape: the map is
    // new but the mode persisted on the shell. A fresh sheet open resets the mode
    // (sheet.js), so a normal navigation into the tab lands here non-immersive.
    updateImmersiveControl(immersiveOn());
    if (immersiveOn()) { bindEscape(); bindBackStep(); }

    layer.sync();
    renderZone();

    // The pane has no size until the tab is laid out. A one-shot focus intent
    // (the codex's MAPPA) waits for that too: focusPlace measures the viewport.
    requestAnimationFrame(() => {
        map.invalidateSize();
        applyZoomFloor();
        const target = focusSlug ? places.find((p) => p.slug === focusSlug) : null;
        if (target) focusPlace(target, { open: false });
    });

    return map;
}

/**
 * The basemap attribution, mounted inside the canvas so it follows the map into
 * immersive mode. Permanent unless ATTRIBUTION_COLLAPSE_MS (basemap.js) names a
 * positive delay, in which case it is removed once per visit and comes back only
 * on the next one — never on pan or zoom. The line is `pointer-events: none`
 * (see pipboy.css) so only its links take input; a pan beneath it still lands.
 */
function showAttribution(canvas) {
    const line = document.createElement('div');
    line.className = 'pb-map-attr';
    line.setAttribute('data-map-attr', '');
    line.innerHTML = ATTRIBUTION_HTML;
    canvas.appendChild(line);
    const delay = attributionDelay();
    if (typeof delay === 'number' && delay > 0) setTimeout(() => line.remove(), delay);
}
