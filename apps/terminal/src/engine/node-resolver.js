import { evaluate } from '../state/conditions.js';
import { apiPost } from '../api/client.js';
import { applyScope, refreshScope } from '../state/store.js';

export const RERENDER_REQUIRED = 'RERENDER_REQUIRED';
export const INLINE_ERROR = 'INLINE_ERROR';

export function resolveNode(node, snapshot) {
    const variants = node.variants;
    if (variants && variants.length > 0) {
        for (const variant of variants) {
            if (!variant.default && variant.when && evaluate(variant.when, snapshot)) {
                return {
                    text: variant.text !== undefined ? variant.text : node.text,
                    choices: variant.choices !== undefined ? variant.choices : node.choices,
                    components: variant.components !== undefined ? variant.components : node.components,
                };
            }
        }
        const defaultVariant = variants.find(v => v.default === true);
        if (defaultVariant) {
            return {
                text: defaultVariant.text !== undefined ? defaultVariant.text : node.text,
                choices: defaultVariant.choices !== undefined ? defaultVariant.choices : node.choices,
                components: defaultVariant.components !== undefined ? defaultVariant.components : node.components,
            };
        }
    }
    return { text: node.text, choices: node.choices, components: node.components };
}

async function handleScopeError(error, scope, id) {
    if (error.kind === 'http' && error.status >= 400 && error.status < 500) {
        try {
            await refreshScope(scope, id);
            return RERENDER_REQUIRED;
        } catch (_) {
            return INLINE_ERROR;
        }
    }
    return INLINE_ERROR;
}

async function postScope(scope, id, mutations) {
    const path = scope === 'local'
        ? '/terminals/' + encodeURIComponent(id) + '/state/mutate'
        : '/campaigns/' + encodeURIComponent(id) + '/state/mutate';
    const response = await apiPost(path, { mutations });
    if (response && response.state) {
        applyScope(scope, response.state);
    }
}

async function dispatch(mutations, terminalId, campaignId) {
    for (const m of mutations) {
        if (!m.key || (!m.key.startsWith('local.') && !m.key.startsWith('global.'))) {
            throw new Error('Invalid mutation key: ' + m.key);
        }
    }

    const localMuts = mutations.filter(m => m.key.startsWith('local.'));
    const globalMuts = mutations.filter(m => m.key.startsWith('global.'));

    const tasks = [];
    if (localMuts.length > 0) tasks.push({ scope: 'local', id: terminalId, muts: localMuts });
    if (globalMuts.length > 0) tasks.push({ scope: 'global', id: campaignId, muts: globalMuts });

    if (tasks.length === 0) return null;

    const results = await Promise.allSettled(tasks.map(t => postScope(t.scope, t.id, t.muts)));

    let sentinel = null;
    for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status === 'rejected') {
            const t = tasks[i];
            const s = await handleScopeError(r.reason, t.scope, t.id);
            if (s === RERENDER_REQUIRED) return RERENDER_REQUIRED;
            if (s === INLINE_ERROR) sentinel = INLINE_ERROR;
        }
    }
    return sentinel;
}

export async function dispatchOnEnter(node, terminalId, campaignId) {
    const mutations = node.on_enter ?? [];
    if (mutations.length === 0) return null;
    return dispatch(mutations, terminalId, campaignId);
}

export async function dispatchChoiceSet(choice, terminalId, campaignId) {
    const mutations = choice.set ?? [];
    if (mutations.length === 0) return null;
    return dispatch(mutations, terminalId, campaignId);
}

export const dispatchMutations = dispatch;
