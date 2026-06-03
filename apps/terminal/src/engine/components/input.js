import { evaluate } from '../../state/conditions.js';
import { getSnapshot } from '../../state/store.js';
import { dispatchMutations, RERENDER_REQUIRED, INLINE_ERROR } from '../node-resolver.js';
import { getHistoryLength } from '../back-history.js';
import { scrollFocusIntoViewIfNeeded } from '../typewriter.js';
import { selectionSound, clickSound } from '../sounds.js';

export function mountInputComponent({
    component, terminalId, campaignId, choicesEl,
    requestNavigate, requestRerender, requestInlineError,
    addBtnSounds, setKeyHandler,
}) {
    const inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.className = 'input-field';
    inputEl.placeholder = component.placeholder || '';
    choicesEl.appendChild(inputEl);

    const submitBtn = document.createElement('button');
    submitBtn.className = 'choice-btn';
    submitBtn.textContent = '[ INVIA ]';
    addBtnSounds(submitBtn);
    choicesEl.appendChild(submitBtn);

    let inFlight = false;
    let systemButtonsRef = [];
    let focusList = [inputEl, submitBtn];

    function reenableAfterError() {
        inFlight = false;
        inputEl.disabled = false;
        focusList = [inputEl, submitBtn, ...systemButtonsRef];
        inputEl.focus();
    }

    async function submit() {
        const rawValue = inputEl.value;
        if (!rawValue || inFlight) return;
        inFlight = true;
        inputEl.disabled = true;
        focusList = systemButtonsRef.slice();

        try {
            const result = await dispatchMutations(
                [{ op: 'set', key: component.set, value: rawValue }],
                terminalId, campaignId
            );

            if (result === null) {
                const snapshot = getSnapshot();
                let target = null;
                for (const branch of component.branches) {
                    if (!branch.default && branch.when && evaluate(branch.when, snapshot)) {
                        target = branch.target;
                        break;
                    }
                }
                if (target === null) {
                    const def = component.branches.find(b => b.default === true);
                    if (def) target = def.target;
                }
                if (target !== null) {
                    requestNavigate(target);
                } else {
                    requestInlineError('logic');
                    reenableAfterError();
                }
            } else if (result === RERENDER_REQUIRED) {
                requestRerender();
            } else {
                requestInlineError('state');
                reenableAfterError();
            }
        } catch {
            requestInlineError('state');
            reenableAfterError();
        }
    }

    submitBtn.onclick = () => submit().catch(() => {});

    inputEl.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.stopPropagation();
            submit().catch(() => {});
        }
    });

    return function finalize(systemButtons, requestBack, requestDisconnect) {
        systemButtonsRef = systemButtons;
        focusList = [inputEl, submitBtn, ...systemButtons];

        setKeyHandler(function(e) {
            if (focusList.length === 0) return;
            const idx = focusList.indexOf(document.activeElement);

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const next = focusList[(idx + 1) % focusList.length];
                next.focus();
                scrollFocusIntoViewIfNeeded(next);
                selectionSound();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prev = focusList[(idx - 1 + focusList.length) % focusList.length];
                prev.focus();
                scrollFocusIntoViewIfNeeded(prev);
                selectionSound();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (document.activeElement !== inputEl && idx !== -1) {
                    document.activeElement.click();
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                clickSound();
                if (getHistoryLength() > 1) requestBack();
                else requestDisconnect();
            }
        });

        choicesEl.style.display = 'block';
        inputEl.focus();
        scrollFocusIntoViewIfNeeded(inputEl);
    };
}
