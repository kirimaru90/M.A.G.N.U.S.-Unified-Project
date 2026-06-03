import { abortCurrentTyping } from './engine/typewriter.js';
import { dataTerminalSound } from './engine/sounds.js';
import { makeNavHandler } from './engine/keynav.js';
import { getLoggedInUser } from './engine/login-fictional.js';
import { apiGet } from './api/client.js';
import { rehydrate, logout as sessionLogout, getUser } from './api/session.js';
import { mountCampaignSelect } from './screens/campaign-select.js';
import { mountTerminalList } from './screens/terminal-list.js';
import { mountTerminal } from './screens/terminal.js';
import { mountLoginFictional } from './screens/login-fictional.js';
import { mountLoginReal } from './screens/login-real.js';
import * as store from './state/store.js';
import { API_BASE_URL } from './api/config.js';
import { DEFAULT_CONFIG } from './config.js';
import { mountCrtWave } from './engine/crt-wave.js';
import { setCrtWaveHandle, applyConfig, resetToDefaults, getConfig } from './state/config.js';
import { getUserConfig, getCampaignConfig } from './api/configuration.js';
import { mountOptions } from './screens/options.js';
import { openWaveTuner } from './screens/wave-tuner.js';

document.addEventListener('DOMContentLoaded', () => {
    // Task 3.4: No token and no campaign on cold boot → apply defaults immediately.
    applyConfig(DEFAULT_CONFIG);

    // Mount the CRT wave engine and register it with the config service.
    const crtWave = mountCrtWave(document.body, {}, { startEnabled: DEFAULT_CONFIG.crtEffectsEnabled });
    setCrtWaveHandle(crtWave);

    let currentCampaign = null;

    // Wire the Options screen ('o' key handler registered inside mountOptions).
    mountOptions({
        onOpenTuner: () => openWaveTuner(),
        getCampaignId: () => currentCampaign && currentCampaign.id,
    });

    const campaignSelectEl = document.getElementById('campaign-select-screen');
    const bootEl           = document.getElementById('boot-screen');
    const loginEl          = document.getElementById('login-screen');
    const loginRealEl      = document.getElementById('login-real-screen');
    const terminalEl       = document.getElementById('terminal-container');
    const contentEl        = document.getElementById('screen-content');
    const choicesEl        = document.getElementById('choices-container');

    let _currentKeyHandler = null;
    function setKeyHandler(handler) {
        if (_currentKeyHandler) document.removeEventListener('keydown', _currentKeyHandler);
        _currentKeyHandler = handler;
        if (handler) document.addEventListener('keydown', handler);
    }

    const terminal = mountTerminal(contentEl, choicesEl, terminalEl, {
        onDisconnect: showTerminalList,
        onRequestLogin(loginBlock, terminalId, onSuccess, onBack) {
            loginEl.style.display = 'flex';
            terminalEl.style.display = 'none';
            login.showLogin(loginBlock, terminalId, (username) => {
                loginEl.style.display = 'none';
                terminalEl.style.display = 'block';
                onSuccess(username);
            }, () => {
                loginEl.style.display = 'none';
                terminalEl.style.display = 'block';
                onBack();
            });
        },
        setKeyHandler,
    });

    const login     = mountLoginFictional(loginEl, { setKeyHandler });
    const loginReal = mountLoginReal(loginRealEl, { setKeyHandler });

    // Returns an onLogin() that resolves after the user logs in or cancels.
    // landAfterLogin: if true and login succeeds, attempt last-campaign landing before resolving.
    function makeOnLogin(screenEl, { landAfterLogin = false } = {}) {
        return () => new Promise(resolve => {
            screenEl.style.display = 'none';
            loginRealEl.style.display = 'flex';
            loginReal.showLogin(
                async () => {
                    loginRealEl.style.display = 'none';
                    // Task 3.1: On login success → load user config.
                    try {
                        const cfg = await getUserConfig();
                        if (cfg) applyConfig(cfg);
                    } catch (_) {}
                    if (landAfterLogin && await tryLandOnLastCampaign(getUser())) {
                        resolve();
                        return;
                    }
                    screenEl.style.display = 'flex';
                    resolve();
                },
                () => { loginRealEl.style.display = 'none'; screenEl.style.display = 'flex'; resolve(); },
            );
        });
    }

    // Attempts to land on the user's last campaign. Returns the campaign object if
    // landing succeeded, falsy otherwise. Falls back silently on any error.
    async function tryLandOnLastCampaign(user) {
        if (!user || !user.lastCampaignId) return null;
        try {
            const campaigns = await apiGet('/campaigns');
            const campaign = campaigns.find(c => c.id === user.lastCampaignId);
            if (!campaign) return null;
            await onCampaignSelected(campaign);
            return campaign;
        } catch (_) {
            return null;
        }
    }

    // Task 3.3: On logout → reset to defaults, no API call.
    async function onLogout() {
        store.clear();
        await sessionLogout();
        resetToDefaults();
        applyConfig(getConfig());
    }

    function showCampaignSelect() {
        store.clear();
        abortCurrentTyping();
        terminalEl.style.display = 'none';
        loginEl.style.display = 'none';
        loginRealEl.style.display = 'none';
        bootEl.style.display = 'none';
        campaignSelectEl.style.display = 'flex';
        mountCampaignSelect(campaignSelectEl, {
            onCampaignSelected, setKeyHandler,
            onLogin: makeOnLogin(campaignSelectEl, { landAfterLogin: true }), onLogout,
        });
    }

    function showTerminalList() {
        store.clear();
        campaignSelectEl.style.display = 'none';
        loginEl.style.display = 'none';
        terminalEl.style.display = 'none';
        bootEl.style.display = 'flex';
        mountTerminalList(bootEl, {
            campaignId: currentCampaign.id,
            campaignName: currentCampaign.name,
            campaignIsPublic: currentCampaign.isPublic,
            onTerminalSelected: handleTerminalSelected,
            onTerminalDataLoaded: playTerminalData,
            onBack: showCampaignSelect,
            onLogin: makeOnLogin(bootEl),
            onLogout,
            setKeyHandler,
        });
    }

    // Task 3.2: On campaign load → fetch campaign config and apply.
    async function onCampaignSelected(campaign) {
        currentCampaign = campaign;
        try {
            const cfg = await getCampaignConfig(campaign.id);
            if (cfg) applyConfig(cfg);
        } catch (_) {}
        showTerminalList();
    }

    async function handleTerminalSelected(terminalId) {
        try {
            const rawData = await apiGet('/terminals/' + encodeURIComponent(terminalId) + '/load');
            playTerminalData(rawData);
        } catch (error) {
            abortCurrentTyping();
            bootEl.innerHTML = `<h2 style="color:red">ERRORE LETTURA</h2><p>${error.message}</p>`;
            const backBtn = document.createElement('button');
            backBtn.className = 'choice-btn';
            backBtn.textContent = '[ Torna al menu ]';
            backBtn.onclick = showTerminalList;
            bootEl.appendChild(backBtn);
            setKeyHandler(makeNavHandler([backBtn]));
            backBtn.focus();
        }
    }

    function playTerminalData(rawData) {
        bootEl.innerHTML = '<p>ESTRAZIONE DATI IN CORSO...</p><span class="cursor">_</span>';
        bootEl.style.display = 'flex';
        dataTerminalSound();

        try {
            const nodes = rawData.content.nodes;
            const globalLogin = rawData.content.login;
            const terminalId = rawData.content.meta.id;

            if (!nodes['start']) throw new Error("Nodo 'start' mancante");

            store.seed({ localState: rawData.localState, globalState: rawData.globalState });
            terminal.loadTapeData(nodes, terminalId, currentCampaign.id);

            setTimeout(() => {
                if (globalLogin && globalLogin.users && globalLogin.users.length > 0) {
                    const loggedUser = getLoggedInUser(globalLogin);
                    if (!loggedUser) {
                        loginEl.style.display = 'flex';
                        bootEl.style.display = 'none';
                        login.showLogin(globalLogin, terminalId, (username) => {
                            loginEl.style.display = 'none';
                            terminalEl.style.display = 'block';
                            terminal.showAlreadyLoggedIn(username, () => terminal.loadNode('start'));
                        }, () => {
                            loginEl.style.display = 'none';
                            abortCurrentTyping();
                            showTerminalList();
                        });
                        return;
                    }
                }
                bootEl.style.display = 'none';
                terminalEl.style.display = 'block';
                terminal.loadNode('start');
            }, 1500);

        } catch (error) {
            abortCurrentTyping();
            bootEl.innerHTML = `<h2 style="color:red">ERRORE LETTURA</h2><p>${error.message}</p>`;
            const backBtn = document.createElement('button');
            backBtn.className = 'choice-btn';
            backBtn.textContent = '[ Torna al menu ]';
            backBtn.onclick = showTerminalList;
            bootEl.appendChild(backBtn);
            setKeyHandler(makeNavHandler([backBtn]));
            backBtn.focus();
        }
    }

    // Boot: rehydrate session, then load user config if authenticated.
    (async () => {
        try {
            const user = await rehydrate();
            // Task 3.1: rehydrated with a valid token → load user config.
            if (user) {
                try {
                    const cfg = await getUserConfig();
                    if (cfg) applyConfig(cfg);
                } catch (_) {}
                // Task 3.4: no user → DEFAULT_CONFIG already applied above.
                if (await tryLandOnLastCampaign(user)) return;
            }
        } catch (_) {}
        showCampaignSelect();
    })();

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            const apiOrigin = new URL(API_BASE_URL || self.location.origin).origin;
            const swUrl = 'sw.js?api=' + encodeURIComponent(apiOrigin);
            navigator.serviceWorker.register(swUrl, { scope: './' }).catch(() => {});
        });
    }
});
