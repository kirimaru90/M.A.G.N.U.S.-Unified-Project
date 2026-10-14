import { describe, it, expect } from 'vitest';
import { classifyStateSchemaError } from './state-schema-error';

const conflictBody = {
  error: 'in use',
  conflicts: [{ variable: 'door', referencedBy: [{ id: 't1', title: 'Terminale 1' }] }],
};

describe('classifyStateSchemaError', () => {
  it('classifies a 409 with a valid conflict body as a conflict', () => {
    expect(classifyStateSchemaError({ status: 409, error: conflictBody })).toEqual({
      kind: 'conflict',
      data: conflictBody,
    });
  });

  it('classifies a 409 with an unrecognised body as an error', () => {
    expect(classifyStateSchemaError({ status: 409, error: { message: 'nope' } })).toEqual({ kind: 'error' });
  });

  it('classifies other statuses, and a missing error, as an error', () => {
    expect(classifyStateSchemaError({ status: 500, error: conflictBody })).toEqual({ kind: 'error' });
    expect(classifyStateSchemaError({})).toEqual({ kind: 'error' });
    expect(classifyStateSchemaError(null)).toEqual({ kind: 'error' });
  });
});
