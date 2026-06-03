import { initSound, clickSound, selectionSound } from '../engine/sounds.js';
import { makeNavHandler } from '../engine/keynav.js';
import { apiGet } from '../api/client.js';
import { isAuthenticated, getUser } from '../api/session.js';
import { abortCurrentTyping } from '../engine/typewriter.js';

// API field names follow the server contract in reference/Swagger API.html
export async function mountTerminalList(rootEl, opts) {
    const {
        campaignId, campaignName, campaignIsPublic,
        onTerminalSelected, onTerminalDataLoaded, onBack,
        onLogin, onLogout, setKeyHandler,
    } = opts;
    abortCurrentTyping();
    initSound();

    let terminalList, visitedHidden;
    try {
        const res = await apiGet('/campaigns/' + encodeURIComponent(campaignId) + '/terminals');
        terminalList = Array.isArray(res) ? res : [];
        visitedHidden = terminalList.filter(t => t.hiddenId && !t.isPublic).map(t => t.hiddenId);
    } catch (error) {
        rootEl.innerHTML = `<h2 style="color:red">ERRORE DI RETE</h2><p>Impossibile comunicare con il server.<br>${error.message}</p>`;
        const backBtn = document.createElement('button');
        backBtn.className = 'choice-btn';
        backBtn.textContent = '[ Indietro ]';
        backBtn.onclick = onBack;
        rootEl.appendChild(backBtn);
        setKeyHandler(makeNavHandler([backBtn]));
        backBtn.focus();
        return;
    }

    rootEl.innerHTML = '<h2>ROBCO INDUSTRIES - UNIFIED OPERATING SYSTEM</h2><p>SELEZIONARE ARCHIVIO DA CARICARE:</p>';

    terminalList.filter(t => t.isPublic).forEach(terminal => {
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.textContent = `[ ${terminal.title} ]`;
        btn.addEventListener('mouseenter', selectionSound);
        btn.onclick = () => { clickSound(); onTerminalSelected(terminal.id); };
        rootEl.appendChild(btn);
    });

    const separator = document.createElement('p');
    separator.textContent = '---';
    rootEl.appendChild(separator);

    const hiddenInputEl = document.createElement('input');
    hiddenInputEl.type = 'text';
    hiddenInputEl.id = 'hidden-input';
    hiddenInputEl.placeholder = 'INSERISCI NOME ARCHIVIO';
    hiddenInputEl.autocomplete = 'off';
    rootEl.appendChild(hiddenInputEl);

    // Dropdown only exists when the server provided visited hidden ids.
    let dropdownEl = null;
    let activeIndex = -1;

    if (visitedHidden.length > 0) {
        dropdownEl = document.createElement('div');
        dropdownEl.className = 'hidden-autocomplete-dropdown';
        dropdownEl.style.display = 'none';
        rootEl.appendChild(dropdownEl);

        function getFilteredEntries() {
            const q = hiddenInputEl.value.toLowerCase();
            return q ? visitedHidden.filter(e => e.toLowerCase().includes(q)) : visitedHidden.slice();
        }

        function renderDropdown(entries) {
            dropdownEl.innerHTML = '';
            entries.forEach((entry, i) => {
                const item = document.createElement('div');
                item.className = 'hidden-autocomplete-item' + (i === activeIndex ? ' active' : '');
                item.textContent = entry;
                item.addEventListener('mouseenter', () => { activeIndex = i; updateHighlight(); });
                // mousedown + preventDefault keeps focus on the input (no blur fires).
                item.addEventListener('mousedown', e => { e.preventDefault(); pickEntry(entry); });
                dropdownEl.appendChild(item);
            });
        }

        function updateHighlight() {
            dropdownEl.querySelectorAll('.hidden-autocomplete-item').forEach((item, i) => {
                item.classList.toggle('active', i === activeIndex);
            });
        }

        function openDropdown() {
            const entries = getFilteredEntries();
            if (!entries.length) { closeDropdown(); return; }
            activeIndex = -1;
            renderDropdown(entries);
            dropdownEl.style.display = 'block';
        }

        function closeDropdown() {
            dropdownEl.style.display = 'none';
            activeIndex = -1;
        }

        function pickEntry(entry) {
            hiddenInputEl.value = entry;
            closeDropdown();
            hiddenInputEl.focus();
        }

        function isDropdownOpen() { return dropdownEl.style.display !== 'none'; }

        hiddenInputEl.addEventListener('focus', () => openDropdown());
        hiddenInputEl.addEventListener('blur', () => setTimeout(closeDropdown, 150));
        hiddenInputEl.addEventListener('input', () => {
            const entries = getFilteredEntries();
            if (!entries.length) { closeDropdown(); return; }
            activeIndex = -1;
            renderDropdown(entries);
            dropdownEl.style.display = 'block';
        });

        hiddenInputEl.addEventListener('keydown', e => {
            if (isDropdownOpen()) {
                if (e.key === 'ArrowDown') {
                    e.stopPropagation(); e.preventDefault();
                    const entries = getFilteredEntries();
                    activeIndex = (activeIndex + 1) % entries.length;
                    updateHighlight();
                    return;
                }
                if (e.key === 'ArrowUp') {
                    e.stopPropagation(); e.preventDefault();
                    activeIndex = activeIndex <= 0 ? -1 : activeIndex - 1;
                    updateHighlight();
                    return;
                }
                if (e.key === 'Enter') {
                    e.stopPropagation(); e.preventDefault();
                    if (activeIndex >= 0) {
                        const entries = getFilteredEntries();
                        if (entries[activeIndex]) pickEntry(entries[activeIndex]);
                    } else {
                        closeDropdown();
                        lookupHidden();
                    }
                    return;
                }
                if (e.key === 'Escape') {
                    e.stopPropagation(); e.preventDefault();
                    closeDropdown();
                    return;
                }
            } else {
                if (e.key === 'Enter') { lookupHidden(); return; }
                // Arrow keys fall through to makeNavHandler when dropdown is closed.
            }
        });
    }

    const hiddenSubmitEl = document.createElement('button');
    hiddenSubmitEl.className = 'choice-btn';
    hiddenSubmitEl.id = 'hidden-submit';
    hiddenSubmitEl.textContent = '[ CARICA ]';
    hiddenSubmitEl.addEventListener('mouseenter', selectionSound);
    rootEl.appendChild(hiddenSubmitEl);

    const hiddenErrorEl = document.createElement('p');
    hiddenErrorEl.id = 'hidden-error';
    hiddenErrorEl.style.display = 'none';
    hiddenErrorEl.style.color = 'red';
    hiddenErrorEl.textContent = 'ARCHIVIO NON TROVATO';
    rootEl.appendChild(hiddenErrorEl);

    const backBtn = document.createElement('button');
    backBtn.className = 'choice-btn';
    backBtn.textContent = '[ Indietro ]';
    backBtn.addEventListener('mouseenter', selectionSound);
    backBtn.onclick = () => { clickSound(); onBack(); };
    rootEl.appendChild(backBtn);

    async function lookupHidden() {
        clickSound();
        const value = hiddenInputEl.value.trim();
        hiddenErrorEl.style.display = 'none';
        if (!value) {
            hiddenErrorEl.style.display = 'block';
            return;
        }
        try {
            // by-hidden-id returns the same playback shape as /terminals/{id}/load, so we
            // hand the data straight to the loader without a second round-trip. Any
            // error (404, auth, network, parse) maps to ARCHIVIO NON TROVATO so
            // authorization failures don't leak terminal existence.
            const rawData = await apiGet(
                '/campaigns/' + encodeURIComponent(campaignId) +
                '/terminals/by-hidden-id/' + encodeURIComponent(value)
            );
            onTerminalDataLoaded(rawData);
        } catch (_) {
            hiddenErrorEl.style.display = 'block';
        }
    }

    hiddenSubmitEl.onclick = lookupHidden;
    // Plain Enter handler when no autocomplete dropdown is present.
    if (!dropdownEl) {
        hiddenInputEl.addEventListener('keydown', e => {
            if (e.key === 'Enter') lookupHidden();
        });
    }

    // Session identity and the auth action live in a footer at the bottom of the
    // screen, after the navigation (Indietro), so logout is separated and
    // color-coded apart from the green navigation (Decision 10).
    _appendStatusFooter(rootEl, opts, campaignName);

    const focusables = Array.from(rootEl.querySelectorAll('button, input'));
    setKeyHandler(makeNavHandler(focusables));
    if (focusables.length > 0) focusables[0].focus();
}

// Status footer: a glanceable "who am I / where am I" line (Decision 9) plus
// the auth action, rendered in both auth states (Decision 10). The line names
// the user when authenticated (display field assumed `username`, falling back to
// `name`), "utente anonimo" otherwise, and always appends the current campaign.
function _appendStatusFooter(rootEl, opts, campaignName) {
    const footer = document.createElement('footer');
    footer.className = 'boot-status-footer';
    footer.setAttribute('role', 'contentinfo');

    const who = document.createElement('p');
    who.className = 'who';
    who.textContent = _sessionLabel(campaignName);
    footer.appendChild(who);

    _appendAuthButton(footer, rootEl, opts);
    rootEl.appendChild(footer);
}

function _sessionLabel(campaignName) {
    let userPart = 'UTENTE ANONIMO';
    if (isAuthenticated()) {
        const user = getUser();
        const name = user && (user.username || user.name);
        userPart = name ? `UTENTE ${name} AUTENTICATO` : 'UTENTE AUTENTICATO';
    }
    return campaignName ? `${userPart} · CAMPAGNA: ${campaignName}` : userPart;
}

function _appendAuthButton(container, rootEl, opts) {
    const { campaignIsPublic, onLogin, onLogout, onBack } = opts;
    if (!onLogin && !onLogout) return;

    const authed = isAuthenticated();
    const btn = document.createElement('button');
    btn.className = authed ? 'choice-btn is-logout' : 'choice-btn';
    btn.textContent = authed ? '[ Esci — disconnetti utente ]' : '[ Accedi ]';
    if (authed) {
        const user = getUser();
        const name = user && (user.username || user.name);
        btn.setAttribute('aria-label', name ? `Disconnetti utente ${name}` : 'Disconnetti utente');
    }
    btn.addEventListener('mouseenter', selectionSound);

    btn.onclick = async () => {
        clickSound();
        if (isAuthenticated()) {
            if (onLogout) await onLogout();
            // After logout, a private campaign may no longer be authorized, so
            // exit to campaign selection; a public one re-renders in place.
            if (campaignIsPublic) mountTerminalList(rootEl, opts);
            else onBack();
        } else {
            if (onLogin) await onLogin();
            // Re-render in the now-current auth mode whether the user logged
            // in or cancelled (restores the key handler either way).
            mountTerminalList(rootEl, opts);
        }
    };

    container.appendChild(btn);
}
