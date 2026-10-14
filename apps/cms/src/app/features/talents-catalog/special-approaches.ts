// S·P·E·C·I·A·L order, positional to TalentCatalogEntryDto.specialRequirement.
export const APPROACHES = [
  { key: 'strength', letter: 'S' },
  { key: 'perception', letter: 'P' },
  { key: 'endurance', letter: 'E' },
  { key: 'charisma', letter: 'C' },
  { key: 'intelligence', letter: 'I' },
  { key: 'agility', letter: 'A' },
  { key: 'luck', letter: 'L' },
] as const;

/** The non-zero requirements as letter+value in S·P·E·C·I·A·L order (`P2 A3`), or `—` when there are none. */
export function specialRequirementPreview(req: readonly number[] | undefined): string {
  const parts = APPROACHES.flatMap((a, i) => ((req?.[i] ?? 0) > 0 ? [`${a.letter}${req![i]}`] : []));
  return parts.length > 0 ? parts.join(' ') : '—';
}
