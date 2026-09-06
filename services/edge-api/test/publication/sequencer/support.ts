/**
 * Shared scaffolding for the season publication sequencer's deterministic
 * tests.
 *
 * Every source of non-determinism the mechanism has - the clock, the operation
 * token and the candidate version's opaque component - is injected here, so a
 * test asserts exact values rather than shapes. Nothing here touches Workers KV,
 * a Durable Object binding, a provider port or the network.
 */

import {
  MemorySequencerHost,
  SeasonPublicationCoordinator,
  type CutoverSeed,
  type PerKeyRevision,
  type PerKeyState,
  type SequencerOptions,
} from '../../../src/publication/sequencer';
import type { Clock } from '../../../src/runtime/clock';
import type { SnapshotDocumentName } from '../../../src/storage/types';

export const SEASON = 2026;
export const OTHER_SEASON = 2025;
export const FINGERPRINT = 'cutover-2026-a1';
export const SEED_ACTIVE_VERSION = '20260901T000000000-aaaaaaaa';
export const SEED_ORDERING_INPUT = '2026-09-01T00:00:00.000Z';
export const SEED_HIGH_WATER_MARK = '2026-09-01T00:00:00.000Z';

/** A distinct, well-formed `snapshotRevision` for a test key. */
export function rev(seed: string): string {
  const body = [...seed]
    .map((character) => character.codePointAt(0)!.toString(16).padStart(2, '0'))
    .join('');
  return `sha256:${body.padEnd(64, '0').slice(0, 64)}`;
}

/**
 * A well-formed manifest commitment, without hashing anything.
 *
 * `prepare` accepts the commitment as an input and never derives it, so a test
 * that only needs *a* valid commitment does not have to compute a real one.
 * `manifest-commitment.test.ts` covers the real construction.
 */
export function commitment(seed: string): string {
  return rev(seed);
}

/** A clock a test advances explicitly. Never the host's own. */
export class MutableClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return new Date(this.current.getTime());
  }

  set(value: string): void {
    this.current = new Date(value);
  }

  advance(millis: number): void {
    this.current = new Date(this.current.getTime() + millis);
  }
}

/** Deterministic token and opaque-component sources. */
export function counterSource(prefix: string): () => string {
  let next = 0;
  return () => {
    next += 1;
    return `${prefix}${next}`;
  };
}

export function hexCounterSource(): () => string {
  let next = 0;
  return () => {
    next += 1;
    return next.toString(16).padStart(8, '0');
  };
}

export interface Harness {
  readonly host: MemorySequencerHost;
  readonly clock: MutableClock;
  readonly sequencer: SeasonPublicationCoordinator;
}

export function makeSequencer(
  options: {
    host?: MemorySequencerHost;
    now?: string;
    preparationTtlMs?: number;
  } = {},
): Harness {
  const host = options.host ?? new MemorySequencerHost();
  const clock = new MutableClock(
    new Date(options.now ?? '2026-09-02T00:00:00.000Z'),
  );
  const sequencerOptions: SequencerOptions = {
    clock,
    token: counterSource('token-'),
    opaqueVersionComponent: hexCounterSource(),
    ...(options.preparationTtlMs === undefined
      ? {}
      : { preparationTtlMs: options.preparationTtlMs }),
  };
  return {
    host,
    clock,
    sequencer: new SeasonPublicationCoordinator(host, sequencerOptions),
  };
}

export function keyState(
  documentName: string,
  revision: string,
  observedAt: string,
): PerKeyState {
  return {
    documentName: documentName as SnapshotDocumentName,
    revision,
    observedAt,
  };
}

export function keyRevision(
  documentName: string,
  revision: string,
): PerKeyRevision {
  return { documentName: documentName as SnapshotDocumentName, revision };
}

export function seedFor(overrides: Partial<CutoverSeed> = {}): CutoverSeed {
  return {
    season: SEASON,
    cutoverFingerprint: FINGERPRINT,
    activeVersion: SEED_ACTIVE_VERSION,
    previousVersion: null,
    committedSourceOrderingInput: SEED_ORDERING_INPUT,
    perKeyState: [
      keyState('calendar', rev('calendar-1'), SEED_HIGH_WATER_MARK),
      keyState('standings:drivers', rev('standings-1'), SEED_HIGH_WATER_MARK),
    ],
    seasonSnapshotObservedAtHighWaterMark: SEED_HIGH_WATER_MARK,
    ...overrides,
  };
}

/** A sequencer already seeded and activated, which is the only state that publishes. */
export function activeSequencer(
  options: Parameters<typeof makeSequencer>[0] = {},
  seed: CutoverSeed = seedFor(),
): Harness {
  const harness = makeSequencer(options);
  const seeded = harness.sequencer.seedCutover(seed);
  if (seeded.outcome !== 'seeded') {
    throw new Error(`seed failed: ${JSON.stringify(seeded)}`);
  }
  const activated = harness.sequencer.activateCutover({
    season: seed.season,
    cutoverFingerprint: seed.cutoverFingerprint,
  });
  if (activated.outcome !== 'activated') {
    throw new Error(`activation failed: ${JSON.stringify(activated)}`);
  }
  return harness;
}

/** The prepare request every test starts from, with per-test overrides. */
export function prepareRequest(
  overrides: {
    season?: number;
    operationKind?: 'ordinary-publication' | 'rollback-republication';
    perKeyRevisions?: readonly PerKeyRevision[];
    sourceOrderingInput?: string;
    expectedManifestCommitment?: string;
  } = {},
) {
  return {
    season: SEASON,
    operationKind: 'ordinary-publication' as const,
    perKeyRevisions: [
      keyRevision('calendar', rev('calendar-1')),
      keyRevision('standings:drivers', rev('standings-1')),
    ],
    sourceOrderingInput: '2026-09-02T00:00:00.000Z',
    expectedManifestCommitment: commitment('manifest-1'),
    ...overrides,
  };
}
