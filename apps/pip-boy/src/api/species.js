import { apiGet } from './client.js';

/** The global species catalog. Read-only here: authoring lives in the CMS. */
export function getSpeciesCatalog() {
    return apiGet('/species-catalog');
}
