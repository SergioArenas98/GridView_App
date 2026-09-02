/**
 * The single validated boundary between stored version inventories and every
 * decision taken over one.
 *
 * `SnapshotStorage.readVersionInventory` is *declared* to return
 * `SnapshotDocumentName[] | null`, but that declaration describes what a
 * correct write produces, not what a read returns. The value comes back from
 * KV as whatever JSON the key holds, so a truncated write, a hand-edited entry
 * or a partially rolled-back migration can deserialize to a number, a string,
 * an object, or an array carrying something that is not a string - all of them
 * perfectly valid JSON, and none of them an inventory.
 *
 * Downstream nothing is defensive about that, and nothing should be: the route
 * mapper calls `startsWith` on each entry, the purge builders spread the list,
 * and the completeness check iterates it. Spreading a number throws and
 * `startsWith` on a number throws, neither inside the guarded purge-adapter
 * call. Scattering an independent shape test at each of those sites would be
 * four rules that can disagree; there is one here instead, and every reader
 * goes through it.
 *
 * The result is deliberately a four-valued discriminated union rather than
 * "an array or nothing". *Absent*, *malformed* and *unreadable* are three
 * different facts about a version, and the phase that discovers one decides
 * which bounded outcome it maps to - a pre-commit reader rejects, a post-commit
 * reader degrades the purge. Collapsing them here would take that decision
 * away from the only code that knows which side of a commit point it is on.
 *
 * Nothing here repairs, filters or reconstructs an inventory. A value either
 * is one or is not.
 */

import type { SnapshotDocumentName, SnapshotStorage } from '../storage/types';

/**
 * What one stored inventory is, as far as any decision may rely on it.
 *
 * - `documents` - a validated list of document names, safe to spread, map to
 *   routes and expand into aliases.
 * - `absent` - the key holds `null`. A version published before exact
 *   inventories existed records nothing, which is a known historical state and
 *   not corruption.
 * - `malformed` - the key holds something that is not a list of document
 *   names. The version carried *some* surface, and we cannot describe it.
 * - `unreadable` - the read itself failed. Nothing is known about the version
 *   at all, not even whether it recorded an inventory.
 */
export type StoredInventory =
  | {
      readonly kind: 'documents';
      readonly documents: readonly SnapshotDocumentName[];
    }
  | { readonly kind: 'absent' }
  | { readonly kind: 'malformed' }
  | { readonly kind: 'unreadable' };

/**
 * Whether a deserialized value is shaped like an inventory at all.
 *
 * An array of strings, and nothing more. The element type is deliberately not
 * narrowed further: `SnapshotDocumentName` is a template-literal union, and
 * re-deriving its members here would put a second copy of the route vocabulary
 * in a module that must not own one. It is also unnecessary for safety - an
 * unrecognised name maps to `null` in `publicPathForDocument` and to no
 * aliases at all in the alias mapper, so a string that is not a known document
 * is inert. What is *not* inert, and what this rejects, is a value that is not
 * a string: that is what reaches `startsWith` and throws.
 */
function isDocumentNameList(
  value: unknown,
): value is readonly SnapshotDocumentName[] {
  return (
    Array.isArray(value) && value.every((name) => typeof name === 'string')
  );
}

/**
 * Classifies one already-read inventory value.
 *
 * Pure, so a caller that must keep its own read-failure handling - because its
 * callers already classify a thrown read for it - can validate the shape
 * without also swallowing the exception.
 */
export function validatedInventory(value: unknown): StoredInventory {
  if (value === null || value === undefined) return { kind: 'absent' };
  if (!isDocumentNameList(value)) return { kind: 'malformed' };
  return { kind: 'documents', documents: value };
}

/**
 * Reads one version's inventory and classifies it, containing a read failure.
 *
 * The thrown value is never read, logged or re-raised: it can embed a storage
 * key or a stack. Only the fact of failure crosses, as `unreadable`.
 */
export async function readStoredInventory(
  storage: SnapshotStorage,
  season: number,
  version: string,
): Promise<StoredInventory> {
  try {
    return validatedInventory(
      await storage.readVersionInventory(season, version),
    );
  } catch {
    return { kind: 'unreadable' };
  }
}
