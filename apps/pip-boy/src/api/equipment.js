import { apiGet } from './client.js';

/**
 * The starter equipment templates offered by the creation wizard. Read-only:
 * templates are authored only in the CMS (`api-equipment-catalog`), and the
 * wizard *copies* a chosen template onto the character rather than linking it.
 */
export function getStarterEquipment() {
    return apiGet('/equipment-catalog?starter=true');
}
