import { apiGet } from '../api/client.js';
import { makeNavHandler } from '../engine/keynav.js';
import { initSound, clickSound, selectionSound } from '../engine/sounds.js';
import { isAuthenticated, getUser } from '../api/session.js';

// API field names follow the server contract in reference/Swagger API.html.
// Campaign public-visibility is read via _isPublic() — the single place that
// names the field (assumed `isPublic`, mirroring terminals); change it here if
// the server differs.
function _isPublic(campaign) {
    return !!campaign.isPublic;
}

export async function mountCampaignSelect(rootEl, opts) {
    // If the element is hidden, a landing redirect already took over — bail.
    if (rootEl.style.display === 'none') return;
    const { onCampaignSelected, setKeyHandler } = opts;
    rootEl.innerHTML = '<h2>ROBCO INDUSTRIES - UNIFIED OPERATING SYSTEM</h2><p>CONNESSIONE IN CORSO...</p><span class="cursor">_</span>';
    initSound();

    let campaigns;
    try {
        campaigns = await apiGet('/campaigns');
    } catch (_) {
        _renderError(rootEl, () => mountCampaignSelect(rootEl, opts), setKeyHandler);
        return;
    }

    // Single-campaign auto-enter applies before any auth button or grouping would show.
    if (campaigns.length === 1) {
        onCampaignSelected(campaigns[0]);
        return;
    }

    // Authenticated: split into public/private groups (with per-group empty
    // strings). Anonymous: keep the single undifferentiated list / empty state.
    if (isAuthenticated()) {
        _renderGrouped(rootEl, campaigns, opts);
        return;
    }

    if (campaigns.length === 0) {
        _renderEmpty(rootEl, opts);
        return;
    }

    _renderChooser(rootEl, campaigns, opts);
}

function _renderChooser(rootEl, campaigns, opts) {
    const { setKeyHandler } = opts;
    rootEl.innerHTML = '<h2>ROBCO INDUSTRIES - UNIFIED OPERATING SYSTEM</h2><p>SELEZIONARE CAMPAGNA:</p>';
    const focusables = _appendCampaignButtons(rootEl, campaigns, opts);
    _appendStatusFooter(rootEl, focusables, opts);
    setKeyHandler(makeNavHandler(focusables));
    focusables[0].focus();
}

// Authenticated chooser: the flat /campaigns list is partitioned client-side
// into a public group and a private (assigned) group; each group shows an
// explicit empty string when it has no campaigns.
function _renderGrouped(rootEl, campaigns, opts) {
    const { setKeyHandler } = opts;
    rootEl.innerHTML = '<h2>ROBCO INDUSTRIES - UNIFIED OPERATING SYSTEM</h2><p>SELEZIONARE CAMPAGNA:</p>';

    const publicCampaigns  = campaigns.filter(_isPublic);
    const privateCampaigns = campaigns.filter(c => !_isPublic(c));
    const focusables = [];

    _appendGroupLabel(rootEl, 'CAMPAGNE PUBBLICHE');
    if (publicCampaigns.length) focusables.push(..._appendCampaignButtons(rootEl, publicCampaigns, opts));
    else _appendGroupEmpty(rootEl, 'Nessuna campagna pubblica');

    _appendGroupLabel(rootEl, 'CAMPAGNE PRIVATE');
    if (privateCampaigns.length) focusables.push(..._appendCampaignButtons(rootEl, privateCampaigns, opts));
    else _appendGroupEmpty(rootEl, 'Nessuna campagna privata');

    _appendStatusFooter(rootEl, focusables, opts);
    setKeyHandler(makeNavHandler(focusables));
    // The auth button is always present in the footer, so focusables is non-empty.
    focusables[0].focus();
}

function _renderEmpty(rootEl, opts) {
    const { setKeyHandler } = opts;
    rootEl.innerHTML = '<h2>ROBCO INDUSTRIES - UNIFIED OPERATING SYSTEM</h2><p>Nessuna campagna disponibile</p>';
    const focusables = [];
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.textContent = '[ Riprova ]';
    btn.addEventListener('mouseenter', selectionSound);
    btn.onclick = () => { clickSound(); mountCampaignSelect(rootEl, opts); };
    rootEl.appendChild(btn);
    focusables.push(btn);
    _appendStatusFooter(rootEl, focusables, opts);
    setKeyHandler(makeNavHandler(focusables));
    focusables[0].focus();
}

function _renderError(rootEl, onRetry, setKeyHandler) {
    rootEl.innerHTML = '<h2>RETE NON DISPONIBILE</h2><p>IMPOSSIBILE CARICARE LE CAMPAGNE</p>';
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.textContent = '[ Riprova ]';
    btn.addEventListener('mouseenter', selectionSound);
    btn.onclick = () => { clickSound(); onRetry(); };
    rootEl.appendChild(btn);
    setKeyHandler(makeNavHandler([btn]));
    btn.focus();
}

function _appendCampaignButtons(rootEl, campaigns, opts) {
    const { onCampaignSelected } = opts;
    return campaigns.map(campaign => {
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.textContent = `[ ${campaign.name} ]`;
        btn.addEventListener('mouseenter', selectionSound);
        btn.onclick = () => { clickSound(); onCampaignSelected(campaign); };
        rootEl.appendChild(btn);
        return btn;
    });
}

function _appendGroupLabel(rootEl, text) {
    const p = document.createElement('p');
    p.textContent = text;
    rootEl.appendChild(p);
}

function _appendGroupEmpty(rootEl, text) {
    const p = document.createElement('p');
    p.className = 'system-separator';
    p.textContent = text;
    rootEl.appendChild(p);
}

// Status footer: a glanceable "who am I" line (re-derived on every render so it
// tracks login/logout/rehydration) plus the auth action, rendered in both auth
// states (Decision 10). Campaign selection has no campaign context, so the line
// names only the user. Display field assumed `username` (falls back to `name`,
// then a generic authenticated label) — see design Decision 9.
function _appendStatusFooter(rootEl, focusables, opts) {
    const footer = document.createElement('footer');
    footer.className = 'boot-status-footer';
    footer.setAttribute('role', 'contentinfo');

    const who = document.createElement('p');
    who.className = 'who';
    who.textContent = _sessionLabel();
    footer.appendChild(who);

    _appendAuthButton(footer, rootEl, focusables, opts);
    rootEl.appendChild(footer);
}

function _sessionLabel() {
    if (!isAuthenticated()) return 'UTENTE ANONIMO';
    const user = getUser();
    const name = user && (user.username || user.name);
    return name ? `UTENTE ${name} AUTENTICATO` : 'UTENTE AUTENTICATO';
}

function _appendAuthButton(container, rootEl, focusables, opts) {
    const { onLogin, onLogout } = opts;
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
            // After logout re-mount to show the anonymous (public-only) view.
            mountCampaignSelect(rootEl, opts);
        } else {
            if (onLogin) await onLogin();
            // Re-mount whether the user logged in or cancelled: restores the
            // key handler and re-fetches in the correct (possibly authenticated) mode.
            mountCampaignSelect(rootEl, opts);
        }
    };

    container.appendChild(btn);
    focusables.push(btn);
}
