// Tiny render helper for a buildless, template-string-based UI. Every value
// interpolated into a template must go through esc() unless it is a literal
// or already-trusted constant — user/admin-entered strings (names, item
// labels, condition text, etc.) are rendered via innerHTML throughout.

export function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
}

export function mount(rootEl, html) {
    rootEl.innerHTML = html;
    return rootEl;
}
