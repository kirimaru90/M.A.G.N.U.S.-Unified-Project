// GENERATED from apps/packages/map-core/marker-layer.js by scripts/sync-map-core.mjs. Do not edit:
// edit apps/packages/map-core/marker-layer.js, then run `node scripts/sync-map-core.mjs`.

// The marker layer both maps draw places with: level of detail, declutter, the
// label pass, the `+N` badge and the bloom/collapse animation. What a marker
// *does* when tapped (a popup on the Pip-Boy, selection in the CMS) is the
// caller's, through the hooks below.
//
// Leaflet is injected, never imported: the Pip-Boy passes its vendored ESM
// build and the CMS its npm `leaflet`, both 1.9.4.

import { ancestors, declutter, labelPass, separationZoom, viewportRadius, visible } from './geometry.js';
import { iconFor } from './icons.js';

// Both directions share this curve, and it is NOT mirrored on the way out. The
// exact time-reverse of an ease-out is an ease-in, which relocates the curve's
// imperceptible tail to the *front* of the exit — measured at 460 ms before the
// first visible movement, against 7 ms entering. Same duration, and it read as
// broken.
const BLOOM_MS = 800;
const BLOOM_EASE = 'cubic-bezier(.16, 1, .3, 1)';
const FADE_MS = 400;
const TRANSITION = `transform ${BLOOM_MS}ms ${BLOOM_EASE}, opacity ${FADE_MS}ms ${BLOOM_EASE}`;

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

/**
 * Draw `places()` on `map` and keep the markers in line with the zoom.
 *
 *   places, radii    getters, read on every plan
 *   focused          slug placed ahead of every other marker in the declutter
 *   forceFocused     also render it whatever its level of detail (default true)
 *   include          post-LOD filter; default every place
 *   markerClass      extra classes for a place's icon, e.g. 'is-hidden'
 *   markerOptions    extra L.marker options, e.g. { draggable: true }
 *   zoomRange        the range the badge's separation zoom clamps to
 *   onAdd(place, marker)               a marker was created, before it is on the map
 *   onClick(place, marker)             a marker was tapped
 *   onDragEnd(place, latlng)           a draggable marker was dropped
 *   onGroupChange(place, nearby, marker)  the places folded into a marker changed
 *   onBadge(slug, members)             the `+N` badge was tapped; default: separate
 *
 * → { sync(), plan(), markerFor(slug), separate(slug), destroy() }
 */
export function createMarkerLayer(L, map, {
    places,
    radii,
    focused = () => null,
    forceFocused = true,
    include = () => true,
    markerClass = () => '',
    markerOptions = () => ({}),
    zoomRange = () => ({ minZoom: map.getMinZoom(), maxZoom: map.getMaxZoom() }),
    onAdd,
    onClick,
    onDragEnd,
    onGroupChange,
    onBadge,
} = {}) {
    const markers = new Map();
    // What each marker's icon was last built from, so a rename or a visibility
    // change rebuilds the icon and nothing else does.
    const iconKeys = new Map();
    // The absorbed group each marker was last decorated for, so onGroupChange
    // fires only when its membership actually changes.
    const groupKeys = new Map();

    // Label { w, h } per slug, measured once from the rendered label: the font
    // is fixed, so a size never changes. Not measured until the webfont has
    // loaded, so a fallback face can't poison the cache.
    const labelSizes = new Map();
    let fontsReady = false;

    // The plan the marker set currently reflects: the zoom transition reads it
    // for where an absorbed place blooms out of.
    let current = null;
    let zooming = false;
    let destroyed = false;

    const vrAt = (zoom, centre) => {
        const size = map.getSize();
        return viewportRadius({ width: size.x, height: size.y }, zoom, centre.lat);
    };

    /**
     * What renders at `zoom`: the level-of-detail set, narrowed by `include`,
     * with the focused place forced in, decluttered in projected pixels
     * (pan-invariant by construction), then the label pass over what was
     * placed. `shown` iterates in priority order.
     */
    function plan(zoom = map.getZoom(), centre = map.getCenter()) {
        const all = places();
        const r = radii();
        const bySlug = new Map(all.map((p) => [p.slug, p]));
        const f = focused();
        const lod = visible(all, vrAt(zoom, centre), r).filter((p) => p.slug === f || include(p));
        if (forceFocused && f && bySlug.has(f) && !lod.some((p) => p.slug === f)) lod.push(bySlug.get(f));
        const items = lod.map((p) => {
            const pt = map.project([p.lat, p.lng], zoom);
            return { slug: p.slug, type: p.type, name: p.name, radius: r.get(p.slug) ?? 0, x: pt.x, y: pt.y };
        });
        const { placed, absorbedBy, groups } = declutter(items, { focused: f });
        const placedItems = items.filter((i) => placed.has(i.slug));
        return {
            shown: placed,
            absorbedBy,
            groups,
            placedItems,
            labelsHidden: labelPass(placedItems, labelSizes, placed),
            bySlug,
        };
    }

    const iconKey = (place) => [place.type, place.icon ?? '', place.name, markerClass(place)].join('|');

    function buildIcon(place) {
        return L.divIcon({
            className: `pb-map-marker pb-map-marker--${place.type} ${markerClass(place)}`.trim(),
            // divIcon anchors at iconSize/2 by applying its own negative
            // margin. Adding another in CSS doubles it and puts every marker
            // half its size up-and-left of its actual coordinate.
            iconSize: [26, 26],
            html: `<span class="pb-map-marker-inner">${iconFor(place)}<span class="pb-map-marker-label">${esc(place.name)}</span><span class="pb-map-marker-badge" data-map-badge hidden></span></span>`,
        });
    }

    // The badge is part of the icon, so it moves (and blooms) with it. Its tap
    // must not reach the marker: it acts on the group, never on the place.
    function wireBadge(marker, slug) {
        const badge = marker.getElement()?.querySelector('[data-map-badge]');
        if (!badge) return;
        L.DomEvent.on(badge, 'click', (e) => {
            L.DomEvent.stop(e);
            const members = [slug, ...(current?.groups.get(slug) ?? [])];
            if (onBadge) onBadge(slug, members);
            else separate(slug);
        });
    }

    const latest = (slug) => places().find((p) => p.slug === slug);

    function addMarker(place) {
        const { slug } = place;
        const marker = L.marker([place.lat, place.lng], { icon: buildIcon(place), keyboard: false, ...markerOptions(place) });
        onAdd?.(place, marker);
        if (onClick) marker.on('click', () => onClick(latest(slug) ?? place, marker));
        if (onDragEnd) marker.on('dragend', () => onDragEnd(latest(slug) ?? place, marker.getLatLng()));
        marker.addTo(map);
        wireBadge(marker, slug);
        markers.set(slug, marker);
        iconKeys.set(slug, iconKey(place));
        groupKeys.set(slug, '');
        return marker;
    }

    /** An edited place (moved, renamed, retyped) updates its marker in place. */
    function updateMarker(marker, place) {
        const ll = marker.getLatLng();
        if (ll.lat !== place.lat || ll.lng !== place.lng) marker.setLatLng([place.lat, place.lng]);
        const key = iconKey(place);
        if (iconKeys.get(place.slug) === key) return;
        marker.setIcon(buildIcon(place));
        wireBadge(marker, place.slug);
        iconKeys.set(place.slug, key);
        labelSizes.delete(place.slug);
    }

    function removeMarker(slug) {
        markers.get(slug)?.remove();
        markers.delete(slug);
    }

    /**
     * Bring every rendered marker in line with `next` in place — badge, hidden
     * label, group — never by rebuilding it, which would kill its animation and
     * close its popup. Labels first seen here are measured, and the label pass
     * re-run with them, so a static view does not wait for the next zoom.
     */
    function decorate(next) {
        if (fontsReady) {
            let measured = false;
            for (const slug of next.shown) {
                if (labelSizes.has(slug)) continue;
                const label = markers.get(slug)?.getElement()?.querySelector('.pb-map-marker-label');
                if (!label || !label.offsetWidth) continue;
                labelSizes.set(slug, { w: label.offsetWidth, h: label.offsetHeight });
                measured = true;
            }
            if (measured) next.labelsHidden = labelPass(next.placedItems, labelSizes, next.shown);
        }
        for (const slug of next.shown) {
            const marker = markers.get(slug);
            const el = marker?.getElement();
            if (!el) continue;
            const group = next.groups.get(slug) ?? [];
            const badge = el.querySelector('[data-map-badge]');
            if (badge) {
                badge.hidden = group.length === 0;
                badge.textContent = `+${group.length}`;
            }
            el.classList.toggle('is-label-hidden', next.labelsHidden.has(slug));
            const key = group.join(' ');
            if (groupKeys.get(slug) !== key) {
                groupKeys.set(slug, key);
                onGroupChange?.(next.bySlug.get(slug), group.map((s) => next.bySlug.get(s)), marker);
            }
        }
    }

    /**
     * Reconcile by difference — never rebuild. An icon can only fly out of a
     * zone if it survives the redraw, a rebuilt set closes every popup on every
     * pan, and it drops a drag in progress.
     */
    function sync(next = plan()) {
        if (destroyed) return;
        for (const slug of [...markers.keys()]) {
            if (!next.shown.has(slug)) removeMarker(slug);
        }
        for (const place of next.bySlug.values()) {
            if (!next.shown.has(place.slug)) continue;
            const marker = markers.get(place.slug);
            if (marker) updateMarker(marker, place);
            else addMarker(place);
        }
        decorate(next);
        current = next;
    }

    /**
     * The badge's default: centre on the group and zoom to the least level at
     * which its members stop colliding (separationZoom), clamped to the range.
     * A new absorber may appear at that zoom — the badge then shows it, and
     * another tap goes deeper.
     */
    function separate(slug) {
        const all = current?.bySlug ?? new Map(places().map((p) => [p.slug, p]));
        const members = [slug, ...(current?.groups.get(slug) ?? [])]
            .map((s) => all.get(s))
            .filter(Boolean);
        if (members.length < 2) return;
        const zoom = map.getZoom();
        const points = members.map((p) => map.project([p.lat, p.lng], zoom));
        const target = separationZoom(points, zoom, zoomRange());
        const centre = L.latLngBounds(members.map((p) => [p.lat, p.lng])).getCenter();
        map.setView(centre, target, { animate: true });
    }

    /**
     * The one Leaflet internal this layer touches.
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

    /** Offsets are projected at the destination zoom. */
    const deltaAt = (fromLatLng, toLatLng, zoom) =>
        map.project(fromLatLng, zoom).subtract(map.project(toLatLng, zoom));

    /**
     * The deepest ancestor of `place` that is in `set` — the icon a child should
     * fly out of. One zoom step can cross several tiers at once, so the literal
     * parent may never have been on screen; blooming out of it would mean
     * blooming out of an empty patch of map.
     */
    function nearestVisibleAncestor(place, set) {
        for (const a of ancestors(places(), place.slug)) {
            if (set.has(a.slug)) return a;
        }
        return null;
    }

    // Leaflet positions a marker with its own `transform: translate3d(...)` on
    // the icon element, so the bloom rides on a nested element instead of
    // fighting it for the same property.
    const inner = (el) => el.querySelector('.pb-map-marker-inner');

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

    /** Collapses into `delta` (the target's offset), then is removed. */
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

    function onZoomAnim(e) {
        // Computed against the *destination* zoom, so bloom and collapse run
        // alongside the map's own zoom rather than after it.
        const before = new Set(markers.keys());
        const prev = current;
        const next = plan(e.zoom, e.center);
        const after = next.shown;

        for (const place of next.bySlug.values()) {
            const wasVisible = before.has(place.slug);
            const willBeVisible = after.has(place.slug);
            if (wasVisible === willBeVisible) continue;

            if (willBeVisible) {
                // Blooming out: from the marker that had absorbed it, else the
                // deepest ancestor that was on screen.
                const absorber = prev?.absorbedBy.get(place.slug);
                const source = absorber && before.has(absorber)
                    ? next.bySlug.get(absorber)
                    : nearestVisibleAncestor(place, before);
                const marker = addMarker(place);
                positionForPendingZoom(marker, e.zoom, e.center);
                const el = marker.getElement();
                if (!el || !source) continue;
                bloomIn(el, deltaAt(source, place, e.zoom));
            } else {
                // Collapsing in: into the marker absorbing it, else the deepest
                // ancestor that will be on screen.
                const absorber = next.absorbedBy.get(place.slug);
                const target = absorber ? next.bySlug.get(absorber) : nearestVisibleAncestor(place, after);
                const marker = markers.get(place.slug);
                const el = marker?.getElement();
                // Dropped from the live set now so sync cannot re-add it
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
        // A marker that disappeared from `places()` itself (deleted mid-zoom)
        // is not in next.bySlug; drop it here rather than leave it stranded.
        for (const slug of [...markers.keys()]) {
            if (!next.bySlug.has(slug)) removeMarker(slug);
        }
        decorate(next);
        current = next;
    }

    const onZoomStart = () => { zooming = true; };
    const onZoomEnd = () => {
        zooming = false;
        sync();
    };
    const onUnload = () => { destroyed = true; };

    map.on('zoomstart', onZoomStart);
    map.on('zoomanim', onZoomAnim);
    map.on('zoomend', onZoomEnd);
    map.on('unload', onUnload);

    // Labels are measured in the webfont they render in; until it has loaded
    // they are all treated as shown.
    (globalThis.document?.fonts?.ready ?? Promise.resolve()).then(() => {
        fontsReady = true;
        if (!destroyed && !zooming) sync();
    });

    function destroy() {
        map.off('zoomstart', onZoomStart);
        map.off('zoomanim', onZoomAnim);
        map.off('zoomend', onZoomEnd);
        map.off('unload', onUnload);
        for (const slug of [...markers.keys()]) removeMarker(slug);
        destroyed = true;
    }

    return {
        sync,
        plan: () => current,
        markerFor: (slug) => markers.get(slug),
        separate,
        destroy,
    };
}
