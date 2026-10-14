// Shared by the six game-data catalog screens (tag, skills, talents, species,
// conditions, equipment). Every catalog PATCH takes the same op shape.

export type CatalogAction = 'add' | 'update' | 'rename' | 'delete';

export interface CatalogOp<E> {
  action: CatalogAction;
  slug: string;
  rename?: string;
  entry?: E;
}

/**
 * The ops that save an entry dialog. `original` is the slug being edited, or
 * `null` when creating.
 *
 * A changed slug becomes `rename` followed by `update` on the new slug, in one
 * batch: `rename` alone preserves the old entry data and would drop every other
 * field edited alongside it. The API applies ops in order and persists only if
 * all succeed, so the pair is atomic.
 */
export function catalogEditOps<E>(original: string | null, slug: string, entry: E): CatalogOp<E>[] {
  if (original === null) return [{ action: 'add', slug, entry }];
  if (original === slug) return [{ action: 'update', slug, entry }];
  return [
    { action: 'rename', slug: original, rename: slug },
    { action: 'update', slug, entry },
  ];
}

export interface CatalogErrorContext {
  /** The slug that may have conflicted — for a rename, the new one. */
  slug?: string;
  action?: CatalogAction;
  /** Message for a 409 on delete, for catalogs that refuse deleting in-use entries. */
  inUseMessage?: string;
}

export function catalogErrorMessage(err: unknown, ctx: CatalogErrorContext = {}): string {
  const status = (err as { status?: number } | null)?.status;
  if (status === 409) {
    if (ctx.action === 'delete' && ctx.inUseMessage) return ctx.inUseMessage;
    return ctx.slug ? `Slug "${ctx.slug}" già esistente` : 'Slug già esistente';
  }
  if (status === 400) return 'Dati non validi';
  return 'Errore imprevisto';
}
