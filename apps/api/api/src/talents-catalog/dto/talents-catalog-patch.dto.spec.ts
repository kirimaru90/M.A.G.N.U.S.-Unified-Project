import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { TalentCatalogEntryDto } from './talents-catalog-patch.dto';

function errorsFor(payload: Record<string, unknown>) {
  return validateSync(plainToInstance(TalentCatalogEntryDto, payload));
}

describe('TalentCatalogEntryDto — specialRequirement', () => {
  it('accepts a valid 7-element 0..5 array', () => {
    expect(
      errorsFor({ name: 'Gun Fu', specialRequirement: [0, 0, 0, 0, 0, 3, 0] }),
    ).toEqual([]);
  });

  it('accepts an omitted specialRequirement', () => {
    expect(errorsFor({ name: 'Gun Fu' })).toEqual([]);
  });

  it('rejects an array shorter than 7 elements', () => {
    const errors = errorsFor({
      name: 'Gun Fu',
      specialRequirement: [0, 0, 0, 0, 0, 0],
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('arrayMinSize');
  });

  it('rejects an array longer than 7 elements', () => {
    const errors = errorsFor({
      name: 'Gun Fu',
      specialRequirement: [0, 0, 0, 0, 0, 0, 0, 0],
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('arrayMaxSize');
  });

  it('rejects a non-integer value', () => {
    const errors = errorsFor({
      name: 'Gun Fu',
      specialRequirement: [0, 0, 2.5, 0, 0, 0, 0],
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isInt');
  });

  it('rejects a value below 0', () => {
    const errors = errorsFor({
      name: 'Gun Fu',
      specialRequirement: [0, 0, 0, 0, 0, -1, 0],
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('min');
  });

  it('rejects a value above 5', () => {
    const errors = errorsFor({
      name: 'Gun Fu',
      specialRequirement: [0, 0, 0, 0, 0, 6, 0],
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('max');
  });
});
