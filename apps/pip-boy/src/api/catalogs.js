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
