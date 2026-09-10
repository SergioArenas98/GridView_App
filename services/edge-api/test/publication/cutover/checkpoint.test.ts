/**
 * The operator checkpoint, its closed historical-floor evidence, and the
 * fingerprint derived from both (ADR 0025 D12).
 *
 * The fingerprint is what binds D12 step 11's activation confirmation to the
 * step-10 seed, so two properties matter equally: the same checkpoint must
 * always produce the same value, and **every** field must change it. A field
 * the fingerprint ignored would be a field an operator could alter between the
 * seed and its confirmation without the mismatch check noticing.
 */

import { describe, expect, it } from 'vitest';

import {
  cutoverFingerprint,
  cutoverFingerprintText,
  decodeCutoverCheckpoint,
  decodeHistoricalFloorEvidence,
  historicalFloorEvidenceKinds,
  type CutoverCheckpoint,
} from '../../../src/publication/cutover/checkpoint';
import { isOpaqueIdentifier } from '../../../src/publication/sequencer/store';
import { checkpointFor, EVIDENCE_REFERENCE, SEASON } from './support';

const AUDITED_BOUND = '2026-06-01T00:00:00.000Z';

describe('fingerprint determinism', () => {
  it('produces the same value for the same checkpoint, every time', async () => {
    const a = await cutoverFingerprint(checkpointFor());
    const b = await cutoverFingerprint(checkpointFor());
    expect(a).toBe(b);
    expect(a).toMatch(/^cutover1:[0-9a-f]{64}$/);
  });

  it('produces a value the sequencer accepts as a durable fingerprint', async () => {
    // The seeded `cutoverFingerprint` reaches durable state and a structured
    // log, so it must satisfy the sequencer's bounded opaque-identifier rule.
    expect(isOpaqueIdentifier(await cutoverFingerprint(checkpointFor()))).toBe(
      true,
    );
  });

  it('does not depend on the field order of the object it was built from', async () => {
    const ordered = checkpointFor();
    const reordered = {
      historicalFloorEvidence: ordered.historicalFloorEvidence,
      migrationIdentity: ordered.migrationIdentity,
      previousVersion: ordered.previousVersion,
      activeVersion: ordered.activeVersion,
      season: ordered.season,
    } satisfies CutoverCheckpoint;
    expect(await cutoverFingerprint(reordered)).toBe(
      await cutoverFingerprint(ordered),
    );
  });
});

describe('fingerprint field sensitivity', () => {
  it('changes for every checkpoint field', async () => {
    const base = await cutoverFingerprint(checkpointFor());
    const variants: CutoverCheckpoint[] = [
      checkpointFor({ season: 2025 }),
      checkpointFor({ activeVersion: 'v-cutover-other' }),
      checkpointFor({ previousVersion: 'v-cutover-previous' }),
      checkpointFor({ migrationIdentity: 'cutover-2026-staging-02' }),
      checkpointFor({
        historicalFloorEvidence: {
          kind: 'authorized-client-baseline-reset',
          evidenceReference: EVIDENCE_REFERENCE,
        },
      }),
      checkpointFor({
        historicalFloorEvidence: {
          kind: 'no-retained-pre-cutover-client-state',
          evidenceReference: 'AUDIT-2026-07-20/other',
        },
      }),
      checkpointFor({
        historicalFloorEvidence: {
          kind: 'audited-historical-upper-bound',
          auditedUpperBound: AUDITED_BOUND,
          evidenceReference: EVIDENCE_REFERENCE,
        },
      }),
    ];
    const seen = new Set([base]);
    for (const variant of variants) {
      const value = await cutoverFingerprint(variant);
      expect(seen.has(value)).toBe(false);
      seen.add(value);
    }
    expect(seen.size).toBe(variants.length + 1);
  });

  it('changes when only the audited upper bound differs', async () => {
    const withBound = (bound: string): CutoverCheckpoint =>
      checkpointFor({
        historicalFloorEvidence: {
          kind: 'audited-historical-upper-bound',
          auditedUpperBound: bound,
          evidenceReference: EVIDENCE_REFERENCE,
        },
      });
    expect(await cutoverFingerprint(withBound(AUDITED_BOUND))).not.toBe(
      await cutoverFingerprint(withBound('2026-06-02T00:00:00.000Z')),
    );
  });

  it('distinguishes an absent previous version from any named one', async () => {
    // Length framing plus a distinct absent marker: no field split can make two
    // different checkpoints render to one string.
    expect(cutoverFingerprintText(checkpointFor())).toContain('|-');
    expect(
      cutoverFingerprintText(checkpointFor({ previousVersion: 'x' })),
    ).not.toContain('|-|');
    expect(
      await cutoverFingerprint(checkpointFor({ previousVersion: null })),
    ).not.toBe(
      await cutoverFingerprint(checkpointFor({ previousVersion: 'x' })),
    );
  });

  it('frames every component with its own byte length', () => {
    const text = cutoverFingerprintText(checkpointFor());
    expect(text.startsWith('gv-cutover/1')).toBe(true);
    expect(text).toContain(`|4:${SEASON}`);
    expect(text).toContain('|16:v-cutover-active');
  });
});

describe('checkpoint decoding', () => {
  it('accepts a well-formed body and treats an absent previous version as null', () => {
    const decoded = decodeCutoverCheckpoint({
      season: SEASON,
      activeVersion: 'v-cutover-active',
      migrationIdentity: 'cutover-2026-staging-01',
      historicalFloorEvidence: {
        kind: 'no-retained-pre-cutover-client-state',
        evidenceReference: EVIDENCE_REFERENCE,
      },
      // Ignored: no confirmation or precondition is expressed by an absent
      // field, so an unknown one can never weaken this request.
      unexpectedField: 'ignored',
    });
    expect(decoded).toEqual(checkpointFor());
    expect(
      decodeCutoverCheckpoint({
        season: SEASON,
        activeVersion: 'v-cutover-active',
        previousVersion: null,
        migrationIdentity: 'cutover-2026-staging-01',
        historicalFloorEvidence: {
          kind: 'no-retained-pre-cutover-client-state',
          evidenceReference: EVIDENCE_REFERENCE,
        },
      }),
    ).toEqual(checkpointFor());
  });

  it('rejects a malformed body field by field', () => {
    const base = {
      season: SEASON,
      activeVersion: 'v-cutover-active',
      migrationIdentity: 'cutover-2026-staging-01',
      historicalFloorEvidence: {
        kind: 'no-retained-pre-cutover-client-state',
        evidenceReference: EVIDENCE_REFERENCE,
      },
    };
    for (const override of [
      { season: 12 },
      { season: '2026' },
      { activeVersion: '' },
      { activeVersion: 'has:colons' },
      { activeVersion: 42 },
      { previousVersion: 'has:colons' },
      { previousVersion: 7 },
      { migrationIdentity: '' },
      { migrationIdentity: 'has spaces' },
      { historicalFloorEvidence: undefined },
      { historicalFloorEvidence: 'no-retained-pre-cutover-client-state' },
    ]) {
      expect(decodeCutoverCheckpoint({ ...base, ...override })).toBeNull();
    }
    for (const notAnObject of [null, undefined, 'x', 7, [], true]) {
      expect(decodeCutoverCheckpoint(notAnObject)).toBeNull();
    }
  });

  it('never accepts an operator-supplied source ordering input', () => {
    // The checkpoint identifies a version; the version's own sidecar or its
    // validated uniform documents supply the provenance. There is no field for
    // an operator to type an ordering timestamp into, so one cannot be smuggled
    // in - it is ignored, and the fingerprint is unaffected.
    const decoded = decodeCutoverCheckpoint({
      season: SEASON,
      activeVersion: 'v-cutover-active',
      migrationIdentity: 'cutover-2026-staging-01',
      sourceOrderingInput: '2030-01-01T00:00:00.000Z',
      committedSourceOrderingInput: '2030-01-01T00:00:00.000Z',
      historicalFloorEvidence: {
        kind: 'no-retained-pre-cutover-client-state',
        evidenceReference: EVIDENCE_REFERENCE,
      },
    });
    expect(decoded).toEqual(checkpointFor());
    expect(JSON.stringify(decoded)).not.toContain('2030-01-01');
  });

  it('never accepts a caller-supplied fingerprint', async () => {
    const decoded = decodeCutoverCheckpoint({
      season: SEASON,
      activeVersion: 'v-cutover-active',
      migrationIdentity: 'cutover-2026-staging-01',
      cutoverFingerprint: 'cutover1:' + 'f'.repeat(64),
      historicalFloorEvidence: {
        kind: 'no-retained-pre-cutover-client-state',
        evidenceReference: EVIDENCE_REFERENCE,
      },
    });
    expect(decoded).not.toBeNull();
    expect(await cutoverFingerprint(decoded as CutoverCheckpoint)).not.toBe(
      'cutover1:' + 'f'.repeat(64),
    );
  });
});

describe('historical-floor evidence is a closed union', () => {
  it('accepts each documented variant, with its required reference', () => {
    for (const kind of historicalFloorEvidenceKinds) {
      const value =
        kind === 'audited-historical-upper-bound'
          ? { kind, auditedUpperBound: AUDITED_BOUND, evidenceReference: 'A-1' }
          : { kind, evidenceReference: 'A-1' };
      expect(decodeHistoricalFloorEvidence(value)).not.toBeNull();
    }
  });

  it('rejects a bare boolean, a free-form substitute and an unknown kind', () => {
    for (const value of [
      true,
      'audited',
      { satisfied: true },
      { kind: 'because-i-said-so', evidenceReference: 'A-1' },
      { kind: 'listVersions-scan', evidenceReference: 'A-1' },
      {},
      null,
    ]) {
      expect(decodeHistoricalFloorEvidence(value)).toBeNull();
    }
  });

  it('requires an audit reference on every variant', () => {
    for (const kind of historicalFloorEvidenceKinds) {
      const base =
        kind === 'audited-historical-upper-bound'
          ? { kind, auditedUpperBound: AUDITED_BOUND }
          : { kind };
      expect(decodeHistoricalFloorEvidence(base)).toBeNull();
      expect(
        decodeHistoricalFloorEvidence({ ...base, evidenceReference: '' }),
      ).toBeNull();
      expect(
        decodeHistoricalFloorEvidence({
          ...base,
          evidenceReference: 'has spaces and a very '.repeat(20),
        }),
      ).toBeNull();
    }
  });

  it('requires a usable audited upper bound on the variant that claims one', () => {
    for (const bound of [
      undefined,
      null,
      '',
      'yesterday',
      42,
      '2026-13-01T00:00:00Z',
    ]) {
      expect(
        decodeHistoricalFloorEvidence({
          kind: 'audited-historical-upper-bound',
          auditedUpperBound: bound,
          evidenceReference: 'A-1',
        }),
      ).toBeNull();
    }
  });
});
