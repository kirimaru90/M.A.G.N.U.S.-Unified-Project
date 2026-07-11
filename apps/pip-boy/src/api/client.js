import { API_BASE_URL } from './config.js';
import { getToken } from './session.js';

// Build request headers, attaching the bearer credential only when a session
// token exists. Imports just getToken from session.js (a pure accessor) to keep
// this module a transport wrapper and avoid the login logic / circular import.
function _headers(extra) {
    const headers = { 'Accept': 'application/json', ...extra };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

export class ApiError extends Error {
    constructor(kind, path, extras = {}) {
        super(`API ${kind}: ${path}${extras.status ? ` (${extras.status})` : ''}`);
        this.kind = kind;
        this.path = path;
        this.status = extras.status;
        this.body = extras.body;
    }
}

function _url(path) {
    return API_BASE_URL ? new URL(path, API_BASE_URL).href : path;
}

async function _send(method, path, body) {
    const url = _url(path);
    let response;
    try {
        response = await fetch(url, {
            method,
            headers: _headers(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
    } catch (_) {
        throw new ApiError('network', path);
    }
    if (!response.ok) {
        let respBody;
        try { respBody = await response.json(); } catch (_) { respBody = await response.text().catch(() => null); }
        throw new ApiError('http', path, { status: response.status, body: respBody });
    }
    try {
        return await response.json();
    } catch (_) {
        return null;
    }
}

export async function apiGet(path) {
    const url = _url(path);
    let response;
    try {
        response = await fetch(url, { headers: _headers() });
    } catch (_) {
        throw new ApiError('network', path);
    }
    if (!response.ok) {
        let body;
        try { body = await response.json(); } catch (_) { body = await response.text().catch(() => null); }
        throw new ApiError('http', path, { status: response.status, body });
    }
    try {
        return await response.json();
    } catch (_) {
        throw new ApiError('parse', path);
    }
}

export function apiPost(path, body) {
    return _send('POST', path, body ?? {});
}

export function apiPut(path, body) {
    return _send('PUT', path, body ?? {});
}

export function apiPatch(path, body) {
    return _send('PATCH', path, body ?? {});
}

export function apiDelete(path) {
    return _send('DELETE', path);
}
