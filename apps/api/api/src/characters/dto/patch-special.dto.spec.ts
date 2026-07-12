import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PatchSpecialDto } from './patch-special.dto';

const ATTRIBUTES = [
  'strength',
  'perception',
  'endurance',
  'charisma',
  'intelligence',
  'agility',
  'luck',
] as const;

function errorsFor(payload: Record<string, unknown>) {
  return validateSync(plainToInstance(PatchSpecialDto, payload));
}

describe('PatchSpecialDto — SPECIAL bounds are 1..5', () => {
  it.each(ATTRIBUTES)('accepts the lower bound 1 for %s', (attr) => {
    expect(errorsFor({ [attr]: 1 })).toEqual([]);
  });

  it.each(ATTRIBUTES)('accepts the upper bound 5 for %s', (attr) => {
    expect(errorsFor({ [attr]: 5 })).toEqual([]);
  });

  it.each(ATTRIBUTES)('rejects 0 for %s', (attr) => {
    const errors = errorsFor({ [attr]: 0 });
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('min');
  });

  it.each(ATTRIBUTES)('rejects 6 for %s', (attr) => {
    const errors = errorsFor({ [attr]: 6 });
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('max');
  });

  it('accepts an empty body (every attribute is optional)', () => {
    expect(errorsFor({})).toEqual([]);
  });

  it('rejects a non-integer value', () => {
    const errors = errorsFor({ strength: 3.5 });
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isInt');
  });
});
