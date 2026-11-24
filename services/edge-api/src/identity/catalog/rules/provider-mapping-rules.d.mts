export function validateRegistryDocumentSet(
  kind: string,
  arrayKey: string,
  documents: { label: string; data: unknown }[],
): { problems: unknown[]; ids: Set<string> };
export function validateSeasonalDocumentSet(
  mappings: { label: string; data: unknown }[],
  evidence: { label: string; data: unknown }[],
): { problems: unknown[] };
export function validateMappingDocument(
  document: unknown,
  canonicalIds: Record<string, ReadonlySet<string>>,
): unknown[];
export function validateEvidenceCoverage(
  evidence: unknown,
  mapping: unknown,
): unknown[];
