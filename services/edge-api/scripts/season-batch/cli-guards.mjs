// Pure argument and path rules for the season-batch CLI. Kept apart from the
// CLI so they are tested without spawning a process or touching the network.

import { realpath } from 'node:fs/promises';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';

export const usage =
  'Usage: npm run season-batch:generate -- --capture <dir> --out <dir> [--allow-dirty-tree]';

/**
 * @param {readonly string[]} argv
 * @returns {{ ok: true, capture: string, out: string, allowDirtyTree: boolean } | { ok: false, reason: string }}
 */
export function parseArguments(argv) {
  let capture = null;
  let out = null;
  let allowDirtyTree = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--allow-dirty-tree') {
      if (allowDirtyTree) return { ok: false, reason: 'repeated-argument' };
      allowDirtyTree = true;
      continue;
    }
    if (argument === '--capture' || argument === '--out') {
      const value = argv[index + 1];
      if (value === undefined || value.length === 0 || value.startsWith('--')) {
        return { ok: false, reason: 'missing-value' };
      }
      index += 1;
      if (argument === '--capture') {
        if (capture !== null) return { ok: false, reason: 'repeated-argument' };
        capture = value;
      } else {
        if (out !== null) return { ok: false, reason: 'repeated-argument' };
        out = value;
      }
      continue;
    }
    return { ok: false, reason: 'unknown-argument' };
  }
  if (capture === null || out === null) {
    return { ok: false, reason: 'missing-argument' };
  }
  return { ok: true, capture, out, allowDirtyTree };
}

/**
 * Whether `candidate` is `root` or anything below it.
 *
 * @param {string} candidate
 * @param {string} root
 */
export function isInside(candidate, root) {
  const path = relative(resolve(root), resolve(candidate));
  // Only a whole `..` segment leaves `root`: a child named `..x` is inside.
  const leaves = path === '..' || path.startsWith(`..${sep}`);
  return path === '' || (!leaves && !isAbsolute(path));
}

/**
 * The capture and output directories must both live outside the repository,
 * so a private capture or generated data can never be staged by accident, and
 * must not overlap each other.
 *
 * @param {{ capture: string, out: string, repositoryRoot: string }} paths
 * @returns {string | null} a closed refusal reason, or `null`
 */
export function pathRefusal({ capture, out, repositoryRoot }) {
  if (isInside(capture, repositoryRoot)) return 'capture-inside-repository';
  if (isInside(out, repositoryRoot)) return 'output-inside-repository';
  if (isInside(out, capture) || isInside(capture, out)) {
    return 'capture-and-output-overlap';
  }
  return null;
}

/**
 * `path` with every symbolic link, junction and short name in its deepest
 * existing ancestor resolved, so a link pointing into the repository cannot
 * pass {@link pathRefusal}. The part that does not exist yet is appended as
 * written: it cannot be a link.
 *
 * @param {string} path
 * @returns {Promise<string>}
 */
export async function physicalPath(path) {
  let existing = resolve(path);
  const missing = [];
  for (;;) {
    try {
      return join(await realpath(existing), ...missing.reverse());
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      const parent = dirname(existing);
      if (parent === existing) throw error;
      missing.push(basename(existing));
      existing = parent;
    }
  }
}

/**
 * The working-tree state the manifest records, or a refusal for a dirty tree
 * the operator did not explicitly accept.
 *
 * @param {string} porcelainStatus `git status --porcelain` output
 * @param {boolean} allowDirtyTree
 * @returns {{ treeClean: boolean, refusal: string | null }}
 */
export function treeState(porcelainStatus, allowDirtyTree) {
  const treeClean = porcelainStatus.trim().length === 0;
  return {
    treeClean,
    refusal: treeClean || allowDirtyTree ? null : 'working-tree-dirty',
  };
}
