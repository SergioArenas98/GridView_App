/**
 * The manifest commitment a caller computes **before** `prepare` is ever
 * called (ADR 0025 D3, D4).
 *
 * It commits to document names only, so it is version-independent - which is
 * exactly what lets it exist before the sequencer allocates a destination
 * version. `prepare` accepts it as an input and never derives it.
 */

import { describe, expect, it } from 'vitest';

import {
  isManifestCommitment,
  manifestCommitment,
  manifestCommitmentText,
} from '../../../src/publication/sequencer';
import type { SnapshotDocumentName } from '../../../src/storage/types';

const manifest = [
  'calendar',
  'home',
  'standings:drivers',
  'grand-prix:1',
  'grand-prix:1:results',
] as SnapshotDocumentName[];

describe('manifest commitment', () => {
  it('is deterministic for the same manifest', async () => {
    expect(await manifestCommitment(manifest)).toBe(
      await manifestCommitment(manifest),
    );
  });

  it('is independent of arrival order and of repeated names', async () => {
    const shuffled = [...manifest].reverse();
    const duplicated = [...manifest, ...manifest];
    const expected = await manifestCommitment(manifest);
    expect(await manifestCommitment(shuffled)).toBe(expected);
    expect(await manifestCommitment(duplicated)).toBe(expected);
  });

  it('distinguishes manifests that differ by one document', async () => {
    const withdrawn = manifest.filter((name) => name !== 'grand-prix:1');
    expect(await manifestCommitment(withdrawn)).not.toBe(
      await manifestCommitment(manifest),
    );
  });

  it('length-frames each name, so no concatenation can be confused for another', () => {
    const split = manifestCommitmentText([
      'ab',
      'c',
    ] as unknown as SnapshotDocumentName[]);
    const joined = manifestCommitmentText([
      'abc',
    ] as unknown as SnapshotDocumentName[]);
    expect(split).not.toBe(joined);
    expect(split).toContain('2:ab');
    expect(split).toContain('1:c');
  });

  it('carries its format version inside the hashed text', () => {
    expect(manifestCommitmentText(manifest).startsWith('gv-manifest/1|')).toBe(
      true,
    );
  });

  it('renders a self-describing digest the validator accepts', async () => {
    const value = await manifestCommitment(manifest);
    expect(value).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(isManifestCommitment(value)).toBe(true);
    expect(isManifestCommitment('not-a-commitment')).toBe(false);
    expect(isManifestCommitment(undefined)).toBe(false);
  });
});
