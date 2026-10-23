// The current screen's navigation actions. A pure store: it drives no DOM.
// The settings popup reads it to build its navigation section, and back.js
// reads `up` for the system back action (pipboy-app-shell). Every screen
// transition in main.js sets it.

import { sync } from './back.js';

let current = { up: null, changeCharacter: null, changeCampaign: null, logout: null };

/**
 * Record the mounted screen's actions. Each entry is a function or `null`
 * (absent): `up` is the system back action's "up one level", the other three
 * are the settings popup's CAMBIA PERSONAGGIO / CAMBIA CAMPAGNA / ESCI.
 */
export function setScreenNav({ up = null, changeCharacter = null, changeCampaign = null, logout = null } = {}) {
    current = { up, changeCharacter, changeCampaign, logout };
    // Whether a back target exists may have changed: keep the guard entry in step.
    sync();
}

export function getScreenNav() {
    return current;
}
