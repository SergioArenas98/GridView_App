/**
 * The cutover control is off by default, fails closed when malformed, and is
 * scoped to exactly one season (ADR 0025 D12 step 1).
 *
 * The behavioural half of the claim `inertness.test.ts` makes structurally:
 * declaring an export and a staging binding enables nothing, because no
 * committed environment sets either `SEASON_PUBLICATION_AUTHORITY` or
 * `SEASON_PUBLICATION_CUTOVER_CONTROL`.
 */

import { describe, expect, it } from 'vitest';

import {
  ConfigurationError,
  resolvePublicationCutoverControl,
  resolveRuntimeConfig,
} from '../../../src/config/environment';
import {
  parseCutoverControl,
  pausesSeason,
} from '../../../src/publication/cutover/control';
import { CutoverPausedPublicationCommands } from '../../../src/publication/cutover/admission';
import { consequenceForRejectedPublication } from '../../../src/sync/sync-service';
import type { PublicationCommands } from '../../../src/publication/commands';
import type { GeneratedSnapshotSet } from '../../../src/snapshots/generator';
import type {
  ManualCachePurgeResult,
  PublicationResult,
} from '../../../src/publication/publisher';
import { SEASON, OTHER_SEASON } from './support';

/** Records every call that reaches the wrapped surface. */
class RecordingCommands implements PublicationCommands {
  readonly calls: string[] = [];

  async publish(set: GeneratedSnapshotSet): Promise<PublicationResult> {
    this.calls.push(`publish:${set.season}`);
    return applied(set.season, set.version);
  }

  async rollback(
    season: number,
    targetVersion?: string,
  ): Promise<PublicationResult> {
    this.calls.push(`rollback:${season}`);
    return applied(season, targetVersion ?? 'v-target');
  }

  async purgeActiveVersion(season: number): Promise<ManualCachePurgeResult> {
    this.calls.push(`purge:${season}`);
    return {
      season,
      activeVersion: 'v-active',
      ok: true,
      reason: null,
      urls: [],
    };
  }
}

function applied(season: number, version: string): PublicationResult {
  return {
    status: 'applied',
    season,
    version,
    previousVersion: null,
    reason: null,
    cachePurgeOk: true,
    cachePurge: 'succeeded',
    pointerMaintenance: 'not-required',
    purgedUrls: [],
  };
}

function setFor(season: number): GeneratedSnapshotSet {
  return {
    season,
    version: 'v-candidate',
    sourceUpdatedAt: '2026-07-18T11:55:00.000Z',
    documents: [],
  } as unknown as GeneratedSnapshotSet;
}

describe('the cutover control is absent by default', () => {
  it('resolves an unset or empty value to disabled', () => {
    expect(parseCutoverControl(undefined)).toEqual({ kind: 'disabled' });
    expect(parseCutoverControl('')).toEqual({ kind: 'disabled' });
    expect(resolvePublicationCutoverControl(undefined)).toEqual({
      kind: 'disabled',
    });
  });

  it('leaves the default runtime configuration disabled', () => {
    const config = resolveRuntimeConfig({
      ENVIRONMENT: 'staging',
      PROVIDER_MODE: 'mock',
    });
    expect(config.publicationCutoverControl).toEqual({ kind: 'disabled' });
    expect(config.publicationAuthorityMode).toBe('legacy');
  });

  it('changes nothing about the publication surface when disabled', async () => {
    // The composition returns the inner commands untouched, so there is no
    // decorator to test - which is the point. A disabled control is proven by
    // `pausesSeason` never being true for any season.
    for (const season of [SEASON, OTHER_SEASON, 1900, 9999]) {
      expect(pausesSeason({ kind: 'disabled' }, season)).toBe(false);
    }
  });
});

describe('a malformed control fails closed', () => {
  it('never resolves a malformed non-empty value to disabled', () => {
    for (const value of [
      'seed',
      'sead:2026',
      'seed:20261',
      'seed:26',
      'seed:0999',
      'seed: 2026',
      ' seed:2026',
      'seed:2026 ',
      'SEED:2026',
      'activate',
      'activate:abcd',
      'seed:2026:extra',
      'true',
    ]) {
      expect(parseCutoverControl(value)).toBeNull();
      expect(() => resolvePublicationCutoverControl(value)).toThrow(
        ConfigurationError,
      );
    }
  });

  it('fails the whole runtime configuration rather than pausing nothing', () => {
    expect(() =>
      resolveRuntimeConfig({
        ENVIRONMENT: 'staging',
        PROVIDER_MODE: 'mock',
        SEASON_PUBLICATION_CUTOVER_CONTROL: 'seed:20xx',
      }),
    ).toThrow(ConfigurationError);
  });

  it('does not echo the supplied value in the failure', () => {
    try {
      resolvePublicationCutoverControl('seed:not-a-season-but-secret-looking');
      throw new Error('expected a ConfigurationError');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      expect((error as Error).message).not.toContain('secret-looking');
    }
  });
});

describe('a valid control names exactly one season and one phase', () => {
  it('parses both phases for a supported season', () => {
    expect(parseCutoverControl('seed:2026')).toEqual({
      kind: 'seed',
      season: 2026,
    });
    expect(parseCutoverControl('activate:2026')).toEqual({
      kind: 'activate',
      season: 2026,
    });
  });

  it('pauses only the named season, in either phase', () => {
    for (const kind of ['seed', 'activate'] as const) {
      const control = { kind, season: SEASON } as const;
      expect(pausesSeason(control, SEASON)).toBe(true);
      expect(pausesSeason(control, OTHER_SEASON)).toBe(false);
    }
  });
});

describe('admission closure', () => {
  it('refuses publication and rollback for the paused season only', async () => {
    const inner = new RecordingCommands();
    const gate = new CutoverPausedPublicationCommands(inner, SEASON);

    const publish = await gate.publish(setFor(SEASON));
    const rollback = await gate.rollback(SEASON, 'v-target');

    expect(publish).toMatchObject({
      status: 'rejected',
      season: SEASON,
      reason: 'season-paused-for-cutover',
      cachePurge: 'not-required',
      pointerMaintenance: 'not-required',
    });
    expect(rollback).toMatchObject({
      status: 'rejected',
      reason: 'season-paused-for-cutover',
    });
    // Nothing reached the wrapped surface, so `SnapshotPublisher` was never
    // called: the refusal happens before any publisher, not inside one.
    expect(inner.calls).toEqual([]);
  });

  it('leaves every other season usable', async () => {
    const inner = new RecordingCommands();
    const gate = new CutoverPausedPublicationCommands(inner, SEASON);

    expect((await gate.publish(setFor(OTHER_SEASON))).status).toBe('applied');
    expect((await gate.rollback(OTHER_SEASON)).status).toBe('applied');
    expect(inner.calls).toEqual([
      `publish:${OTHER_SEASON}`,
      `rollback:${OTHER_SEASON}`,
    ]);
  });

  it('keeps the operator cache purge available for the paused season', async () => {
    const inner = new RecordingCommands();
    const gate = new CutoverPausedPublicationCommands(inner, SEASON);
    const purge = await gate.purgeActiveVersion(SEASON);
    expect(purge.ok).toBe(true);
    expect(inner.calls).toEqual([`purge:${SEASON}`]);
  });

  it('treats the pause as an operational refusal, not a benign no-op', () => {
    // `older-source-updated-at` is the one benign rejection. A cutover pause is
    // not one: recording it as a completed run would advance `lastCompletedAt`
    // and mark every due job successful for the length of the cutover.
    expect(consequenceForRejectedPublication('older-source-updated-at')).toBe(
      'completed-no-op',
    );
    expect(consequenceForRejectedPublication('season-paused-for-cutover')).toBe(
      'failed',
    );
  });
});
