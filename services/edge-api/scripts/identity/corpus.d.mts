import type { RepositorySource } from '../../src/identity/catalog/model';
/** `r0` (default): the historical R0 corpus; `p0`: R0 plus the reviewed Rafael Câmara identity. */
export function loadCorpus(
  profile?: 'r0' | 'p0',
): Omit<RepositorySource, 'semanticHash'>[];
export const R0_REVIEWED_BASE_COMMIT: string;
export const R0_EVIDENCE_COMMIT: string;
export const P0_REVIEWED_COMMIT: string;
