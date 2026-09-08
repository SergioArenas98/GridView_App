/**
 * The reserved candidate-version namespace, and why absence of a sidecar is
 * decidable because of it (ADR 0025 D3).
 *
 * Every property here is asserted **without any Workers KV read, list or
 * existence check**: uniqueness and namespace membership are properties of the
 * identifier itself, never of what storage currently answers.
 */

import { describe, expect, it } from 'vitest';

import {
  candidateVersionForEpoch,
  epochOfCandidateVersion,
  maximumOperationEpoch,
  sidecarRequiredVersionPrefix,
  versionNamespace,
} from '../../../src/publication/sequencer';
import { parseVersionFromSnapshotKey } from '../../../src/storage/keys';
import { hexCounterSource } from './support';

describe('candidate version namespace', () => {
  it('mints every version in the reserved sidecar-required namespace', () => {
    const version = candidateVersionForEpoch(1, () => 'deadbeef');
    expect(version.startsWith(`${sidecarRequiredVersionPrefix}-`)).toBe(true);
    expect(versionNamespace(version)).toBe('sidecar-required');
  });

  it('encodes the allocating epoch injectively, so no two epochs collide', () => {
    const opaque = () => 'deadbeef';
    const seen = new Map<string, number>();
    for (const epoch of [1, 2, 3, 15, 16, 255, 4096, 1_000_000, 2 ** 40]) {
      const version = candidateVersionForEpoch(epoch, opaque);
      expect(seen.has(version)).toBe(false);
      seen.set(version, epoch);
      expect(epochOfCandidateVersion(version)).toBe(epoch);
    }
  });

  it('produces distinct versions for distinct epochs even when the opaque component repeats', () => {
    // The no-reuse property must never rest on the opaque component. With it
    // pinned to a constant, distinct epochs must still produce distinct
    // identifiers.
    const constant = () => '00000000';
    expect(candidateVersionForEpoch(7, constant)).not.toBe(
      candidateVersionForEpoch(8, constant),
    );
  });

  it('pads the epoch to a fixed width, so 1 and 01 can never name one epoch', () => {
    const one = candidateVersionForEpoch(1, () => 'aaaaaaaa');
    const sixteen = candidateVersionForEpoch(16, () => 'aaaaaaaa');
    const [, oneEpoch] = one.split('-');
    const [, sixteenEpoch] = sixteen.split('-');
    expect(oneEpoch).toHaveLength(13);
    expect(sixteenEpoch).toHaveLength(13);
    expect(oneEpoch).not.toBe(sixteenEpoch);
  });

  it('refuses an epoch outside the injectively representable range', () => {
    expect(() => candidateVersionForEpoch(0, () => 'aaaaaaaa')).toThrow(
      RangeError,
    );
    expect(() =>
      candidateVersionForEpoch(maximumOperationEpoch + 1, () => 'aaaaaaaa'),
    ).toThrow(RangeError);
  });

  it('is colon-free, so the snapshot key parsing boundary is unaffected', () => {
    const version = candidateVersionForEpoch(1234, hexCounterSource());
    expect(version).not.toContain(':');
    expect(
      parseVersionFromSnapshotKey(`snapshot:2026:${version}:calendar`, 2026),
    ).toBe(version);
  });

  it('classifies every identifier today’s generator can emit as legacy-format', () => {
    // `releaseVersionFor` emits `<ISO-8601 stripped of "-:.TZ">-<8 hex>`, which
    // always begins with a digit, so no already-published version can collide.
    for (const legacy of [
      '20260901T000000000-aaaaaaaa',
      '20250101000000000-0f0f0f0f',
      'v1',
      'pm1',
      'pm1-short-aaaaaaaa',
      'PM1-0000000000001-aaaaaaaa',
    ]) {
      expect(versionNamespace(legacy)).toBe('legacy-format');
      expect(epochOfCandidateVersion(legacy)).toBeNull();
    }
  });

  it('treats a historical identifier that resembles the reserved format as sidecar-required', () => {
    // Conservative by design: safety takes precedence over rollback
    // availability, so such a version is rejected when its sidecar is absent
    // rather than diverted onto the legacy fallback.
    expect(versionNamespace('pm1-0000000000009-abcdef01')).toBe(
      'sidecar-required',
    );
  });
});
