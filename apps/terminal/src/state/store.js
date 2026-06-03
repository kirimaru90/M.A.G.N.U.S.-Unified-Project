import { apiGet } from '../api/client.js';

const store = { local: {}, global: {} };

export function seed(envelope) {
    store.local = (envelope && envelope.localState) ? { ...envelope.localState } : {};
    store.global = (envelope && envelope.globalState) ? { ...envelope.globalState } : {};
}

export function clear() {
    store.local = {};
    store.global = {};
}

export function getLocal(name) {
    return store.local[name];
}

export function getGlobal(name) {
    return store.global[name];
}

export function getSnapshot() {
    return { local: { ...store.local }, global: { ...store.global } };
}

// Replace one scope from the flat map returned by POST .../state/mutate
// (response body shape: { state: { varName: value, ... } }) or by
// GET .../state (which returns the flat map directly).
export function applyScope(scope, flatState) {
    if (scope !== 'local' && scope !== 'global') {
        throw new Error('Invalid scope: ' + scope);
    }
    store[scope] = flatState ? { ...flatState } : {};
}

export async function refreshScope(scope, id) {
    const path = scope === 'local'
        ? '/terminals/' + encodeURIComponent(id) + '/state'
        : '/campaigns/' + encodeURIComponent(id) + '/state';
    const flat = await apiGet(path);
    store[scope] = flat ? { ...flat } : {};
}
