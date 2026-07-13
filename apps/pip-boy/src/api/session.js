import { apiGet, apiPost } from './client.js';

// Single owner of the real-user session: the bearer token (persisted in
// sessionStorage so a reload can rehydrate it) and the current user (in memory).

const SESSION_KEY = 'pipboy_session';

let _currentUser = null;

// Declared as a hoisted function so client.js can import it across the
// session<->client circular import without a temporal-dead-zone hazard.
export function getToken() {
    try {
        return sessionStorage.getItem(SESSION_KEY) || null;
    } catch (_) {
        return null;
    }
}

function _setToken(token) {
    try {
        if (token) sessionStorage.setItem(SESSION_KEY, token);
        else sessionStorage.removeItem(SESSION_KEY);
    } catch (_) {}
}

export function getUser() {
    return _currentUser;
}

export function isAuthenticated() {
    return !!getToken();
}

export function isAdmin() {
    return _currentUser?.role === 'admin';
}

// Thrown by login() on a 401 so the caller can distinguish a credential
// rejection from a network/HTTP/parse failure.
export class InvalidCredentialsError extends Error {
    constructor() {
        super('invalid credentials');
        this.name = 'InvalidCredentialsError';
    }
}

export async function login(username, password) {
    let res;
    try {
        res = await apiPost('/auth/login', { username, password });
    } catch (err) {
        if (err && err.status === 401) throw new InvalidCredentialsError();
        throw err;
    }
    const token = res && (res.accessToken || res.token);
    if (!token) throw new Error('login response missing token');
    _setToken(token);
    _currentUser = await apiGet('/auth/me');
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

export async function refreshUser() {
    _currentUser = await apiGet('/auth/me');
    return _currentUser;
}

// Re-verify the stored session on resume/reopen. Reuses the exact 401-vs-transport
// discrimination as rehydrate(), but reports the outcome so the caller can decide
// what to do with the currently rendered screen:
//   - { status: 'anonymous' } — no token stored; no request is issued.
//   - { status: 'ok', user }  — the token is still valid; the in-memory user is refreshed.
//   - { status: 'expired' }   — a 401; the local session is cleared.
//   - { status: 'error' }     — a transport/HTTP failure that is not a 401 (a
//                               transient offline blip); the session is left intact.
export async function reverify() {
    if (!getToken()) return { status: 'anonymous' };
    try {
        _currentUser = await apiGet('/auth/me');
        return { status: 'ok', user: _currentUser };
    } catch (err) {
        if (err && err.status === 401) {
            _setToken(null);
            _currentUser = null;
            return { status: 'expired' };
        }
        // No 401 (transport error, or a non-401 HTTP status): a transient failure
        // is not an expired session, so keep the local session and stay put.
        return { status: 'error' };
    }
}
