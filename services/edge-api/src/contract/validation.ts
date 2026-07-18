// Runtime validation for the public contract. TypeScript types alone cannot
// vouch for untrusted JSON, so these checks run at runtime. They are tolerant of
// unknown additive fields (extra keys are ignored) but strict about required
// fields, ID format, country-code format and the metadata variant.

export interface ValidationIssue {
  path: string;
  message: string;
}

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const GRIDVIEW_ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const COUNTRY_CODE_RE = /^[A-Z]{2}$/;

export function isSlug(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64 && SLUG_RE.test(value);
}

export function isGridViewId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 96 &&
    GRIDVIEW_ID_RE.test(value)
  );
}

export function isCountryCode(value: unknown): value is string {
  return typeof value === 'string' && COUNTRY_CODE_RE.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIsoDateTime(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    !Number.isNaN(Date.parse(value))
  );
}

export type MetaKind = 'BaseMeta' | 'SnapshotMeta' | 'SeasonSnapshotMeta';

/** Validates a metadata object against the requested variant. */
export function validateMeta(meta: unknown, kind: MetaKind): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isRecord(meta)) {
    return [{ path: 'meta', message: 'must be an object' }];
  }
  if (meta['apiVersion'] !== '1') {
    issues.push({ path: 'meta.apiVersion', message: 'must equal "1"' });
  }
  if (!isIsoDateTime(meta['generatedAt'])) {
    issues.push({
      path: 'meta.generatedAt',
      message: 'must be an ISO-8601 date-time',
    });
  }
  if (typeof meta['requestId'] !== 'string' || meta['requestId'].length === 0) {
    issues.push({
      path: 'meta.requestId',
      message: 'must be a non-empty string',
    });
  }
  if (kind === 'SnapshotMeta' || kind === 'SeasonSnapshotMeta') {
    if (typeof meta['schemaVersion'] !== 'number') {
      issues.push({ path: 'meta.schemaVersion', message: 'must be a number' });
    }
    if (!isIsoDateTime(meta['sourceUpdatedAt'])) {
      issues.push({
        path: 'meta.sourceUpdatedAt',
        message: 'must be an ISO-8601 date-time',
      });
    }
    if (!isIsoDateTime(meta['staleAfter'])) {
      issues.push({
        path: 'meta.staleAfter',
        message: 'must be an ISO-8601 date-time',
      });
    }
    if (typeof meta['contentVersion'] !== 'string') {
      issues.push({ path: 'meta.contentVersion', message: 'must be a string' });
    }
  }
  if (kind === 'SeasonSnapshotMeta' && typeof meta['season'] !== 'number') {
    issues.push({ path: 'meta.season', message: 'must be a number' });
  }
  return issues;
}

/** Validates the success envelope: `data` is present and `meta` matches `kind`. */
export function validateSuccessEnvelope(
  body: unknown,
  kind: MetaKind,
): ValidationIssue[] {
  if (!isRecord(body)) {
    return [{ path: '(root)', message: 'must be an object' }];
  }
  const issues: ValidationIssue[] = [];
  if (!('data' in body)) {
    issues.push({ path: 'data', message: 'is required' });
  }
  issues.push(...validateMeta(body['meta'], kind));
  return issues;
}

const ERROR_CODES = new Set([
  'INVALID_PARAMETER',
  'SEASON_NOT_FOUND',
  'RESOURCE_NOT_FOUND',
  'RESOURCE_NOT_AVAILABLE',
  'SNAPSHOT_NOT_READY',
  'UPSTREAM_UNAVAILABLE',
  'UPSTREAM_RATE_LIMITED',
  'MAINTENANCE',
  'METHOD_NOT_ALLOWED',
  'INTERNAL_ERROR',
]);

/** Validates the error envelope. */
export function validateErrorEnvelope(body: unknown): ValidationIssue[] {
  if (!isRecord(body) || !isRecord(body['error'])) {
    return [{ path: 'error', message: 'must be an object' }];
  }
  const error = body['error'];
  const issues: ValidationIssue[] = [];
  if (typeof error['code'] !== 'string' || !ERROR_CODES.has(error['code'])) {
    issues.push({ path: 'error.code', message: 'must be a known error code' });
  }
  if (typeof error['message'] !== 'string' || error['message'].length === 0) {
    issues.push({
      path: 'error.message',
      message: 'must be a non-empty string',
    });
  }
  if (typeof error['retryable'] !== 'boolean') {
    issues.push({ path: 'error.retryable', message: 'must be a boolean' });
  }
  if (
    typeof error['requestId'] !== 'string' ||
    error['requestId'].length === 0
  ) {
    issues.push({
      path: 'error.requestId',
      message: 'must be a non-empty string',
    });
  }
  return issues;
}
