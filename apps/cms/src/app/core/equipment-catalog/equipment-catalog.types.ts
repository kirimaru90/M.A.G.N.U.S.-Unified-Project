// TODO(openapi-gap): /equipment-catalog has no OpenAPI schema in reference/API-docs.json yet.
// Hand-typed to match specs/api-equipment-catalog/spec.md; regenerate (`npm run api:gen`) and
// replace with generated types once the backend spec declares this shape.

export type EquipmentKind = 'weapon' | 'armor' | 'consumable' | 'misc';
export type EquipmentTagType = 'core' | 'extra';

export interface EquipmentTagDto {
  name: string;
  type: EquipmentTagType;
}

export interface EquipmentCatalogEntryDto {
  slug: string;
  name: string;
  kind: EquipmentKind;
  /** Meaningful for weapon/armor; always empty for consumable/misc. */
  tags?: EquipmentTagDto[];
  /** Marks the template as offered by the pip-boy creation wizard. */
  isStarter: boolean;
  /** Sole descriptive field for consumable/misc; MAY be present on any kind. */
  description?: string;
}

/** The full entry an `add` op must carry. */
export interface EquipmentCatalogEntryShape {
  name: string;
  kind: EquipmentKind;
  tags?: EquipmentTagDto[];
  isStarter?: boolean;
  description?: string;
}

/** An `update` op merges into the stored entry, so every field is optional. */
export type EquipmentCatalogEntryPatch = Partial<EquipmentCatalogEntryShape>;

export interface EquipmentCatalogOp {
  action: 'add' | 'update' | 'rename' | 'delete';
  slug: string;
  rename?: string;
  entry?: EquipmentCatalogEntryPatch;
}

export interface EquipmentCatalogIgnoredOp {
  slug: string;
  reason: 'unknown_slug';
}

export interface EquipmentCatalogPatchResponse {
  ignored: EquipmentCatalogIgnoredOp[];
}
