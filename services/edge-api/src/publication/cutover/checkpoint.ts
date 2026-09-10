/**
 * The operator-approved cutover checkpoint, its historical-floor evidence, and
 * the deterministic fingerprint derived from both
 * ([ADR 0025](../../../../../docs/adr/0025-season-publication-authority-and-rollback-republication.md)
 * D12).
 *
 * ## The checkpoint is a decision, never an inference
 *
 * D12 is explicit that migration must not begin by re-reading the live
 * `active:{season}` / `previous:{season}` pointers and treating an unchanged
 * reread as proof they are current: pausing mutators prevents *new* writes and
 * does not make an already-issued Workers KV write strongly consistent, and
 * Workers KV publishes no global-convergence barrier this design could rely on
 * ([ADR 0010](../../../../../docs/adr/0010-workers-kv-consistency-limitation.md)).
 *
 * So an authenticated operator **names** the exact `activeVersion` and optional
 * `previousVersion` instead. Nothing in this module, and nothing in the
 * migration that consumes it, reads a legacy pointer key to fill a checkpoint
 * field in. The values are authoritative because the operator approved this
 * exact cutover state, not because a pointer read was repeated.
 *
 * ## What the checkpoint deliberately does not carry
 *
 * **No `sourceOrderingInput`.** The checkpoint's job is to *identify* the
 * selected version; that version's own immutable `__publication_metadata`
 * sidecar - or, for a legacy-format version, its own validated uniform document
 * timestamps - supplies the provenance, through the exact shared rollback rules
 * (D8, D12 step 6). Asking an operator to type a historical ordering timestamp
 * by hand would put an unaudited value into the field ordinary publication
 * admission is decided against.
 *
 * ## The fingerprint is derived here, never supplied
 *
 * A caller-supplied fingerprint would be a value the operator could alter
 * independently of the fields it is supposed to bind, which would defeat the
 * whole point of D12 step 11's confirmation: activation must present the same
 * fingerprint the seed committed, recomputed from the same checkpoint. It is
 * therefore derived from a canonical, length-framed rendering of **every**
 * checkpoint field, and any caller-supplied value is ignored - there is no
 * field for one.
 *
 * Length framing rather than a delimiter is what makes the rendering injective:
 * two different field splits can otherwise produce one string, and two
 * different checkpoints would then share a fingerprint.
 */

import { encodeUtf8, utf8ByteLength } from '../canonical/ordering';
import { canonicalInstant } from '../canonical/instant';
import { isSeason, isVersionIdentifier } from '../sequencer/store';

/** The canonical rendering format the fingerprint digest is taken over. */
export const cutoverFingerprintFormatVersion = 'gv-cutover/1';

/** The digest algorithm, and the prefix every fingerprint carries. */
export const cutoverFingerprintAlgorithm = 'cutover1';

/**
 * One bounded operator-supplied audit reference.
 *
 * Wider than an opaque identifier because a real audit reference is a ticket,
 * document or path (`AUDIT-2026-09-10/staging-baseline-reset`), and narrower
 * than a free-form string because it reaches a structured log line and an
 * operator receipt. Length- and charset-bounded, with no whitespace and no
 * control characters.
 */
const auditReferencePattern = /^[A-Za-z0-9._:/#@-]{1,200}$/;

export function isAuditReference(value: unknown): value is string {
  return typeof value === 'string' && auditReferencePattern.test(value);
}

/**
 * The closed set of preconditions D12's "pre-cutover historical-floor
 * activation precondition" accepts, one variant per documented alternative.
 *
 * The precondition exists because the migration **cannot prove** its seed
 * exceeds a timestamp held only by a pre-cutover version outside a complete,
 * audited set - a version whose keys were deleted, one temporarily omitted from
 * an eventually consistent prefix scan, one recorded only in an operator's
 * external records, or a snapshot retained by an offline client. A D1.11a
 * clock-regression clamp may in any case have placed such a historical
 * timestamp ahead of migration wall time
 * ([ADR 0020](../../../../../docs/adr/0020-provider-source-observation-and-reconciliation.md)).
 *
 * **This code records and validates evidence supplied by an authenticated
 * operator. It establishes nothing by itself, and it must never be read as
 * claiming that a `listVersions` scan proves historical completeness** - that
 * scan is eventually consistent, cannot prove no key was omitted, and cannot
 * see deleted, externally recorded or client-retained history. The migration
 * never calls it, and no variant here is satisfied by running it.
 *
 * Every variant carries an opaque `evidenceReference` for the audit trail. A
 * bare boolean, a free-form substitute or a silent default is deliberately not
 * representable: the union is closed and the reference is required.
 */
export type HistoricalFloorEvidence =
  | {
      /**
       * A trustworthy historical index, or an audited upper bound over every
       * timestamp this season's pre-cutover history could contain, is imported
       * into the seed. The bound is **required** here, because "imported into
       * the seed" is what this variant claims; the migration folds it into the
       * high-water mark before the fingerprint-bound seed is committed.
       */
      readonly kind: 'audited-historical-upper-bound';
      readonly auditedUpperBound: string;
      readonly evidenceReference: string;
    }
  | {
      /** An audit specifically proves no uncovered future-clock or clamp value
       *  exists for this season's pre-cutover history. */
      readonly kind: 'no-uncovered-clock-value-audit';
      readonly evidenceReference: string;
    }
  | {
      /** The target environment retains no pre-cutover client state for this
       *  season: no offline client holds a snapshot predating the cutover. */
      readonly kind: 'no-retained-pre-cutover-client-state';
      readonly evidenceReference: string;
    }
  | {
      /** A separately authorized client-baseline reset or contract migration
       *  removed any such retained client state before activation. */
      readonly kind: 'authorized-client-baseline-reset';
      readonly evidenceReference: string;
    };

export const historicalFloorEvidenceKinds = [
  'audited-historical-upper-bound',
  'no-uncovered-clock-value-audit',
  'no-retained-pre-cutover-client-state',
  'authorized-client-baseline-reset',
] as const;

/**
 * The exact operator input the migration acts on, and the exact set of fields
 * the fingerprint covers.
 *
 * `previousVersion` is `null` when the operator named none. That is a different
 * fact from a named version that later fails its best-effort validation, and
 * the two are never conflated: this field records what was *approved*, and the
 * seed records what was *committed*.
 */
export interface CutoverCheckpoint {
  readonly season: number;
  readonly activeVersion: string;
  readonly previousVersion: string | null;
  /** Opaque identity of this specific cutover attempt. */
  readonly migrationIdentity: string;
  readonly historicalFloorEvidence: HistoricalFloorEvidence;
}

/**
 * Decodes one untrusted checkpoint body.
 *
 * Every field is checked before any of it is used, and an unknown extra field
 * is ignored - forward-compatible, and it cannot weaken anything, because no
 * confirmation or precondition is expressed by an absent field. Absent
 * `previousVersion` and explicit `null` are the same approved decision: no
 * previous version was named.
 */
export function decodeCutoverCheckpoint(
  value: unknown,
): CutoverCheckpoint | null {
  if (!isRecord(value)) return null;
  if (!isSeason(value.season)) return null;
  if (!isVersionIdentifier(value.activeVersion)) return null;

  const rawPrevious = value.previousVersion;
  const previousVersion =
    rawPrevious === undefined || rawPrevious === null ? null : rawPrevious;
  if (previousVersion !== null && !isVersionIdentifier(previousVersion)) {
    return null;
  }

  if (!isAuditReference(value.migrationIdentity)) return null;

  const evidence = decodeHistoricalFloorEvidence(value.historicalFloorEvidence);
  if (evidence === null) return null;

  return {
    season: value.season,
    activeVersion: value.activeVersion,
    previousVersion,
    migrationIdentity: value.migrationIdentity,
    historicalFloorEvidence: evidence,
  };
}

/**
 * Decodes one untrusted evidence value against the closed union.
 *
 * A missing or unrecognised `kind` is `null`, never a default variant: silently
 * choosing one would be exactly the "silent default" the precondition forbids.
 */
export function decodeHistoricalFloorEvidence(
  value: unknown,
): HistoricalFloorEvidence | null {
  if (!isRecord(value)) return null;
  if (!isAuditReference(value.evidenceReference)) return null;
  const reference = value.evidenceReference;
  switch (value.kind) {
    case 'audited-historical-upper-bound': {
      const bound = value.auditedUpperBound;
      if (typeof bound !== 'string' || canonicalInstant(bound) === null) {
        return null;
      }
      return {
        kind: 'audited-historical-upper-bound',
        auditedUpperBound: bound,
        evidenceReference: reference,
      };
    }
    case 'no-uncovered-clock-value-audit':
    case 'no-retained-pre-cutover-client-state':
    case 'authorized-client-baseline-reset':
      return { kind: value.kind, evidenceReference: reference };
    default:
      return null;
  }
}

/**
 * The audited upper bound this evidence contributes to the high-water-mark
 * seed, or `null` when the variant carries none.
 */
export function auditedUpperBoundOf(
  evidence: HistoricalFloorEvidence,
): string | null {
  return evidence.kind === 'audited-historical-upper-bound'
    ? evidence.auditedUpperBound
    : null;
}

/**
 * The exact text whose UTF-8 bytes are fingerprinted.
 *
 * Exposed for the same reason `canonicalRevisionText` is: a digest is
 * unreviewable on its own, and a test that pins the rendering fails with a
 * readable difference. It is derived entirely from the checkpoint, so it is
 * diagnostic output, never log output.
 *
 * Every component is framed with its own UTF-8 byte length, and a nullable
 * component renders as a distinct absent marker rather than an empty string -
 * so "no previous version" and "a previous version whose identifier is empty"
 * could never collide, even if the latter were representable.
 */
export function cutoverFingerprintText(checkpoint: CutoverCheckpoint): string {
  const evidence = checkpoint.historicalFloorEvidence;
  return [
    cutoverFingerprintFormatVersion,
    frame(String(checkpoint.season)),
    frame(checkpoint.activeVersion),
    frameNullable(checkpoint.previousVersion),
    frame(checkpoint.migrationIdentity),
    frame(evidence.kind),
    frame(evidence.evidenceReference),
    frameNullable(auditedUpperBoundOf(evidence)),
  ].join('');
}

/**
 * The deterministic fingerprint for one checkpoint: `cutover1:<64 hex>`.
 *
 * Bounded to the opaque-identifier charset the sequencer accepts for a durable
 * `cutoverFingerprint`, and self-describing, so a later derivation is a visibly
 * different value rather than a silent reinterpretation of the same one.
 */
export async function cutoverFingerprint(
  checkpoint: CutoverCheckpoint,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    encodeUtf8(cutoverFingerprintText(checkpoint)) as unknown as BufferSource,
  );
  return `${cutoverFingerprintAlgorithm}:${hex(new Uint8Array(digest))}`;
}

function frame(value: string): string {
  return `|${utf8ByteLength(value)}:${value}`;
}

function frameNullable(value: string | null): string {
  return value === null ? '|-' : frame(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}
