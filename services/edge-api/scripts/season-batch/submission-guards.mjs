// Pure argument and path rules for the offline submission builder. Kept apart
// from the CLI so they are tested without spawning a process.

import { isInside } from './cli-guards.mjs';

export const submissionUsage =
  'Usage: npm run season-batch:submission -- --batch <dir> --manifest-sha256 <hex> (--expected-active-version <version> | --first-release) --out <file>';

const valued = [
  '--batch',
  '--manifest-sha256',
  '--expected-active-version',
  '--out',
];

/**
 * `--first-release` takes no value. It stands in for
 * `--expected-active-version` when the season is in `genesis` and has no
 * release to name, and the submission then carries an explicit `null`.
 */
const firstRelease = '--first-release';

/**
 * Every option is single-use; every valued option is required, except that
 * exactly one of `--expected-active-version` and `--first-release` is given.
 * Anything else is refused.
 *
 * @param {readonly string[]} argv
 * @returns {{ ok: true, batch: string, manifestSha256: string, expectedActiveVersion: string | null, out: string } | { ok: false, reason: string }}
 */
export function parseSubmissionArguments(argv) {
  const values = {};
  let first = false;
  for (let index = 0; index < argv.length; index += 2) {
    const argument = argv[index];
    if (argument === firstRelease) {
      if (first) return { ok: false, reason: 'repeated-argument' };
      first = true;
      index -= 1;
      continue;
    }
    if (!valued.includes(argument)) {
      return { ok: false, reason: 'unknown-argument' };
    }
    const value = argv[index + 1];
    if (value === undefined || value.length === 0 || value.startsWith('--')) {
      return { ok: false, reason: 'missing-value' };
    }
    if (argument in values) return { ok: false, reason: 'repeated-argument' };
    values[argument] = value;
  }
  const named = '--expected-active-version' in values;
  if (named && first) return { ok: false, reason: 'conflicting-arguments' };
  for (const name of valued) {
    if (name === '--expected-active-version' && first) continue;
    if (!(name in values)) return { ok: false, reason: 'missing-argument' };
  }
  if (!/^[0-9a-f]{64}$/.test(values['--manifest-sha256'])) {
    return { ok: false, reason: 'manifest-sha256-invalid' };
  }
  return {
    ok: true,
    batch: values['--batch'],
    manifestSha256: values['--manifest-sha256'],
    expectedActiveVersion: first ? null : values['--expected-active-version'],
    out: values['--out'],
  };
}

/**
 * The batch and the submission file must both live outside the repository,
 * so neither the batch nor the body derived from it can be staged by
 * accident, and the file must not be written into the batch directory.
 *
 * @param {{ batch: string, out: string }} paths physical paths
 * @param {string} repositoryRoot physical path
 * @returns {string | null} a closed refusal reason, or `null`
 */
export function submissionPathRefusal({ batch, out }, repositoryRoot) {
  if (isInside(batch, repositoryRoot)) return 'batch-inside-repository';
  if (isInside(out, repositoryRoot)) return 'output-inside-repository';
  if (isInside(out, batch)) return 'output-inside-batch';
  return null;
}
