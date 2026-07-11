// TODO(openapi-gap): /conditions-catalog has no OpenAPI schema in reference/API-docs.json yet.
// Hand-typed to match specs/api-conditions-catalog/spec.md; regenerate (`npm run api:gen`) and
// replace with generated types once the backend spec declares this shape.
export type ConditionSeverity = 'minor' | 'major';
export type ConditionPolarity = 'positive' | 'negative';

export interface ConditionCatalogEntryDto {
  slug: string;
  name: string;
  defaultSeverity: ConditionSeverity;
  polarity: ConditionPolarity;
  description?: string;
}

export interface ConditionCatalogEntryShape {
  name: string;
  defaultSeverity: ConditionSeverity;
  polarity: ConditionPolarity;
  description?: string;
}

export interface ConditionsCatalogOp {
  action: 'add' | 'update' | 'rename' | 'delete';
  slug: string;
  rename?: string;
  entry?: ConditionCatalogEntryShape;
}

export interface ConditionsCatalogIgnoredOp {
  slug: string;
  reason: 'unknown_slug';
}

export interface ConditionsCatalogPatchResponse {
  ignored: ConditionsCatalogIgnoredOp[];
}
