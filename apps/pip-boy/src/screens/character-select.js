import { mount, esc } from '../engine/render.js';
import { listCharacters, getCharacter, deleteCharacter } from '../api/characters.js';
import { listPlayers } from '../api/campaigns.js';
import { logout, isAdmin } from '../api/session.js';
import { APPROACHES } from '../sheet/model.js';

function miniSpecial(special = {}) {
    return `
        <div class="pb-mini-special">
            ${APPROACHES.map((a) => `
                <span class="pb-mini-stat">
                    <span class="pb-mini-letter vt">${a.letter}</span>
                    <span class="pb-mini-value vt">${special[a.key] ?? 0}</span>
                </span>
            `).join('')}
        </div>
    `;
}

function characterCard(c, skillsCatalog) {
    const ap = c.actionPoints ?? {};
    const trained = (c.skills ?? [])
        .map((s) => skillsCatalog.find((sc) => sc.slug === s.id)?.name ?? s.id)
        .join(' · ');

    return `
        <div class="pb-dossier-card" data-id="${esc(c.id)}">
            <div class="pb-split-row">
                <strong>${esc(c.name)}</strong>
                <button class="pb-btn pb-btn--danger pb-btn--icon" data-delete="${esc(c.id)}" title="Elimina">✕</button>
            </div>
            <div class="pb-label">
                ${esc(c.species ?? '')} · PA ${ap.paMax ?? 0} · TAPPI ${c.resources?.caps ?? 0}
            </div>
            ${miniSpecial(c.special)}
            ${trained ? `<div class="pb-label pb-dossier-skills">${esc(trained)}</div>` : ''}
        </div>
    `;
}

export async function renderCharacterSelect(root, opts) {
    const { campaignId, campaignName, skillsCatalog = [], onSelect, onCreate, onBack, onLogout } = opts;

    mount(root, `
        <div class="pb-header">
            <div class="pb-header-top">
                <h2>${esc(campaignName)}</h2>
                <button class="pb-btn" id="pb-char-logout">ESCI</button>
            </div>
            <div class="pb-label">DOSSIER</div>
        </div>
        <div class="pb-screen-content">
            <div class="pb-list" id="pb-char-list">
                <div class="pb-label">Caricamento…</div>
            </div>
            <button class="pb-btn pb-btn--dashed pb-btn--block" id="pb-char-create" style="margin-top:10px;">+ NUOVO PERSONAGGIO</button>
            <button class="pb-btn" id="pb-char-back" style="margin-top:14px;">◄ CAMBIA CAMPAGNA</button>
        </div>
    `);

    root.querySelector('#pb-char-logout').addEventListener('click', async () => {
        await logout();
        onLogout();
    });
    root.querySelector('#pb-char-back').addEventListener('click', onBack);

    const listEl = root.querySelector('#pb-char-list');
    const createBtn = root.querySelector('#pb-char-create');

    function showError(message) {
        const el = document.createElement('div');
        el.className = 'pb-error';
        el.textContent = message;
        listEl.appendChild(el);
    }

    /**
     * An admin must choose the owning player before the wizard begins; a player
     * always creates for themselves. Creation stays blocked when the campaign
     * has no assigned players.
     */
    async function startCreate() {
        if (!isAdmin()) return onCreate(null);

        let players;
        try {
            players = await listPlayers(campaignId);
        } catch (_) {
            showError('ERRORE DI CONNESSIONE — impossibile caricare i giocatori');
            return;
        }

        if (!players || players.length === 0) {
            showError('Nessun giocatore assegnato a questa campagna — assegnane uno dal CMS');
            return;
        }

        listEl.innerHTML = `
            <div class="pb-label">Seleziona il giocatore proprietario</div>
            ${players.map((p) => `
                <div class="pb-select-item" data-owner="${esc(p.id)}">
                    <span>${esc(p.username)}</span>
                    <span class="pb-label">▸</span>
                </div>
            `).join('')}
        `;
        createBtn.hidden = true;

        listEl.querySelectorAll('[data-owner]').forEach((el) => {
            el.addEventListener('click', () => onCreate(el.dataset.owner));
        });
    }

    createBtn.addEventListener('click', startCreate);

    async function load() {
        let characters;
        try {
            characters = await listCharacters(campaignId);
        } catch (_) {
            listEl.innerHTML = '<div class="pb-error">ERRORE DI CONNESSIONE — impossibile caricare i personaggi</div>';
            return;
        }

        if (!characters || characters.length === 0) {
            listEl.innerHTML = `
                <div class="pb-empty-dashed" id="pb-dossier-empty">
                    <div>NESSUN DOSSIER REGISTRATO</div>
                    <div>Crea il tuo primo personaggio.</div>
                </div>
            `;
            return;
        }

        listEl.innerHTML = characters.map((c) => characterCard(c, skillsCatalog)).join('');

        // The ✕ delete control must not open the card beneath it.
        listEl.querySelectorAll('[data-delete]').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    await deleteCharacter(campaignId, btn.dataset.delete);
                } catch (_) {
                    showError('ERRORE — eliminazione fallita');
                    return;
                }
                await load();
            });
        });

        listEl.querySelectorAll('.pb-dossier-card').forEach((card) => {
            card.addEventListener('click', async () => {
                try {
                    const full = await getCharacter(campaignId, card.dataset.id);
                    onSelect(full);
                } catch (_) {
                    showError('ERRORE — impossibile aprire il personaggio');
                }
            });
        });
    }

    await load();
}
