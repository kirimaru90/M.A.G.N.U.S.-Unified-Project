// GENERATED from apps/packages/map-core/geometry.js by scripts/sync-map-core.mjs. Do not edit:
// edit apps/packages/map-core/geometry.js, then run `node scripts/sync-map-core.mjs`.

// The map's level-of-detail rules, as pure functions: no DOM, no Leaflet, so
// they are unit-testable without a browser.
//
// `effectiveRadius` here MUST agree with the API's `campaign-map.service.ts`.
// Two implementations, one rule: the API's specs pin it, and this one serves
// both the Pip-Boy (what the circle opens) and the CMS (`place-tree.ts`
// re-exports it to draw the circle). If you change it here, change it in the
// API too or the author sees a lie.

const EARTH_RADIUS_M = 6_371_008.8;

/** A place's authored radius when it has an interior but no explicit one. */
export const DEFAULT_PLACE_RADIUS_M = 250;

/** Great-circle distance in metres. */
export function distanceMetres(a, b) {
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Every place's effective radius, keyed by slug:
 *
 *   R(p) = 0                                            when p.hasLocalMap is false
 *   R(p) = max( p.radius, max over children c of ( dist(p,c) + R(c) ) )
 *
 * Extends over each child's *circle*, not its point — containing a child zone's
 * centre still lets the child poke out of its parent.
 *
 * Seeding the memo with 0 before recursing is what makes a cyclic parent chain
 * terminate rather than recursing without bound.
 */
export function effectiveRadius(places) {
    const bySlug = new Map();
    for (const p of places) bySlug.set(p.slug, p);

    const childrenOf = new Map();
    for (const p of places) {
        if (!p.parent || !bySlug.has(p.parent)) continue;
        const list = childrenOf.get(p.parent);
        if (list) list.push(p);
        else childrenOf.set(p.parent, [p]);
    }

    const memo = new Map();

    const compute = (p) => {
        const cached = memo.get(p.slug);
        if (cached !== undefined) return cached;
        if (!p.hasLocalMap) {
            memo.set(p.slug, 0);
            return 0;
        }
        memo.set(p.slug, 0);
        let r = p.radius ?? DEFAULT_PLACE_RADIUS_M;
        for (const child of childrenOf.get(p.slug) ?? []) {
            r = Math.max(r, distanceMetres(p, child) + compute(child));
        }
        memo.set(p.slug, r);
        return r;
    };

    for (const p of places) compute(p);
    return memo;
}

/**
 * Half the viewport's shorter side, in metres — how much world is on screen.
 *
 * It depends on zoom *and* screen size, so a tablet enters zones slightly later
 * than a phone. That is intended: "does this area fill my view" is a question
 * about the view, which is why there is no single answer to "what zoom does this
 * open at".
 */
export function viewportRadius(sizePx, zoom, lat) {
    const shortSide = Math.min(sizePx.width, sizePx.height);
    // Web Mercator ground resolution at this latitude and zoom.
    const mpp = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
    return (shortSide / 2) * mpp;
}

/** Direct children of `slug`. */
export function kids(places, slug) {
    return places.filter((p) => p.parent === slug);
}

/**
 * APERTA — the viewport fits inside p's circle, so p's children render.
 * Depends on zoom only, never on where the centre is: at a zoom where a zone is
 * open, its children render whether or not you are looking at them.
 *
 * A place with nothing inside it has nothing to open, and a pin has no interior
 * at all — neither ever opens.
 */
export function isOpen(place, vr, radii, places) {
    if (!place.hasLocalMap) return false;
    if (kids(places, place.slug).length === 0) return false;
    return vr <= (radii.get(place.slug) ?? 0);
}

/** DENTRO — the centre lies within p's circle. Depends on position only. */
export function isInside(place, centre, radii) {
    if (!place.hasLocalMap) return false;
    return distanceMetres(centre, place) <= (radii.get(place.slug) ?? 0);
}

/** Ancestors of `slug`, nearest first. Cycle-guarded. */
export function ancestors(places, slug) {
    const bySlug = new Map(places.map((p) => [p.slug, p]));
    const out = [];
    const seen = new Set([slug]);
    let cur = bySlug.get(slug)?.parent;
    while (cur && !seen.has(cur)) {
        const next = bySlug.get(cur);
        if (!next) break;
        out.push(next);
        seen.add(cur);
        cur = next.parent ?? null;
    }
    return out;
}

/**
 * visible(p) = every ancestor of p is APERTA && p is not APERTA
 *
 * Opening a place hides its own marker: its name has moved to the breadcrumb and
 * its children have taken its place, so leaving the icon there is duplication.
 *
 * No visibility filtering happens here. The API ships only what the caller may
 * see; the client renders what it receives.
 */
export function visible(places, vr, radii) {
    const open = (p) => isOpen(p, vr, radii, places);
    return places.filter((p) => {
        if (open(p)) return false;
        return ancestors(places, p.slug).every(open);
    });
}

// The base Web Mercator ground resolution at the equator, zoom 0 — the same
// constant `viewportRadius` uses. The two derived-zoom helpers below are its
// inverse: `viewportRadius` maps zoom → metres-on-screen; these map a target
// metres-on-screen back to the zoom that produces it.
const BASE_RESOLUTION = 156543.03392;

/** Clamp a zoom to the campaign's configured range. */
function clampZoom(zoom, { minZoom, maxZoom }) {
    return Math.min(maxZoom, Math.max(minZoom, zoom));
}

/**
 * The (fractional) zoom at which the viewport radius equals `vr` metres at
 * latitude `lat` — the inverse of `viewportRadius`:
 *
 *   vr = (shortSide / 2) · BASE_RESOLUTION · cos(lat) / 2^zoom
 *   ⇒ zoom = log2( (shortSide / 2) · BASE_RESOLUTION · cos(lat) / vr )
 *
 * As `vr` shrinks the zoom grows, matching that zooming in shows less world. A
 * `vr ≤ 0` target means "as deep as possible" and yields +Infinity, which the
 * callers clamp to `maxZoom`.
 */
function zoomForViewportRadius(vr, viewportPx, lat) {
    const shortSide = Math.min(viewportPx.width, viewportPx.height);
    const mppAt0 = (BASE_RESOLUTION * Math.cos((lat * Math.PI) / 180));
    return Math.log2(((shortSide / 2) * mppAt0) / vr);
}

/**
 * containZoom — the least zoom at which `place` is APERTA: the zoom whose
 * viewport radius just equals `R(place)`, so the place's whole circle fits the
 * viewport. This is what *Vedi mappa* targets. Pure inverse of `viewportRadius`,
 * clamped to `[minZoom, maxZoom]`.
 *
 * The map snaps to whole zoom levels (crisp raster tiles), so this rounds *up*
 * to the least **integer** zoom that opens the place — never down, which would
 * leave it closed ("zoomed in not enough to open"). The `-EPS` keeps a value
 * already essentially on an integer from rounding a whole level too far in.
 *
 * `isOpen` is true at the returned zoom (`vr ≤ R`) and false one integer step
 * further out.
 */
const CONTAIN_EPS = 1e-9;
export function containZoom(place, radii, viewportPx, zoomRange) {
    const R = radii.get(place.slug) ?? 0;
    const exact = zoomForViewportRadius(R, viewportPx, place.lat);
    return clampZoom(Math.ceil(exact - CONTAIN_EPS), zoomRange);
}

/**
 * revealZoom — a zoom at which `place`'s marker renders: every ancestor is
 * APERTA and `place` itself is not. Expressed in `vr`, that is the window
 * `( R(place), R(parent) ]`; by the containment invariant the tightest bound is
 * the smallest ancestor radius. We target the geometric middle of the window so
 * the zoom sits a clean fraction inside both bounds.
 *
 * A top-level place has no ancestor bound, so it targets a `vr` one zoom step
 * larger than `R(place)` and sits closed among nothing.
 */
export function revealZoom(place, places, radii, viewportPx, zoomRange) {
    const R = radii.get(place.slug) ?? 0;
    const ancRadii = ancestors(places, place.slug).map((a) => radii.get(a.slug) ?? 0);
    const bound = ancRadii.length ? Math.min(...ancRadii) : null;

    let targetVr;
    if (bound != null && bound > 0) {
        // Middle of the (R, bound] window. When R is 0 (a pin has no circle),
        // half the ancestor radius is safely within the ancestor's open circle.
        targetVr = R > 0 ? Math.sqrt(R * bound) : bound / 2;
    } else {
        // No ancestor bound: a step out from the place's own contain zoom.
        targetVr = 2 * (R > 0 ? R : DEFAULT_PLACE_RADIUS_M);
    }
    const target = Math.round(zoomForViewportRadius(targetVr, viewportPx, place.lat));

    // The marker only renders on whole zoom levels between "every ancestor just
    // open" (lower edge) and "the place itself about to open" (upper edge). Round
    // the target into that integer window so a snap can't land it out of the band.
    const loEdge = bound != null && bound > 0
        ? Math.ceil(zoomForViewportRadius(bound, viewportPx, place.lat) - 1e-9)
        : zoomRange.minZoom;
    const canOpen = kids(places, place.slug).length > 0 && R > 0;
    const hiEdge = canOpen
        ? Math.floor(zoomForViewportRadius(R, viewportPx, place.lat) - 1e-9)
        : zoomRange.maxZoom;

    const lo = Math.max(zoomRange.minZoom, loEdge);
    const hi = Math.min(zoomRange.maxZoom, hiEdge);
    // When the window spans no whole level, prefer the lower edge (ancestors open)
    // over nothing.
    const z = hi >= lo ? Math.min(hi, Math.max(lo, target)) : lo;
    return clampZoom(z, zoomRange);
}

/**
 * The breadcrumb: the deepest place that is both APERTA and DENTRO, plus its
 * ancestors, root-first.
 *
 * A place never appears unless it is APERTA, so the indicator cannot name a tier
 * that is not being rendered. Where two candidates both contain the centre, the
 * smallest effective radius wins — the tightest containing zone claims you.
 * That is a heuristic: it is right when the overlap comes from a parent being
 * inflated to reach an outlying child, and arbitrary when two zones genuinely
 * overlap without nesting. It is stable, which is what matters.
 */
export function chain(places, centre, vr, radii) {
    const candidates = places.filter(
        (p) => isOpen(p, vr, radii, places) && isInside(p, centre, radii),
    );
    if (candidates.length === 0) return [];

    let best = candidates[0];
    for (const p of candidates) {
        if ((radii.get(p.slug) ?? 0) < (radii.get(best.slug) ?? 0)) best = p;
    }

    // Only ancestors that are themselves open may be named.
    const line = ancestors(places, best.slug)
        .filter((a) => isOpen(a, vr, radii, places))
        .reverse();
    return [...line, best];
}

// --- Declutter -------------------------------------------------------------
// What `visible` lets through can still overlap on screen: top-level places
// have no ancestor to hide behind, so zooming out piles them up. These resolve
// that in projected pixel space. Items carry `x, y` from
// `map.project(latlng, zoom)` — absolute world pixels at that zoom — so the
// outcome depends on zoom alone and a pan cannot change it.

/** The icon box side, in px — `.pb-map-marker-inner` in pipboy.css. */
export const MARKER_BOX = 26;
/** Breathing room added to the box before two icons count as colliding. */
export const MARKER_PAD = 4;
/** Where the label's top edge sits below the icon's top edge — `.pb-map-marker-label`. */
const LABEL_TOP = 27;

/** Declutter priority by type, lower wins. Ties share a rank on purpose. */
export const TYPE_RANK = {
    region: 1,
    settlement: 2,
    vault: 2,
    landmark: 3,
    poi: 3,
    building: 4,
    room: 5,
};

const rankOf = (type) => TYPE_RANK[type] ?? Number.MAX_SAFE_INTEGER;

/**
 * Priority order: focused place first, then type rank, larger effective radius,
 * name, slug — total, so the outcome never depends on input order.
 */
function byPriority(focused) {
    return (a, b) => {
        const fa = a.slug === focused ? 0 : 1;
        const fb = b.slug === focused ? 0 : 1;
        return fa - fb
            || rankOf(a.type) - rankOf(b.type)
            || (b.radius ?? 0) - (a.radius ?? 0)
            || (a.name ?? '').localeCompare(b.name ?? '')
            || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);
    };
}

/**
 * Greedy marker declutter. In priority order each item is **placed** unless its
 * box hits an already-placed one, in which case it is **absorbed** by the first
 * (= highest-priority) placed item it hits. An absorbed item occupies nothing:
 * in a chain A–B–C where only neighbours overlap, A and C both place.
 *
 *   → { placed: Set<slug> (in priority order),
 *       absorbedBy: Map<slug, winnerSlug>,
 *       groups: Map<winnerSlug, slug[]> (absorbed, in priority order) }
 */
export function declutter(items, { focused = null, box = MARKER_BOX, pad = MARKER_PAD } = {}) {
    const reach = box + pad;
    const order = [...items].sort(byPriority(focused));
    const placedItems = [];
    const placed = new Set();
    const absorbedBy = new Map();
    const groups = new Map();
    for (const p of order) {
        const hit = placedItems.find(
            (q) => Math.abs(p.x - q.x) < reach && Math.abs(p.y - q.y) < reach,
        );
        if (hit) {
            absorbedBy.set(p.slug, hit.slug);
            groups.get(hit.slug).push(p.slug);
        } else {
            placedItems.push(p);
            placed.add(p.slug);
            groups.set(p.slug, []);
        }
    }
    for (const [slug, list] of groups) if (list.length === 0) groups.delete(slug);
    return { placed, absorbedBy, groups };
}

const intersects = (a, b) =>
    a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/**
 * The label pass, run on the placed markers only. In `order` (priority order,
 * as `declutter().placed` iterates), each label box — centred under its icon —
 * is tested against every placed icon box and every label already shown. A
 * label that hits anything is hidden; the icon stays.
 *
 * `sizes` holds measured `{ w, h }` per slug. A label not measured yet (its
 * first frame on screen) is left shown and occupies nothing, so it is judged
 * properly at the next plan rather than hiding a measured neighbour.
 *
 *   → Set<slug> of hidden labels
 */
export function labelPass(placedItems, sizes, order, { box = MARKER_BOX } = {}) {
    const bySlug = new Map(placedItems.map((p) => [p.slug, p]));
    const half = box / 2;
    const icons = placedItems.map((p) => ({
        slug: p.slug,
        left: p.x - half, right: p.x + half, top: p.y - half, bottom: p.y + half,
    }));
    const shown = [];
    const hidden = new Set();
    for (const slug of order) {
        const p = bySlug.get(slug);
        const size = sizes.get(slug);
        if (!p || !size) continue;
        const top = p.y - half + LABEL_TOP;
        const label = { left: p.x - size.w / 2, right: p.x + size.w / 2, top, bottom: top + size.h };
        const blocked = icons.some((i) => i.slug !== slug && intersects(label, i))
            || shown.some((l) => intersects(label, l));
        if (blocked) hidden.add(slug);
        else shown.push(label);
    }
    return hidden;
}

/**
 * The least integer zoom above `zoom` at which no two of `points` (projected at
 * `zoom`) collide. Each zoom step doubles projected distances, so it follows
 * from the closest pair by the same Chebyshev test the declutter uses:
 *
 *   d = min over pairs of max(|dx|, |dy|)
 *   d = 0 → range.maxZoom          (identical coordinates never separate)
 *   else  → zoom + ceil(log2((box + pad) / d)), at least zoom + 1
 *
 * clamped to `range.maxZoom`.
 */
export function separationZoom(points, zoom, range, box = MARKER_BOX, pad = MARKER_PAD) {
    let d = Infinity;
    for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
            const dx = Math.abs(points[i].x - points[j].x);
            const dy = Math.abs(points[i].y - points[j].y);
            d = Math.min(d, Math.max(dx, dy));
        }
    }
    if (d === 0) return range.maxZoom;
    const steps = Number.isFinite(d) ? Math.ceil(Math.log2((box + pad) / d) - 1e-9) : 1;
    return Math.min(range.maxZoom, Math.max(zoom + 1, zoom + steps));
}

/**
 * The floor the player can zoom out to: the configured minimum, raised to the
 * zoom at which the bounds fill the viewport, never past the configured maximum.
 * A non-finite `boundsZoom` (a canvas with no size yet) leaves the config floor.
 */
export function effectiveMinZoom(configMin, configMax, boundsZoom) {
    const floor = Number.isFinite(boundsZoom) ? Math.max(configMin, boundsZoom) : configMin;
    return Math.min(configMax, floor);
}
