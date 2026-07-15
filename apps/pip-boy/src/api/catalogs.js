import { apiGet } from './client.js';

// All catalog reads request `orderBy=name` so autocomplete lists arrive already
// alphabetical (Italian, case/accent-insensitive) from the server. The picker
// still sorts defensively, so client-only/fallback lists stay ordered too.
export function getSkillsCatalog() {
    return apiGet('/skills-catalog?orderBy=name');
}

export function getConditionsCatalog() {
    return apiGet('/conditions-catalog?orderBy=name');
}

export function getTagCatalog() {
    return apiGet('/tag-catalog?orderBy=name');
}

// The talents catalog is now backed server-side (`api-talents-catalog`) but may
// still be empty (content is authored via the CMS). The fetch stays defensive:
// any failure/absent endpoint degrades to an empty list rather than surfacing an
// error, so the talents add popup renders an empty "Scegli esistente" tab in that
// case while its "Aggiungi custom" tab stays fully usable.
export async function getTalentsCatalog() {
    try {
        const res = await apiGet('/talents-catalog?orderBy=name');
        if (Array.isArray(res)) return res;
        return Array.isArray(res?.items) ? res.items : [];
    } catch (_) {
        return [];
    }
}
