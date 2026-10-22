import { apiGet, apiPost } from './client.js';

// Single owner of the real-user session: the bearer token (persisted in
// localStorage when the user chose "Ricordami", otherwise sessionStorage, so a
// reload can rehydrate it) and the current user (in memory).
// The assumed server contract — POST /auth/login -> { token, user }, GET /auth/me
// -> user, 401 on bad/expired credentials — is isolated here so a drift is a
// one-file fix.

const SESSION_KEY = 'robco_session';

let _currentUser = null;

// Declared as a hoisted function so client.js can import it across the
// session<->client circular import without a temporal-dead-zone hazard.
// localStorage first, then sessionStorage. Accessors, because touching a
// store can itself throw when storage is disabled by policy.
const STORES = [() => localStorage, () => sessionStorage];

export function getToken() {
    for (const store of STORES) {
        try {
            const token = store().getItem(SESSION_KEY);
            if (token) return token;
        } catch (_) {}
    }
    return null;
}

// Writes into localStorage when `remember`, sessionStorage otherwise, and
// removes the key from the other so at most one holds it. A null token clears both.
function _setToken(token, remember = false) {
    const target = remember ? 0 : 1;
    STORES.forEach((store, i) => {
        try {
            if (token && i === target) store().setItem(SESSION_KEY, token);
            else store().removeItem(SESSION_KEY);
        } catch (_) {}
    });
}

export function getUser() {
    return _currentUser;
}

export function isAuthenticated() {
    return !!getToken();
}

// Thrown by login() on a 401 so the caller can distinguish a credential
// rejection from a network/HTTP/parse failure.
export class InvalidCredentialsError extends Error {
    constructor() {
        super('invalid credentials');
        this.name = 'InvalidCredentialsError';
    }
}

export async function login(username, password, rememberMe = false) {
    let res;
    try {
        res = await apiPost('/auth/login', { username, password, rememberMe });
    } catch (err) {
        if (err && err.status === 401) throw new InvalidCredentialsError();
        throw err;
    }
    const token = res && (res.accessToken || res.token);
    if (!token) throw new Error('login response missing token');
    _setToken(token, rememberMe);
    // Seed with whatever the login response includes, then fetch /auth/me with
    // the now-valid token to guarantee the full display name is in memory.
    _currentUser = (res && res.user) || null;
    try {
        _currentUser = await apiGet('/auth/me');
    } catch (_) {
        // Unexpected: token was just issued. Keep the login-response user so
        // the session still works even if /auth/me is temporarily unreachable.
    }
    return _currentUser;
}

export async function logout() {
    // Best-effort server invalidation, but the local clear is guaranteed.
    try {
        await apiPost('/auth/logout', {});
    } catch (_) {}
    _setToken(null);
    _currentUser = null;
    navigator.serviceWorker?.controller?.postMessage({ type: 'FLUSH_CONTENT_CACHES' });
}

export async function rehydrate() {
    if (!getToken()) return null;
    try {
        _currentUser = await apiGet('/auth/me');
        return _currentUser;
    } catch (err) {
        if (err && err.status === 401) {
            // Expired/invalid stored credential: clear it and fall back to
            // anonymous silently — no error surfaced to the user.
            _setToken(null);
            _currentUser = null;
        }
        return null;
    }
}
