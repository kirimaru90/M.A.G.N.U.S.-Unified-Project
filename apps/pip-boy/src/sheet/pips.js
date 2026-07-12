// Shared competence indicator: a fixed row of `slots` squares, the first
// `value` filled. Used identically by the S.P.E.C.I.A.L. rows (5 slots) and the
// skill maestria squares (3 slots), so the two indicators are visually the same
// by construction. Markup and `.pb-pip` / `.pb-pip.filled` styling are shared.
export function pips(value, slots = 5) {
    const filled = Math.max(0, Math.min(slots, value ?? 0));
    return `<div class="pb-pips">${Array.from({ length: slots }, (_, i) =>
        `<span class="pb-pip${i < filled ? ' filled' : ''}"></span>`).join('')}</div>`;
}
