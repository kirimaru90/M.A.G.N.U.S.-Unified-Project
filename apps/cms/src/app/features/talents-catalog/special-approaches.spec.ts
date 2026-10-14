import { describe, it, expect } from 'vitest';
import { specialRequirementPreview } from './special-approaches';

describe('specialRequirementPreview', () => {
  it('lists the non-zero stats in S·P·E·C·I·A·L order', () => {
    expect(specialRequirementPreview([0, 2, 0, 0, 0, 3, 0])).toBe('P2 A3');
  });

  it('lists every stat when all are set', () => {
    expect(specialRequirementPreview([1, 2, 3, 4, 5, 1, 2])).toBe('S1 P2 E3 C4 I5 A1 L2');
  });

  it('shows a dash when there is no requirement', () => {
    expect(specialRequirementPreview(undefined)).toBe('—');
    expect(specialRequirementPreview([0, 0, 0, 0, 0, 0, 0])).toBe('—');
  });
});
