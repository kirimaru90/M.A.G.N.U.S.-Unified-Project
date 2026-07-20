import type { TalentCatalogImportEntry } from '../../domain/talents-catalog-import-schema';
import type { TalentCatalogEntryDto, TalentsCatalogOp } from '../../core/talents-catalog/talents-catalog.types';

export type SkippedImportReason = 'already_in_catalog' | 'duplicate_in_file';

export interface SkippedImportEntry {
  slug: string;
  reason: SkippedImportReason;
}

export interface TalentsImportDiff {
  addOps: TalentsCatalogOp[];
  skipped: SkippedImportEntry[];
}

/**
 * Additive-only diff: a slug already in the loaded catalog, or repeated within
 * the imported file, is skipped rather than turned into an update op.
 */
export function diffTalentsImport(
  currentEntries: TalentCatalogEntryDto[],
  incoming: TalentCatalogImportEntry[],
): TalentsImportDiff {
  const existingSlugs = new Set(currentEntries.map((e) => e.slug));
  const seenInFile = new Set<string>();
  const addOps: TalentsCatalogOp[] = [];
  const skipped: SkippedImportEntry[] = [];

  for (const entry of incoming) {
    if (existingSlugs.has(entry.slug)) {
      skipped.push({ slug: entry.slug, reason: 'already_in_catalog' });
      continue;
    }
    if (seenInFile.has(entry.slug)) {
      skipped.push({ slug: entry.slug, reason: 'duplicate_in_file' });
      continue;
    }
    seenInFile.add(entry.slug);
    addOps.push({
      action: 'add',
      slug: entry.slug,
      entry: {
        name: entry.name,
        description: entry.description,
        specialRequirement: entry.specialRequirement,
      },
    });
  }

  return { addOps, skipped };
}
