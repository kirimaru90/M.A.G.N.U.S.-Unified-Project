// TODO(openapi-gap): /species-catalog has no OpenAPI schema in reference/API-docs.json yet.
// Hand-typed to match specs/api-species-catalog/spec.md; regenerate (`npm run api:gen`) and
// replace with generated types once the backend spec declares this shape.

export interface SpeciesCatalogEntryDto {
  slug: string;
  name: string;
  /** The species' permanent benefit copy. */
  permesso: string;
  /** The species' drawback copy. */
  svantaggio: string;
  /** Maestria budget spendable across Tag Skills at creation (positive integer). */
  tagSkillBudget: number;
  description?: string;
}

export interface SpeciesCatalogEntryShape {
  name: string;
  permesso: string;
  svantaggio: string;
  tagSkillBudget: number;
  description?: string;
}

export interface SpeciesCatalogOp {
  action: 'add' | 'update' | 'rename' | 'delete';
  slug: string;
  rename?: string;
  entry?: SpeciesCatalogEntryShape;
}

export interface SpeciesCatalogIgnoredOp {
  slug: string;
  reason: 'unknown_slug';
}

export interface SpeciesCatalogPatchResponse {
  ignored: SpeciesCatalogIgnoredOp[];
}
