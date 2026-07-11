// Pure client-side dice roller. Rolls are never persisted server-side — only
// the resulting paCurrent delta (if any) is written, via the same
// PATCH .../action-points call path as the manual stepper.

export const POOL_MIN = 1;
export const MODIFIER_MIN = -6;
export const MODIFIER_MAX = 6;
export const REROLL_COST = 1;
export const REGISTER_SIZE = 8;

/** Tumble animation: re-randomise the faces ~every 60ms for 9 ticks (~540ms). */
export const TUMBLE_TICK_MS = 60;
export const TUMBLE_TICKS = 9;

export const OUTCOME = {
    full: 'SUCCESSO PIENO',
    cost: 'SUCCESSO CON COSTO',
    fail: 'FALLIMENTO',
};

/** The register's compact outcome labels. */
export const OUTCOME_SHORT = { full: 'PIENO', cost: 'COSTO', fail: 'FALLIMENTO' };

// ── Random source ───────────────────────────────────────────────────
// Injectable so tests assert on seeded outcomes rather than real randomness.

let randomSource = Math.random;

export function setRandomSource(fn) {
    randomSource = typeof fn === 'function' ? fn : Math.random;
}

/**
 * A page may install `window.__PB_DICE_RANDOM__` before the app boots to seed
 * every roll. Checked per call so a test can swap the sequence mid-scenario.
 */
function source() {
    if (typeof window !== 'undefined' && typeof window.__PB_DICE_RANDOM__ === 'function') {
        return window.__PB_DICE_RANDOM__;
    }
    return randomSource;
}

export function rollDie() {
    return 1 + Math.floor(source()() * 6);
}

export function rollPool(size) {
    return Array.from({ length: Math.max(0, size) }, rollDie);
}

/**
 * A face shown mid-tumble. Purely decorative, so it deliberately bypasses the
 * injectable source: a seeded sequence describes the dice that are *rolled*,
 * not the ones that flicker past on the way there.
 */
export function tumbleFace() {
    return 1 + Math.floor(Math.random() * 6);
}

// ── Pool composition ────────────────────────────────────────────────

/** approach value + (1 if Vantaggio) + modifier, never below one die. */
export function poolSize(approachValue, { advantage = false, modifier = 0 } = {}) {
    return Math.max(POOL_MIN, (approachValue ?? 0) + (advantage ? 1 : 0) + modifier);
}

// ── Resolution ──────────────────────────────────────────────────────

export function classifyDie(value) {
    if (value === 6) return 'full';
    if (value === 4 || value === 5) return 'cost';
    return 'fail';
}

/**
 * With SVANTAGGIO the single highest die is dropped *before* the outcome is
 * evaluated. Returns the index of that die, or -1.
 */
export function droppedIndex(faces, disadvantage) {
    if (!disadvantage || faces.length === 0) return -1;
    let best = 0;
    for (let i = 1; i < faces.length; i++) if (faces[i] > faces[best]) best = i;
    return best;
}

/** Any 6 → full; else any 4/5 → cost; else fail. */
export function resolveOutcome(faces) {
    if (faces.some((v) => v === 6)) return 'full';
    if (faces.some((v) => v === 4 || v === 5)) return 'cost';
    return 'fail';
}

/**
 * A roll refunds `max(0, sixes - 1)` PA — every 6 beyond the first returns 1.
 * FORTUNA never refunds, and a die dropped by SVANTAGGIO never counts.
 */
export function refundFromSixes(keptFaces, { rewardOnSixes = true } = {}) {
    if (!rewardOnSixes) return 0;
    const sixes = keptFaces.filter((v) => v === 6).length;
    return Math.max(0, sixes - 1);
}

/**
 * Resolve a settled roll. `faces` are all rolled dice, in order; the dropped
 * die (if any) is excluded from both the outcome and the six-count.
 */
export function summarizeRoll(faces, { disadvantage = false, rewardOnSixes = true } = {}) {
    const dropped = droppedIndex(faces, disadvantage);
    const kept = faces.filter((_, i) => i !== dropped);
    return {
        faces,
        dropped,
        kept,
        outcome: resolveOutcome(kept),
        refund: refundFromSixes(kept, { rewardOnSixes }),
        classified: faces.map((value, i) => ({
            value,
            kind: classifyDie(value),
            dropped: i === dropped,
        })),
    };
}

export function applyPaDelta(paCurrent, paMax, delta) {
    const next = (paCurrent ?? 0) + delta;
    return Math.max(0, Math.min(paMax ?? next, next));
}

/** `P 4d6+1` — approach letter, pool size, signed modifier when non-zero. */
export function rollExpression(letter, size, modifier) {
    const mod = modifier > 0 ? `+${modifier}` : modifier < 0 ? `${modifier}` : '';
    return `${letter} ${size}d6${mod}`;
}
