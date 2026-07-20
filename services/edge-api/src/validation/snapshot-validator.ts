import type { ValidationIssue } from '../contract/validation';
import { validateMeta } from '../contract/validation';
import type { StoredSnapshot } from '../storage/types';

export interface SnapshotValidator {
  validate(document: StoredSnapshot): ValidationIssue[];
}

export class RuntimeSnapshotValidator implements SnapshotValidator {
  validate(document: StoredSnapshot): ValidationIssue[] {
    const issues = validateMeta(
      { ...document.meta, requestId: 'validation-request' },
      'season' in document.meta ? 'SeasonSnapshotMeta' : 'SnapshotMeta',
    );
    if (!isRecord(document.data)) {
      if (!Array.isArray(document.data)) {
        issues.push({ path: 'data', message: 'must be an object or array' });
      }
    }
    if (document.documentName === 'calendar' && !Array.isArray(document.data)) {
      issues.push({ path: 'data', message: 'must be an array' });
    }
    if (document.documentName === 'drivers' && !Array.isArray(document.data)) {
      issues.push({ path: 'data', message: 'must be an array' });
    }
    if (
      document.documentName === 'constructors' &&
      !Array.isArray(document.data)
    ) {
      issues.push({ path: 'data', message: 'must be an array' });
    }
    if (document.documentName === 'circuits' && !Array.isArray(document.data)) {
      issues.push({ path: 'data', message: 'must be an array' });
    }
    if (
      document.documentName === 'standings:drivers' &&
      !Array.isArray(document.data)
    ) {
      issues.push({ path: 'data', message: 'must be an array' });
    }
    if (
      document.documentName === 'standings:constructors' &&
      !Array.isArray(document.data)
    ) {
      issues.push({ path: 'data', message: 'must be an array' });
    }
    if (JSON.stringify(document.data).includes('providerId')) {
      issues.push({
        path: 'data',
        message: 'must not expose provider identifiers',
      });
    }
    return issues;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const runtimeSnapshotValidator = new RuntimeSnapshotValidator();
