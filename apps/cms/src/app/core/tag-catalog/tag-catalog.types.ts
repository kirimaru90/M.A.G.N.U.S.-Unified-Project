// TODO(openapi-gap): /tag-catalog types are hand-typed to match
// specs/api-tag-catalog/spec.md; regenerate (`npm run api:gen`) and replace with
// generated types once the pipeline consumes the updated backend spec.
export interface TagCatalogEntryDto {
  slug: string;
  name: string;
}

export interface TagCatalogEntryShape {
  name: string;
}

export interface TagCatalogOp {
  action: 'add' | 'update' | 'rename' | 'delete';
  slug: string;
  rename?: string;
  entry?: TagCatalogEntryShape;
}

export interface TagCatalogIgnoredOp {
  slug: string;
  reason: 'unknown_slug';
}

export interface TagCatalogPatchResponse {
  ignored: TagCatalogIgnoredOp[];
}
