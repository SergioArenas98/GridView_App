/**
 * Reading and validating one checkpoint-named release, by exact immutable
 * versioned key, for the D12 migration
 * ([ADR 0025](../../../../../docs/adr/0025-season-publication-authority-and-rollback-republication.md)
 * D12 steps 2-6 and 9).
 *
 * ## One routine, two callers, two obligations
 *
 * D12 applies the *same reads* to `activeVersion` and `previousVersion` and the
 * *opposite obligations* to their outcomes: the active read is **mandatory** and
 * any failure aborts the season's cutover; the previous read is **best-effort**
 * and its failure only removes the previous pointer and its timestamps from the
 * seed. Expressing that as two routines would be two rules that can drift, so
 * this file is one routine returning a bounded refusal, and the caller decides
 * which obligation applies to it.
 *
 * ## What the reads are, and what they are not
 *
 * Every read here addresses `snapshot:{season}:{version}:*` by **exact
 * versioned key**. Those keys are immutable once written
 * ([ADR 0007](../../../../../docs/adr/0007-versioned-kv-publication-active-pointer.md)),
 * so reading one reads a fixed artifact rather than a moving pointer. The live
 * `active:{season}` / `previous:{season}` keys are **never read**, and neither
 * is `listVersions`: a prefix scan is eventually consistent audit evidence, not
 * proof of historical completeness, and nothing in this migration treats it as
 * either.
 *
 * The retry budget is bounded and injectable, so exhaustion is a decision this
 * code takes rather than a wait that never ends, and a test drives both the
 * success and the exhaustion path without a real delay. It covers every storage
 * read here - inventory, documents and the provenance sidecar - each with its
 * own budget, one after another, never nested inside another.
 *
 * ## Provenance is not re-derived here
 *
 * `resolveRollbackSourceOrdering` is called verbatim - the exact shared D8/D12
 * step 6 rules: a valid sidecar in either namespace is used as-is, an absent
 * sidecar on a `pm1-…` version fails closed, an absent sidecar on a
 * legacy-format version permits the bounded uniform-document fallback, a
 * malformed or non-uniform value fails closed at once, and an unreadable one
 * fails closed once the retry budget is spent. Eligibility comes from the
 * version-format discriminator, never from a `null` read.
 *
 * **No sidecar is ever created or backfilled here.** Those keys are immutable,
 * a legacy version legitimately has none, and writing one would mutate a
 * historical artifact this design treats as fixed. This module performs no
 * write of any kind, to Workers KV or anywhere else.
 */

import { canonicalInstant } from '../canonical/instant';
import {
  revisionInputForDocument,
  snapshotRevision,
} from '../snapshot-revision';
import type { PerKeyState } from '../sequencer/model';
import { resolveRollbackSourceOrdering } from '../sequenced/rollback-provenance';
import { readStoredInventory } from '../version-inventory';
import type {
  SnapshotDocumentName,
  SnapshotStorage,
  StoredSnapshot,
} from '../../storage/types';
import type { SnapshotValidator } from '../../validation/snapshot-validator';

/**
 * The bounded retry budget for one release's reads.
 *
 * `attempts` is the total number of tries, not the number of retries, so `1`
 * means "read once and accept the answer". `delay` is injected so a test is
 * deterministic and instant; production supplies a real, short backoff.
 */
export interface CutoverRetryPolicy {
  readonly attempts: number;
  readonly delay: (attempt: number) => Promise<void>;
}

export const defaultCutoverRetryPolicy: CutoverRetryPolicy = {
  attempts: 3,
  delay: (attempt) =>
    new Promise((resolve) => setTimeout(resolve, 250 * attempt)),
};

/** Why a checkpoint-named release could not be imported. Bounded; reaches a
 *  structured log and an operator receipt, never a storage key or a payload. */
export const releaseImportRefusals = [
  'inventory-unavailable',
  'inventory-empty',
  'document-unavailable',
  'document-invalid',
  'document-timestamp-invalid',
  'provenance-unavailable',
] as const;

export type ReleaseImportRefusal = (typeof releaseImportRefusals)[number];

/**
 * One fully read, validated release, staged but not committed anywhere.
 *
 * `perKeyState` carries each document's `snapshotRevision` (D12 step 4,
 * computed by the already-implemented canonical serializer - this migration
 * introduces no second revision computation) and its imported
 * `meta.sourceUpdatedAt` as the initial `snapshotObservedAt` (step 5).
 */
export interface ImportedRelease {
  readonly version: string;
  readonly inventory: readonly SnapshotDocumentName[];
  readonly perKeyState: readonly PerKeyState[];
  readonly sourceOrderingInput: string;
  /** The provenance classification, for the audit trail. Bounded. */
  readonly provenance: 'sidecar' | 'legacy-uniform-documents';
}

export type ReleaseImport =
  | { readonly ok: true; readonly release: ImportedRelease }
  | { readonly ok: false; readonly refusal: ReleaseImportRefusal };

export interface ReleaseImportDeps {
  readonly storage: SnapshotStorage;
  readonly validator: SnapshotValidator;
  readonly retry: CutoverRetryPolicy;
}

/**
 * Reads, validates and imports one release named by the checkpoint.
 *
 * Mandatory for `activeVersion` (D12 step 3: a failure aborts the cutover with
 * no Durable Object state written), best-effort for `previousVersion` (step 8:
 * a failure omits it from the seed and commits `previousVersion: null`). The
 * asymmetry is the caller's; the reads are identical.
 */
export async function importRelease(
  deps: ReleaseImportDeps,
  season: number,
  version: string,
): Promise<ReleaseImport> {
  const inventory = await withRetry(deps.retry, async () => {
    const read = await readStoredInventory(deps.storage, season, version);
    return read.kind === 'documents' ? read.documents : null;
  });
  if (inventory === null) {
    return refuse('inventory-unavailable');
  }
  if (inventory.length === 0) {
    // A version that recorded it holds nothing supplies no per-key state and no
    // legacy ordering input; it is never a usable cutover checkpoint.
    return refuse('inventory-empty');
  }

  const documents = new Map<SnapshotDocumentName, StoredSnapshot>();
  for (const name of inventory) {
    const document = await withRetry(deps.retry, () =>
      deps.storage.readVersionedDocument(season, version, name),
    );
    if (document === null) return refuse('document-unavailable');
    documents.set(name, document);
  }

  for (const document of documents.values()) {
    let issues;
    try {
      issues = deps.validator.validate(document);
    } catch {
      return refuse('document-invalid');
    }
    if (issues.length > 0) return refuse('document-invalid');
  }

  const perKeyState: PerKeyState[] = [];
  for (const [name, document] of documents) {
    const observedAt = document.meta.sourceUpdatedAt;
    // D12 step 5 imports this value as the key's initial `snapshotObservedAt`,
    // and every later comparison orders against it. A value that cannot be
    // ordered is not importable, and is never repaired or guessed.
    if (
      typeof observedAt !== 'string' ||
      canonicalInstant(observedAt) === null
    ) {
      return refuse('document-timestamp-invalid');
    }
    perKeyState.push({
      documentName: name,
      revision: await snapshotRevision(revisionInputForDocument(document)),
      observedAt,
    });
  }

  // Inside the same bounded budget as every other read here (D12 step 3). Only
  // an *unreadable* sidecar is transient and retried; a malformed one, an
  // absent one on a `pm1-…` version and a missing or non-uniform legacy
  // timestamp are permanent facts about an immutable artifact, so the attempt
  // that produced one ends the loop. The shared resolver itself is unchanged.
  const provenance = await withRetry(deps.retry, async () => {
    const resolved = await resolveRollbackSourceOrdering(
      deps.storage,
      season,
      version,
      documents,
    );
    return resolved.kind === 'rejected' &&
      resolved.classification === 'unreadable-sidecar'
      ? null
      : resolved;
  });
  if (provenance === null || provenance.kind === 'rejected') {
    return refuse('provenance-unavailable');
  }

  return {
    ok: true,
    release: {
      version,
      inventory,
      perKeyState,
      sourceOrderingInput: provenance.sourceOrderingInput,
      provenance: provenance.classification,
    },
  };
}

/**
 * Whether a re-read describes the same release as the staged one
 * (D12 step 9).
 *
 * Because step 2 read immutable versioned artifacts rather than a live pointer,
 * this guards against a local read failure; it is not, and is not needed as, a
 * wait for external Workers KV convergence. Equality is over the exact staged
 * facts - the same document set, the same revisions, the same imported
 * timestamps, the same ordering input - so a release that changed under us is
 * as much a mismatch as one that failed to read.
 */
export function releasesMatch(
  staged: ImportedRelease,
  recheck: ImportedRelease,
): boolean {
  if (staged.version !== recheck.version) return false;
  if (staged.sourceOrderingInput !== recheck.sourceOrderingInput) return false;
  if (staged.perKeyState.length !== recheck.perKeyState.length) return false;
  const byName = new Map(
    recheck.perKeyState.map((state) => [state.documentName, state]),
  );
  for (const state of staged.perKeyState) {
    const other = byName.get(state.documentName);
    if (other === undefined) return false;
    if (other.revision !== state.revision) return false;
    if (other.observedAt !== state.observedAt) return false;
  }
  return true;
}

/** Every imported `snapshotObservedAt` in one release. */
export function observedTimestamps(release: ImportedRelease): string[] {
  return release.perKeyState.map((state) => state.observedAt);
}

/**
 * Retries one read within the bounded budget, treating a thrown read and a
 * `null` result alike as "not available yet".
 *
 * A thrown value is never read, logged or re-raised: it can embed a storage key
 * or a stack. Only the fact of unavailability crosses, as `null`.
 */
async function withRetry<T>(
  policy: CutoverRetryPolicy,
  read: () => Promise<T | null>,
): Promise<T | null> {
  const attempts = Math.max(1, policy.attempts);
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let value: T | null;
    try {
      value = await read();
    } catch {
      value = null;
    }
    if (value !== null) return value;
    if (attempt < attempts) await policy.delay(attempt);
  }
  return null;
}

function refuse(refusal: ReleaseImportRefusal): ReleaseImport {
  return { ok: false, refusal };
}
