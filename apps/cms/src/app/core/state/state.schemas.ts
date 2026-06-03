import { z } from 'zod';
import type { StateEntryDto } from './state.types';

export const StateEntrySchema = z.object({
  key: z.string(),
  type: z.enum(['boolean', 'number', 'enum', 'string']),
  default: z.union([z.boolean(), z.number(), z.string()]),
  current: z.union([z.boolean(), z.number(), z.string()]),
  values: z.array(z.string()).optional(),
});

export const StateEntryArraySchema = z.array(StateEntrySchema);

export const StateSchemaConflictResponseSchema = z.object({
  error: z.string(),
  conflicts: z.array(
    z.object({
      variable: z.string(),
      referencedBy: z.array(z.object({ id: z.string(), title: z.string() })),
    }),
  ),
});

export function valueSchemaFor(entry: StateEntryDto): z.ZodType {
  switch (entry.type) {
    case 'boolean':
      return z.boolean();
    case 'number':
      return z.number();
    case 'string':
      return z.string();
    case 'enum':
      return z.enum(entry.values as [string, ...string[]]);
  }
}

export function coerceForType(entry: StateEntryDto, raw: unknown): unknown {
  if (entry.type === 'number') {
    const n = Number(raw);
    return isNaN(n) ? raw : n;
  }
  return raw;
}
