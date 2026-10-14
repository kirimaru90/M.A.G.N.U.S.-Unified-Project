import { StateSchemaConflictResponseSchema } from './state.schemas';
import type { StateSchemaConflictResponse } from './state.types';

export type StateSchemaErrorKind =
  | { kind: 'conflict'; data: StateSchemaConflictResponse }
  | { kind: 'error' };

/**
 * A 409 whose body lists the terminals still referencing a variable is a
 * conflict the caller shows in its conflict dialog; anything else is a plain error.
 */
export function classifyStateSchemaError(err: unknown): StateSchemaErrorKind {
  const e = err as { status?: number; error?: unknown } | null;
  if (e?.status === 409) {
    const parsed = StateSchemaConflictResponseSchema.safeParse(e.error);
    if (parsed.success) return { kind: 'conflict', data: parsed.data };
  }
  return { kind: 'error' };
}
