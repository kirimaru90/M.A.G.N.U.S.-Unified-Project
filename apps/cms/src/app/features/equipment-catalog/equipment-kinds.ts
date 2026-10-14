import type { EquipmentKind } from '../../core/equipment-catalog/equipment-catalog.types';

/**
 * Weapons and armor carry tags; consumables and misc (Vari) carry a quantity and
 * an optional description instead.
 */
export const isTagged = (kind: EquipmentKind): boolean => kind === 'weapon' || kind === 'armor';

/** The four catalog kinds, with the Italian label the UI shows for each. */
export const KIND_OPTIONS: readonly { value: EquipmentKind; label: string }[] = [
  { value: 'weapon', label: 'weapon' },
  { value: 'armor', label: 'armor' },
  { value: 'consumable', label: 'consumable' },
  { value: 'misc', label: 'Vari' },
];
