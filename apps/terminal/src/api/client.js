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

// Resolve a request path against API_BASE_URL. Supports an absolute base
// ('https://api.example.com', for cross-origin deploys) and, by default, a
// relative base ('/api') that keeps requests same-origin through the edge proxy.
// `new URL(path, base)` cannot be used for a relative base, so join by hand.
function _url(path) {
    if (!API_BASE_URL) return path;
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(API_BASE_URL)) return new URL(path, API_BASE_URL).href;
    return API_BASE_URL.replace(/\/+$/, '') + '/' + String(path).replace(/^\/+/, '');
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

export async function apiPut(path, body) {
    const url = _url(path);
    let response;
    try {
        response = await fetch(url, {
            method: 'PUT',
            headers: _headers({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(body),
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

export async function apiPost(path, body) {
    const url = _url(path);
    let response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: _headers({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(body),
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
        throw new ApiError('parse', path);
    }
}
