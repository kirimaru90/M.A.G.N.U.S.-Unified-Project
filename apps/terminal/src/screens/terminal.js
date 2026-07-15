import {
    ENGINE_CONFIG,
    scrollFocusIntoViewIfNeeded,
    abortCurrentTyping,
    getLastTypingEndAt,
    typeWriterHTML,
} from '../engine/typewriter.js';
import { typingSound, clickSound, selectionSound, hoverSound } from '../engine/sounds.js';
import { pushHistory, popHistory, peekHistory, getHistoryLength, clearHistory } from '../engine/back-history.js';
import { getLoggedInUser, getRememberedPassword, clearLogins } from '../engine/login-fictional.js';
import { getSnapshot } from '../state/store.js';
import { evaluate } from '../state/conditions.js';
import { resolveNode, dispatchOnEnter, dispatchChoiceSet, RERENDER_REQUIRED, INLINE_ERROR } from '../engine/node-resolver.js';
import { mountInputComponent } from '../engine/components/input.js';

export function mountTerminal(contentEl, choicesEl, terminalEl, { onDisconnect, onRequestLogin, setKeyHandler }) {
    let terminalData = {};
    let seenNodes = new Set();
    let currentTerminalId = null;
    let currentCampaignId = null;
    let currentNodeId = null;
    let pendingStateError = false;

    function tagCrtLines(el) {
        Array.from(el.children).forEach(child => child.classList.add('crt-line'));
    }

    function addBtnSounds(btn) {
        btn.addEventListener('mouseenter', hoverSound);
        btn.addEventListener('click', () => { clickSound(); });
    }

    function getLoginForNode(nodeId) {
        const node = terminalData[nodeId];
        return (node && node.login) ? node.login : null;
    }

    // Pick the first user in this gate that has a remembered password for the
    // current terminal, so the login overlay can pre-fill on reconnect. Returns
    // null when nothing is remembered (overlay renders with an empty password).
    function computeLoginPrefill(loginBlock) {
        for (const u of loginBlock.users) {
            const name = typeof u === 'string' ? u : u.username;
            const password = getRememberedPassword(currentTerminalId, name);
            if (password !== undefined) return { username: name, password };
        }
        return null;
    }

    function showAlreadyLoggedIn(username, onDone) {
        choicesEl.style.display = 'none';
        choicesEl.innerHTML = '';
        const speed = Math.round(ENGINE_CONFIG.typingSpeed * 0.5);
        typeWriterHTML(`<p>Utente ${username} connesso</p>`, contentEl, () => {
            setTimeout(onDone, 2000);
        }, speed);
    }

    function pickInputComponent(view) {
        const components = view.components;
        if (!components) return null;
        return components.find(c => c.type === 'input') || null;
    }

    function appendSystemButtons(choicesEl) {
        const sysBtns = [];
        if (getHistoryLength() > 1) {
            const backBtn = document.createElement('button');
            backBtn.className = 'choice-btn';
            backBtn.textContent = '[ Torna al menu precedente ]';
            backBtn.onclick = goBack;
            addBtnSounds(backBtn);
            choicesEl.appendChild(backBtn);
            sysBtns.push(backBtn);
        }
        if (getHistoryLength() === 1) {
            const sep = document.createElement('p');
            sep.className = 'system-separator';
            sep.textContent = '---';
            choicesEl.appendChild(sep);
            const exitBtn = document.createElement('button');
            exitBtn.className = 'choice-btn choice-btn-system';
            exitBtn.textContent = '[ disconnetti terminale ]';
            exitBtn.onclick = disconnectTerminal;
            addBtnSounds(exitBtn);
            choicesEl.appendChild(exitBtn);
            sysBtns.push(exitBtn);
        }
        return sysBtns;
    }

    function renderNode(nodeId, view) {
        pendingStateError = false;
        choicesEl.style.display = 'none';
        choicesEl.innerHTML = '';
        // Previously-seen nodes render instantly (0 ms/char) via typeWriterHTML's
        // speed === 0 fast path; first visits type at the normal speed.
        const speed = seenNodes.has(nodeId) ? 0 : ENGINE_CONFIG.typingSpeed;
        seenNodes.add(nodeId);
        const htmlContent = marked.parse(view.text || '');
        if (htmlContent.trim()) typingSound.start();
        typeWriterHTML(htmlContent, contentEl, () => {
            tagCrtLines(contentEl);
            typingSound.stop();
            const inputComp = pickInputComponent(view);
            if (inputComp) {
                if (pendingStateError) {
                    const errEl = document.createElement('p');
                    errEl.className = 'state-error';
                    errEl.textContent = 'ERRORE STATO: comunicazione col server non riuscita.';
                    choicesEl.appendChild(errEl);
                    pendingStateError = false;
                }
                const finalize = mountInputComponent({
                    component: inputComp,
                    terminalId: currentTerminalId,
                    campaignId: currentCampaignId,
                    choicesEl,
                    requestNavigate: target => loadNode(target),
                    requestRerender: () => { abortCurrentTyping(); loadNode(currentNodeId); },
                    requestInlineError: kind => {
                        const errEl = document.createElement('p');
                        errEl.className = 'state-error';
                        errEl.textContent = kind === 'logic'
                            ? 'ERRORE LOGICA: ramo di destinazione non trovato.'
                            : 'ERRORE STATO: comunicazione col server non riuscita.';
                        choicesEl.insertBefore(errEl, choicesEl.firstChild);
                    },
                    addBtnSounds,
                    setKeyHandler,
                });
                const sysBtns = appendSystemButtons(choicesEl);
                finalize(sysBtns, goBack, disconnectTerminal);
            } else {
                showChoices(view.choices);
            }
        }, speed);
    }

    function showInlineStateError() {
        if (choicesEl.style.display === 'block') {
            const errEl = document.createElement('p');
            errEl.className = 'state-error';
            errEl.textContent = 'ERRORE STATO: comunicazione col server non riuscita.';
            choicesEl.insertBefore(errEl, choicesEl.firstChild);
        } else {
            pendingStateError = true;
        }
    }

    async function loadNode(nodeId, isBack = false) {
        const node = terminalData[nodeId];
        if (!node) return;

        currentNodeId = nodeId;

        const loginBlock = getLoginForNode(nodeId);
        if (loginBlock) {
            const loggedUser = getLoggedInUser(currentTerminalId, loginBlock);
            if (!loggedUser) {
                onRequestLogin(loginBlock, currentTerminalId, (username) => {
                    if (!isBack) pushHistory(nodeId);
                    showAlreadyLoggedIn(username, () => {
                        const view = resolveNode(node, getSnapshot());
                        renderNode(nodeId, view);
                    });
                }, () => {
                    popHistory();
                    const prev = peekHistory();
                    if (prev !== undefined) {
                        loadNode(prev, true);
                    } else {
                        clearHistory();
                        onDisconnect();
                    }
                }, computeLoginPrefill(loginBlock));
                return;
            }
            if (!isBack) pushHistory(nodeId);
            showAlreadyLoggedIn(loggedUser, () => {
                const view = resolveNode(node, getSnapshot());
                renderNode(nodeId, view);
            });
            return;
        }

        if (!isBack) pushHistory(nodeId);
        const view = resolveNode(node, getSnapshot());
        renderNode(nodeId, view);

        const result = await dispatchOnEnter(node, currentTerminalId, currentCampaignId);
        if (result === RERENDER_REQUIRED) {
            abortCurrentTyping();
            const freshView = resolveNode(terminalData[nodeId], getSnapshot());
            renderNode(nodeId, freshView);
        } else if (result === INLINE_ERROR) {
            showInlineStateError();
        }
    }

    function goBack() {
        if (getHistoryLength() > 1) {
            popHistory();
            const previousNode = peekHistory();
            loadNode(previousNode, true);
        }
    }

    function disconnectTerminal() {
        abortCurrentTyping();
        // Logout: clear this terminal's authenticated logins so reconnecting
        // re-presents its gates. Remembered credentials are kept for prefill.
        if (currentTerminalId) clearLogins(currentTerminalId);
        terminalData = {};
        seenNodes = new Set();
        clearHistory();
        setKeyHandler(null);
        terminalEl.style.display = 'none';
        onDisconnect();
    }

    function showChoices(choices) {
        choicesEl.innerHTML = '';
        if (pendingStateError) {
            const errEl = document.createElement('p');
            errEl.className = 'state-error';
            errEl.textContent = 'ERRORE STATO: comunicazione col server non riuscita.';
            choicesEl.appendChild(errEl);
            pendingStateError = false;
        }
        if (choices && choices.length > 0) {
            choices.forEach(choice => {
                if (choice.when !== undefined && !evaluate(choice.when, getSnapshot())) return;
                const btn = document.createElement('button');
                btn.className = 'choice-btn';
                btn.textContent = choice.label;
                btn.onclick = async () => {
                    const setPromise = dispatchChoiceSet(choice, currentTerminalId, currentCampaignId);
                    loadNode(choice.target);
                    const result = await setPromise;
                    if (result === RERENDER_REQUIRED) {
                        abortCurrentTyping();
                        const nodeId = currentNodeId;
                        const freshView = resolveNode(terminalData[nodeId], getSnapshot());
                        renderNode(nodeId, freshView);
                    } else if (result === INLINE_ERROR) {
                        showInlineStateError();
                    }
                };
                addBtnSounds(btn);
                choicesEl.appendChild(btn);
            });
        }

        appendSystemButtons(choicesEl);

        choicesEl.style.display = 'block';

        const buttons = Array.from(choicesEl.querySelectorAll('button'));

        setKeyHandler(function(e) {
            const idx = buttons.indexOf(document.activeElement);
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const next = buttons[(idx + 1) % buttons.length];
                next.focus();
                scrollFocusIntoViewIfNeeded(next);
                selectionSound();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prev = buttons[(idx - 1 + buttons.length) % buttons.length];
                prev.focus();
                scrollFocusIntoViewIfNeeded(prev);
                selectionSound();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (performance.now() - getLastTypingEndAt() < ENGINE_CONFIG.postTypingEnterCooldownMs) return;
                if (idx !== -1) document.activeElement.click();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                clickSound();
                if (getHistoryLength() > 1) goBack();
                else disconnectTerminal();
            }
        });

        if (buttons.length > 0) {
            buttons[0].focus();
            scrollFocusIntoViewIfNeeded(buttons[0]);
        }
    }

    function loadTapeData(data, terminalId, campaignId) {
        terminalData = data;
        currentTerminalId = terminalId;
        currentCampaignId = campaignId;
        currentNodeId = null;
        seenNodes = new Set();
        clearHistory();
    }

    return { loadTapeData, loadNode, showAlreadyLoggedIn };
}
