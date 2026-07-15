// TODO(openapi-gap): /talents-catalog has no OpenAPI schema in reference/API-docs.json yet.
// Hand-typed to match specs/api-talents-catalog/spec.md; regenerate (`npm run api:gen`) and
// replace with generated types once the backend spec declares this shape.
export interface TalentCatalogEntryDto {
  slug: string;
  name: string;
  description?: string;
}

export interface TalentCatalogEntryShape {
  name: string;
  description?: string;
}

export interface TalentsCatalogOp {
  action: 'add' | 'update' | 'rename' | 'delete';
  slug: string;
  rename?: string;
  entry?: TalentCatalogEntryShape;
}

export interface TalentsCatalogIgnoredOp {
  slug: string;
  reason: 'unknown_slug';
}

export interface TalentsCatalogPatchResponse {
  ignored: TalentsCatalogIgnoredOp[];
}
