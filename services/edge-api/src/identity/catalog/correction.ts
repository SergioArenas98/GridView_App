import type { IdentityHash } from '../discovery/model';
import { boundedJson, exact } from './sources';
import { requireCatalog } from './model';
import { integer, isHash } from '../wire-decoders';
import { reasons, textBound, uuid } from './review';
export type CorrectionStatus =
  'reported' | 'contained' | 'requires-separate-plan' | 'closed-no-change';
export interface CorrectionRequest {
  schemaVersion: 1;
  operationId: string;
  decisionId: string;
  affectedDriverIds: string[];
  affectedBindingIds: IdentityHash[];
  affectedRevisionIds: string[];
  affectedSeasons: number[];
  publishedVersions: string[];
  reasonCode: (typeof reasons)[number];
  rationale: string;
  evidenceIds: IdentityHash[];
}
export interface IdentityCorrection extends CorrectionRequest {
  correctionId: string;
  principalId: string;
  credentialId: string;
  createdAt: string;
  status: 'reported';
}
export function decodeCorrection(input: unknown): CorrectionRequest {
  const v = boundedJson(input);
  exact(v, [
    'schemaVersion',
    'operationId',
    'decisionId',
    'affectedDriverIds',
    'affectedBindingIds',
    'affectedRevisionIds',
    'affectedSeasons',
    'publishedVersions',
    'reasonCode',
    'rationale',
    'evidenceIds',
  ]);
  requireCatalog(v.schemaVersion === 1, 'correction-version');
  uuid(v.operationId);
  uuid(v.decisionId);
  textBound(v.rationale);
  requireCatalog(
    reasons.includes(v.reasonCode as (typeof reasons)[number]),
    'correction-reason',
  );
  for (const field of [
    'affectedDriverIds',
    'affectedBindingIds',
    'affectedRevisionIds',
    'affectedSeasons',
    'publishedVersions',
    'evidenceIds',
  ])
    requireCatalog(
      Array.isArray(v[field]) &&
        v[field].length <= 100 &&
        new Set(v[field]).size === v[field].length,
      'correction-references',
    );
  requireCatalog(
    (v.evidenceIds as unknown[]).length > 0 &&
      (v.evidenceIds as unknown[]).every(isHash) &&
      (v.affectedBindingIds as unknown[]).every(isHash) &&
      (v.affectedSeasons as unknown[]).every((s) => integer(s, 1950, 2100)),
    'correction-references',
  );
  (v.affectedRevisionIds as unknown[]).forEach(uuid);
  for (const s of [
    ...(v.affectedDriverIds as unknown[]),
    ...(v.publishedVersions as unknown[]),
  ])
    textBound(s, 200);
  return v as unknown as CorrectionRequest;
}
