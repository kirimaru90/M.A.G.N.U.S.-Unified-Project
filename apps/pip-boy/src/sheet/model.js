// Shared vocabulary for the character sheet: the seven approaches, the
// logoramento weights, and the critical threshold. Kept in one place so the
// S.P.E, DADI and SALUTE tabs cannot drift from one another.

/** The seven S.P.E.C.I.A.L. approaches, in sheet order. `key` is the API field. */
export const APPROACHES = [
    { key: 'strength', letter: 'S', name: 'FORZA', desc: 'Potenza fisica, intimidazione' },
    { key: 'perception', letter: 'P', name: 'PERCEZIONE', desc: 'Mira, attenzione, dettagli' },
    { key: 'endurance', letter: 'E', name: 'RESISTENZA', desc: 'Tenacia, sopportare dolore' },
    { key: 'charisma', letter: 'C', name: 'CARISMA', desc: 'Convincere, mentire, guidare' },
    { key: 'intelligence', letter: 'I', name: 'INTELLIGENZA', desc: 'Logica, scienza, tecnologia' },
    { key: 'agility', letter: 'A', name: 'AGILITÀ', desc: 'Riflessi, furtività, manualità' },
    { key: 'luck', letter: 'L', name: 'FORTUNA', desc: 'Il jolly: affidarsi al caso' },
];

export const SPECIAL_MIN = 1;
export const SPECIAL_MAX = 5;

// MAX PA is decoupled from the SPECIAL range: narrowing SPECIAL to 1..5 must not
// lower the reachable paMax, which keeps its own 0..8 bound.
export const PA_MAX_MIN = 0;
export const PA_MAX_MAX = 8;

/** `paTrackedBy` names an approach; the header shows `PA · <that approach>`. */
export const PA_SOURCES = [
    { value: 'agility', key: 'agility', label: 'AGILITÀ' },
    { value: 'endurance', key: 'endurance', label: 'RESISTENZA' },
];

export const SKILL_LEVELS = ['competent', 'expert', 'master'];
export const SKILL_LEVEL_LABELS = {
    competent: 'COMPETENTE',
    expert: 'ESPERTO',
    master: 'MAESTRO',
};

/** A `minor` condition weighs 1, a `major` weighs 2 (BASE / MODERATA ×2). */
export const CONDITION_WEIGHTS = { minor: 1, major: 2 };

/** Fallback margin for a character persisted before `margin` existed. */
export const DEFAULT_MARGIN = 4;

export function conditionWeight(condition) {
    return CONDITION_WEIGHTS[condition?.severity] ?? 1;
}

const sum = (list) => (list ?? []).reduce((acc, c) => acc + conditionWeight(c), 0);

/** Net wear = Σ negative weights − Σ positive weights. */
export function netWear(status) {
    return sum(status?.negativeConditions) - sum(status?.positiveConditions);
}

/**
 * Health = margin − net wear. Positives may push it above `margin` (overshoot);
 * negatives may take it below 0. The one place the rule lives.
 */
export function health(status, margin = DEFAULT_MARGIN) {
    return margin - netWear(status);
}

/** The client derives `criticalState` and persists it (see design D5). */
export function isCritical(status, margin = DEFAULT_MARGIN) {
    return health(status, margin) <= 0;
}

export function approachByKey(key) {
    return APPROACHES.find((a) => a.key === key);
}

export function paSourceLabel(paTrackedBy) {
    return approachByKey(paTrackedBy)?.name ?? '—';
}

export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
