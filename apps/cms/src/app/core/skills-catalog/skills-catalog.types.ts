// TODO(openapi-gap): /skills-catalog has no OpenAPI schema in reference/API-docs.json yet.
// Hand-typed to match specs/api-skills-catalog/spec.md; regenerate (`npm run api:gen`) and
// replace with generated types once the backend spec declares this shape.
export interface SkillCatalogEntryDto {
  slug: string;
  name: string;
  description?: string;
}

export interface SkillCatalogEntryShape {
  name: string;
  description?: string;
}

export interface SkillsCatalogOp {
  action: 'add' | 'update' | 'rename' | 'delete';
  slug: string;
  rename?: string;
  entry?: SkillCatalogEntryShape;
}

export interface SkillsCatalogIgnoredOp {
  slug: string;
  reason: 'unknown_slug';
}

export interface SkillsCatalogPatchResponse {
  ignored: SkillsCatalogIgnoredOp[];
}
