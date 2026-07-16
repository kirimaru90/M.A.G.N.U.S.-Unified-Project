import { esc } from '../engine/render.js';
import { getCampaignMap } from '../api/campaign-map.js';
import * as L from '../vendor/leaflet/leaflet.esm.js';
import {
    ancestors,
    chain,
    effectiveRadius,
    viewportRadius,
    visible,
} from './map-geometry.js';

// The MAPPA tab. Follows the notes.js pattern: render synchronously, paint a
// skeleton, fill in when its own fetch resolves. A failed fetch degrades to an
// empty map — getCampaignMap already swallows the error — so the tab shows an
// empty state and the sheet stays usable.
//
// No visibility filtering happens here. The API strips non-public places and
// their whole subtree before they reach the wire; the client renders what it is
// given. Filtering client-side would put the GM's secrets in the network tab.

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png';

/**
 * Five seconds is the OSM Foundation's Attribution Guidelines' own figure for
 * auto-collapsing attribution ("automatically after five seconds"), and taking
 * that mechanism verbatim is what makes omitting a permanent watermark
 * permissible. It is not a taste call. Read design.md before changing it.
 *
 * The override exists only so the Playwright spec need not wait five real
 * seconds; nothing in the app sets it.
 */
export const ATTRIBUTION_COLLAPSE_MS = 5000;
const attributionDelay = () =>
    Number(globalThis.__PB_MAP_ATTRIBUTION_MS__ ?? ATTRIBUTION_COLLAPSE_MS);

// Both directions share this curve, and it is NOT mirrored on the way out. The
// exact time-reverse of an ease-out is an ease-in, which relocates the curve's
// imperceptible tail to the *front* of the exit — measured at 460 ms before the
// first visible movement, against 7 ms entering. Same duration, and it read as
// broken. See design.md.
const BLOOM_MS = 800;
const BLOOM_EASE = 'cubic-bezier(.16, 1, .3, 1)';
const FADE_MS = 400;

const ROOT_LABEL = 'MAPPA';

// Inline SVG, keyed by name — the app's existing convention. Resolved at render
// (`place.icon ?? type default`) and never copied onto a place, so retyping a
// place or changing a type's default updates every place that never overrode it.
const ICONS = {
    region: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 3 8l9 5 9-5-9-5z"/><path d="M3 16l9 5 9-5"/><path d="M3 12l9 5 9-5"/></svg>',
    settlement: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h18"/><path d="M5 21V8l7-5 7 5v13"/><path d="M10 21v-6h4v6"/></svg>',
    vault: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/></svg>',
    building: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/></svg>',
    room: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16"/><path d="M15 12h.01"/></svg>',
    landmark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3 6 6 .9-4.5 4.2 1.2 6.4L12 16.5 6.3 19.5l1.2-6.4L3 8.9 9 8z"/></svg>',
    poi: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.3-7-11a7 7 0 1 1 14 0c0 4.7-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
};

/** Mirrors PLACE_TYPE_OPTIONS[].defaultIcon in the CMS. */
const TYPE_DEFAULT_ICON = {
    region: 'region',
    settlement: 'settlement',
    vault: 'vault',
    building: 'building',
    room: 'room',
    landmark: 'landmark',
    poi: 'poi',
};

/** An unknown key falls back to the type's default rather than rendering nothing. */
function iconFor(place) {
    if (place.icon && ICONS[place.icon]) return ICONS[place.icon];
    return ICONS[TYPE_DEFAULT_ICON[place.type]] ?? ICONS.poi;
}

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
    const { campaignId } = ctx;

    if (currentMap) {
        currentMap.remove();
        currentMap = null;
        publishForTests(null);
    }

    container.innerHTML = `
        <div class="pb-map-screen">
            <div class="pb-map-zone" data-map-zone>
                <span class="pb-map-chain"><bdi>${ROOT_LABEL}</bdi></span>
            </div>
            <div class="pb-map-canvas" data-map-canvas data-pb-no-swipe>
                <div class="pb-label pb-map-skeleton" data-map-skeleton>Caricamento mappa…</div>
            </div>
        </div>
    `;

    const canvas = container.querySelector('[data-map-canvas]');
    const zoneEl = container.querySelector('[data-map-zone]');

    getCampaignMap(campaignId).then((map) => {
        // The tab may have been left while the fetch was in flight.
        if (!container.isConnected || !canvas.isConnected) return;
        canvas.querySelector('[data-map-skeleton]')?.remove();
        mountMap(canvas, zoneEl, map);
    });
}

function mountMap(canvas, zoneEl, { config, places }) {
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
        zoomControl: false,
        // Disabling the control also drops Leaflet's own "Leaflet" prefix. Its
        // BSD-2 licence wants the notice in the source, which the vendored copy
        // keeps verbatim — not on screen. The basemap attribution is instead the
        // five-second line below, plus the permanent CREDITI view.
        attributionControl: false,
    });
    currentMap = map;
    publishForTests(map);

    L.tileLayer(TILE_URL, { minZoom: config.minZoom, maxZoom: config.maxZoom }).addTo(map);

    showAttribution(canvas);

    const radii = effectiveRadius(places);
    const markers = new Map();

    const vrNow = (zoom = map.getZoom(), centre = map.getCenter()) => {
        const size = map.getSize();
        return viewportRadius({ width: size.x, height: size.y }, zoom, centre.lat);
    };

    /** The set of slugs visible at a given viewport radius. */
    const visibleSet = (vr) => new Set(visible(places, vr, radii).map((p) => p.slug));

    function addMarker(place) {
        const marker = L.marker([place.lat, place.lng], {
            icon: L.divIcon({
                className: `pb-map-marker pb-map-marker--${place.type}`,
                // divIcon anchors at iconSize/2 by applying its own negative
                // margin. Adding another in CSS doubles it and puts every marker
                // half its size up-and-left of its actual coordinate.
                iconSize: [26, 26],
                html: `<span class="pb-map-marker-inner">${iconFor(place)}<span class="pb-map-marker-label">${esc(place.name)}</span></span>`,
            }),
            keyboard: false,
        });
        marker.addTo(map);
        markers.set(place.slug, marker);
        return marker;
    }

    function removeMarker(slug) {
        markers.get(slug)?.remove();
        markers.delete(slug);
    }

    /**
     * Reconcile by difference — never rebuild. An icon can only fly out of a
     * zone if it survives the redraw, and a rebuilt set also closes every popup
     * on every pan.
     */
    function syncMarkers(vr) {
        const wanted = visibleSet(vr);
        for (const slug of [...markers.keys()]) {
            if (!wanted.has(slug)) removeMarker(slug);
        }
        for (const place of places) {
            if (!wanted.has(place.slug) || markers.has(place.slug)) continue;
            addMarker(place);
        }
    }

    function renderZone(vr = vrNow(), centre = map.getCenter()) {
        const line = chain(places, { lat: centre.lat, lng: centre.lng }, vr, radii);
        if (line.length === 0) {
            zoneEl.innerHTML = `<span class="pb-map-chain"><bdi>${ROOT_LABEL}</bdi></span>`;
            return;
        }
        // Truncation is left-side (see pipboy.css): where you are matters more
        // than distant ancestry, so the deepest entries survive.
        const parts = line.map((p, i) =>
            i === line.length - 1
                ? `<b class="pb-map-chain-here">${esc(p.name)}</b>`
                : esc(p.name),
        );
        zoneEl.innerHTML = `<span class="pb-map-chain"><bdi>${parts.join(' › ')}</bdi></span>`;
    }

    /**
     * The one Leaflet internal this file touches.
     *
     * Leaflet snapshots its `zoomanim` listener list before dispatching, so a
     * marker added *during* the event never receives it and would sit at the
     * pre-zoom projection until `zoomend` — then jump. Marker._animateZoom is
     * exactly the method Leaflet would have called, so delegating to it keeps
     * one code path rather than reimplementing its projection math.
     *
     * A supported alternative was looked for and does not exist: the public
     * `map.project(latlng, zoom)` cannot produce a layer point without the map
     * pane's in-flight translate offset, which Leaflet exposes only as
     * `_getMapPanePos()`. Deferring the whole bloom to `zoomend` would avoid
     * this, but the spec requires the animation to run *alongside* the zoom.
     */
    function positionForPendingZoom(marker, zoom, centre) {
        marker._animateZoom?.({ zoom, center: centre });
    }

    /** Offsets are projected at the destination zoom — see design.md. */
    const deltaAt = (fromLatLng, toLatLng, zoom) =>
        map.project(fromLatLng, zoom).subtract(map.project(toLatLng, zoom));

    /**
     * The deepest ancestor of `place` that is in `set` — the icon a child should
     * fly out of. One zoom step can cross several tiers at once, so the literal
     * parent may never have been on screen; blooming out of it would mean
     * blooming out of an empty patch of map.
     */
    function nearestVisibleAncestor(place, set) {
        for (const a of ancestors(places, place.slug)) {
            if (set.has(a.slug)) return a;
        }
        return null;
    }

    // Leaflet positions a marker with its own `transform: translate3d(...)` on
    // the icon element, so the bloom rides on a nested element instead of
    // fighting it for the same property.
    const inner = (el) => el.querySelector('.pb-map-marker-inner');
    const TRANSITION = `transform ${BLOOM_MS}ms ${BLOOM_EASE}, opacity ${FADE_MS}ms ${BLOOM_EASE}`;

    /** Springs out of `delta` (the source's offset) to its own position. */
    function bloomIn(el, delta) {
        const box = inner(el);
        if (!box) return;
        box.style.transition = 'none';
        box.style.transform = `translate(${delta.x}px, ${delta.y}px)`;
        box.style.opacity = '0';
        // Two frames: the first commits the start state, the second starts the
        // transition. One frame is not reliably enough for the style to land.
        requestAnimationFrame(() => requestAnimationFrame(() => {
            box.style.transition = TRANSITION;
            box.style.transform = 'translate(0px, 0px)';
            box.style.opacity = '1';
        }));
    }

    /** Collapses into `delta` (the target ancestor's offset), then is removed. */
    function collapseInto(el, delta) {
        const box = inner(el);
        if (!box) return;
        box.style.transition = 'none';
        box.style.transform = 'translate(0px, 0px)';
        box.style.opacity = '1';
        requestAnimationFrame(() => requestAnimationFrame(() => {
            box.style.transition = TRANSITION;
            box.style.transform = `translate(${delta.x}px, ${delta.y}px)`;
            box.style.opacity = '0';
        }));
    }

    map.on('zoomanim', (e) => {
        // Computed against the *destination* zoom, so bloom and collapse run
        // alongside the map's own zoom rather than after it.
        const vrNext = vrNow(e.zoom, e.center);
        const before = new Set(markers.keys());
        const after = visibleSet(vrNext);

        for (const place of places) {
            const wasVisible = before.has(place.slug);
            const willBeVisible = after.has(place.slug);
            if (wasVisible === willBeVisible) continue;

            if (willBeVisible) {
                // Blooming out: from the deepest ancestor that was on screen.
                const source = nearestVisibleAncestor(place, before);
                const marker = addMarker(place);
                positionForPendingZoom(marker, e.zoom, e.center);
                const el = marker.getElement();
                if (!el || !source) continue;
                bloomIn(el, deltaAt(source, place, e.zoom));
            } else {
                // Collapsing in: into the deepest ancestor that will be on screen.
                const target = nearestVisibleAncestor(place, after);
                const marker = markers.get(place.slug);
                const el = marker?.getElement();
                // Dropped from the live set now so syncMarkers cannot re-add it
                // mid-flight, but kept in the DOM until the animation ends.
                markers.delete(place.slug);
                if (!el || !target) {
                    marker?.remove();
                    continue;
                }
                positionForPendingZoom(marker, e.zoom, e.center);
                collapseInto(el, deltaAt(target, place, e.zoom));
                setTimeout(() => marker.remove(), BLOOM_MS);
            }
        }
        renderZone(vrNext, e.center);
    });

    // Panning changes DENTRO but never APERTA, so it moves the breadcrumb and
    // animates nothing.
    map.on('move', () => renderZone());
    map.on('zoomend', () => {
        syncMarkers(vrNow());
        renderZone();
    });

    syncMarkers(vrNow());
    renderZone();

    // The pane has no size until the tab is laid out.
    requestAnimationFrame(() => map.invalidateSize());

    return map;
}

/**
 * The basemap attribution, shown on entering the tab and collapsing on its own.
 * `pointer-events: none` (see pipboy.css) so it never intercepts a pan, and it
 * is created once per visit so it does not reappear on every pan or zoom.
 */
function showAttribution(canvas) {
    const line = document.createElement('div');
    line.className = 'pb-map-attr';
    line.setAttribute('data-map-attr', '');
    line.textContent = '© OpenStreetMap · © CARTO';
    canvas.appendChild(line);
    setTimeout(() => line.remove(), attributionDelay());
}
