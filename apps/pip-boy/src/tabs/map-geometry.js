// The map's level-of-detail rules, as pure functions: no DOM, no Leaflet, so
// they are unit-testable without a browser.
//
// `effectiveRadius` here MUST agree with the API's `campaign-map.service.ts` and
// the CMS's `place-tree.ts`. Three implementations, one rule: the API's specs
// pin it, the CMS draws the circle, this decides what the circle opens. If you
// change it here, change it in all three or the author sees a lie.

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
