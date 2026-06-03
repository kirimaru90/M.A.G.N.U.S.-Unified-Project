import { scrollFocusIntoViewIfNeeded } from './typewriter.js';
import { selectionSound } from './sounds.js';

function makeNavHandler(focusables) {
    return function(e) {
        const el = document.activeElement;
        const idx = focusables.indexOf(el);
        if (idx === -1) return;
        const isSelect = el.tagName === 'SELECT';
        const isButton = el.tagName === 'BUTTON';

        if (e.key === 'ArrowDown' && !isSelect) {
            e.preventDefault();
            const next = focusables[(idx + 1) % focusables.length];
            next.focus();
            scrollFocusIntoViewIfNeeded(next);
            selectionSound();
        } else if (e.key === 'ArrowUp' && !isSelect) {
            e.preventDefault();
            const prev = focusables[(idx - 1 + focusables.length) % focusables.length];
            prev.focus();
            scrollFocusIntoViewIfNeeded(prev);
            selectionSound();
        } else if (e.key === 'Enter' && isButton) {
            e.preventDefault();
            el.click();
        } else if (e.key === 'Enter' && isSelect) {
            e.preventDefault();
            const next = focusables[(idx + 1) % focusables.length];
            next.focus();
            scrollFocusIntoViewIfNeeded(next);
        }
    };
}

export { makeNavHandler };
