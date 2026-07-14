import { apiGet } from '../api/client.js';
import { makeNavHandler } from '../engine/keynav.js';
import { initSound, clickSound, hoverSound } from '../engine/sounds.js';
import { abortCurrentTyping } from '../engine/typewriter.js';

// Character picker for the personal terminal. Populated from
// GET /campaigns/:cid/characters (a player sees only their own characters).
// Renders into the existing boot/list container — no new index.html element,
// mirroring how mountTerminalList renders in place. API field names follow the
// server contract in reference/Swagger API.html.
export async function mountCharacterSelect(rootEl, opts) {
    const { campaignId, onCharacterSelected, onBack, setKeyHandler } = opts;
    abortCurrentTyping();
    initSound();
    rootEl.innerHTML = '<h2>ROBCO INDUSTRIES - UNIFIED OPERATING SYSTEM</h2><p>CONNESSIONE IN CORSO...</p><span class="cursor">_</span>';

    let characters;
    try {
        const res = await apiGet('/campaigns/' + encodeURIComponent(campaignId) + '/characters');
        characters = Array.isArray(res) ? res : [];
    } catch (error) {
        _renderError(rootEl, opts, error);
        return;
    }

    rootEl.innerHTML = '<h2>ROBCO INDUSTRIES - UNIFIED OPERATING SYSTEM</h2><p>SELEZIONARE PERSONAGGIO:</p>';

    const focusables = [];
    if (characters.length === 0) {
        const empty = document.createElement('p');
        empty.textContent = 'NESSUN PERSONAGGIO';
        rootEl.appendChild(empty);
    } else {
        characters.forEach(character => {
            const btn = document.createElement('button');
            btn.className = 'choice-btn';
            btn.textContent = `[ ${character.name} ]`;
            btn.addEventListener('mouseenter', hoverSound);
            btn.onclick = () => { clickSound(); onCharacterSelected(character); };
            rootEl.appendChild(btn);
            focusables.push(btn);
        });
    }

    // A back control is always present — including on the empty state — so the
    // user is never stranded.
    const backBtn = _appendBack(rootEl, onBack);
    focusables.push(backBtn);

    setKeyHandler(makeNavHandler(focusables));
    focusables[0].focus();
}

function _renderError(rootEl, opts, error) {
    const { onBack, setKeyHandler } = opts;
    rootEl.innerHTML = `<h2 style="color:red">ERRORE DI RETE</h2><p>Impossibile comunicare con il server.<br>${error.message}</p>`;
    const backBtn = _appendBack(rootEl, onBack);
    setKeyHandler(makeNavHandler([backBtn]));
    backBtn.focus();
}

function _appendBack(rootEl, onBack) {
    const backBtn = document.createElement('button');
    backBtn.className = 'choice-btn';
    backBtn.textContent = '[ Indietro ]';
    backBtn.addEventListener('mouseenter', hoverSound);
    backBtn.onclick = () => { clickSound(); onBack(); };
    rootEl.appendChild(backBtn);
    return backBtn;
}
