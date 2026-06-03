import { typingSound } from './sounds.js';

// Author-tunable engine constants. Edit these to change runtime behaviour
// without touching handler logic. Letter-based shortcuts gate on
// isTextInputFocused() so they never compete with text input fields.
const ENGINE_CONFIG = {
    typingSpeed: 15,
    postTypingEnterCooldownMs: 1000,
    scrollStepPx: 40,
};

let currentTypingHandle = null;
let lastTypingEndAt = 0;
let autoFollowEnabled = true;
let suppressNextScrollEvent = false;
let suppressNextClickAfterSkip = false;

function isTextInputFocused() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'TEXTAREA') return true;
    if (tag === 'INPUT') {
        const type = (el.type || 'text').toLowerCase();
        return ['text','password','email','search','url','tel','number'].includes(type);
    }
    return el.isContentEditable === true;
}

window.addEventListener('scroll', function() {
    if (suppressNextScrollEvent) { suppressNextScrollEvent = false; return; }
    autoFollowEnabled = false;
}, { passive: true });

document.addEventListener('keydown', function(e) {
    if (currentTypingHandle && currentTypingHandle.isActive()) {
        if (e.key === 'Enter' || e.key === 'Escape') {
            e.preventDefault();
            e.stopImmediatePropagation();
            currentTypingHandle.skip();
        }
    }
}, true);

document.addEventListener('pointerdown', function(e) {
    if (!currentTypingHandle || !currentTypingHandle.isActive()) return;
    const isLeftClick = e.pointerType === 'mouse' && e.button === 0;
    const isPrimaryTouch = (e.pointerType === 'touch' || e.pointerType === 'pen') && e.isPrimary;
    if (!isLeftClick && !isPrimaryTouch) return;
    suppressNextClickAfterSkip = true;
    currentTypingHandle.skip();
}, true);

document.addEventListener('click', function(e) {
    if (!suppressNextClickAfterSkip) return;
    suppressNextClickAfterSkip = false;
    e.stopPropagation();
    e.preventDefault();
}, true);

document.addEventListener('keydown', function(e) {
    if (isTextInputFocused()) return;
    if (e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        window.scrollBy({ top: -ENGINE_CONFIG.scrollStepPx, behavior: 'auto' });
    } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        window.scrollBy({ top: ENGINE_CONFIG.scrollStepPx, behavior: 'auto' });
    }
});

function scrollFocusIntoViewIfNeeded(el) {
    if (!el || typeof el.getBoundingClientRect !== 'function') return;
    const rect = el.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > window.innerHeight) {
        suppressNextScrollEvent = true;
        el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
}

function abortCurrentTyping() {
    if (currentTypingHandle && currentTypingHandle.isActive()) {
        currentTypingHandle.cancel();
    }
    typingSound.stop();
}

function getLastTypingEndAt() {
    return lastTypingEndAt;
}

function typeWriterHTML(html, element, callback, speed = ENGINE_CONFIG.typingSpeed, onChar) {
    if (currentTypingHandle && currentTypingHandle.isActive()) {
        currentTypingHandle.cancel();
    }

    function finish() {
        lastTypingEndAt = performance.now();
        if (callback) callback();
    }

    if (speed === 0) {
        element.innerHTML = html;
        currentTypingHandle = null;
        finish();
        return;
    }

    element.innerHTML = '';
    let i = 0;
    let isTag = false;
    let currentText = '';
    let done = false;
    let cancelled = false;

    const handle = {
        skip() {
            if (done || cancelled) return;
            done = true;
            element.innerHTML = html;
            currentTypingHandle = null;
            finish();
        },
        cancel() {
            if (done || cancelled) return;
            cancelled = true;
            done = true;
            currentTypingHandle = null;
        },
        isActive() {
            return !done && !cancelled;
        }
    };
    currentTypingHandle = handle;

    function type() {
        if (done || cancelled) return;
        if (i < html.length) {
            const char = html.charAt(i);
            currentText += char;

            if (char === '<') isTag = true;
            if (char === '>') isTag = false;

            element.innerHTML = currentText;

            if (!isTag && char.trim() !== '') {
                if (onChar) onChar();
                if (autoFollowEnabled) {
                    const rect = element.getBoundingClientRect();
                    if (rect.bottom > window.innerHeight) {
                        suppressNextScrollEvent = true;
                        element.scrollIntoView({ block: 'end', behavior: 'auto' });
                    }
                }
            }

            i++;
            setTimeout(type, isTag ? 0 : speed);
        } else {
            done = true;
            currentTypingHandle = null;
            finish();
        }
    }
    type();
}

export {
    ENGINE_CONFIG,
    isTextInputFocused,
    scrollFocusIntoViewIfNeeded,
    abortCurrentTyping,
    getLastTypingEndAt,
    typeWriterHTML,
};
