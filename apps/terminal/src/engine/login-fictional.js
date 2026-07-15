import { apiPost } from '../api/client.js';

// Session-scoped login state, keyed by `${terminalId}:${username}` so one
// terminal's login never satisfies another terminal's gate. Both maps live for
// the page session only (never persisted) and reset on reload.
//
//  - authenticatedUsers: currently-logged-in entries. Cleared on disconnect
//    (logout); an entry present here satisfies that terminal's gates without
//    re-prompting while it stays connected.
//  - rememberedCredentials: the password the operator typed after a
//    server-validated success. Survives disconnect (cleared only on reload) so
//    reconnecting can pre-fill the login overlay without auto-bypassing.
const authenticatedUsers = new Map();
const rememberedCredentials = new Map();

function keyFor(terminalId, username) {
    return `${terminalId}:${username}`;
}

// Thrown by submitFictionalLogin() on a credential-rejection status (401) so the
// caller can distinguish a wrong password from a network/HTTP-5xx/parse failure.
// Mirrors src/api/session.js#InvalidCredentialsError (the real-user auth path).
export class InvalidCredentialsError extends Error {
    constructor() {
        super('invalid fictional credentials');
        this.name = 'InvalidCredentialsError';
    }
}

function getLoggedInUser(terminalId, loginBlock) {
    for (const u of loginBlock.users) {
        const name = typeof u === 'string' ? u : u.username;
        if (authenticatedUsers.has(keyFor(terminalId, name))) return name;
    }
    return null;
}

// Validate a fictional-login attempt against the server. The password never
// stays on the client: it is POSTed and the server decides. Resolves to the
// validated username on success; throws InvalidCredentialsError on a 401 and
// lets every other ApiError (network/HTTP-5xx/parse) propagate unchanged.
async function submitFictionalLogin(terminalId, username, password) {
    try {
        await apiPost('/terminals/' + encodeURIComponent(terminalId) + '/fictional-login', { username, password });
    } catch (err) {
        if (err && err.status === 401) throw new InvalidCredentialsError();
        throw err;
    }
    return username;
}

function recordLogin(terminalId, username, password) {
    authenticatedUsers.set(keyFor(terminalId, username), true);
    // Remember the operator-typed password so a later reconnect can pre-fill the
    // overlay. Only ever set from operator input in the current session.
    rememberedCredentials.set(keyFor(terminalId, username), password);
}

function getRememberedPassword(terminalId, username) {
    return rememberedCredentials.get(keyFor(terminalId, username));
}

// Clear the authenticated ("logged-in") set for a terminal — the logout on
// disconnect. Remembered credentials are intentionally kept so a reconnect can
// pre-fill. With no argument, clears every terminal's authentication.
function clearLogins(terminalId) {
    if (terminalId === undefined) {
        authenticatedUsers.clear();
        return;
    }
    const prefix = `${terminalId}:`;
    for (const k of authenticatedUsers.keys()) {
        if (k.startsWith(prefix)) authenticatedUsers.delete(k);
    }
}

export { getLoggedInUser, submitFictionalLogin, recordLogin, getRememberedPassword, clearLogins };
