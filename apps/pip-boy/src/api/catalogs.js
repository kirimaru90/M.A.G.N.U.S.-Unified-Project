import { apiGet } from './client.js';

export function getSkillsCatalog() {
    return apiGet('/skills-catalog');
}

export function getConditionsCatalog() {
    return apiGet('/conditions-catalog');
}

export function getTagCatalog() {
    return apiGet('/tag-catalog');
}

// The talents catalog may not exist server-side yet: a `400`/404/absent endpoint
// (or any failure) degrades to an empty list rather than surfacing an error. The
// talents add popup simply renders an empty "Scegli esistente" tab in that case,
// while its "Aggiungi custom" tab stays fully usable. Populating this catalog is
// a backend follow-up that needs no client change.
export async function getTalentsCatalog() {
    try {
        const res = await apiGet('/talents-catalog');
        if (Array.isArray(res)) return res;
        return Array.isArray(res?.items) ? res.items : [];
    } catch (_) {
        return [];
    }
}
