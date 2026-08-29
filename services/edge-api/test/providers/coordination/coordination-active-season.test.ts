/**
 * Active-season publication: a season that is part-run must be publishable.
 *
 * The curated fixture is a *finished* season - every calendar round already has
 * its race classification - so the ordinary in-season shape, where some rounds
 * have been raced and the rest have not, is not exercised anywhere else. This
 * file supplies that shape deliberately, because the completeness rule is only
 * interesting when the two kinds of round coexist.
 */

import { describe, expect, it } from 'vitest';

import { CapturingLogger } from '../../../src/logging/logger';
import {
  CoordinatedSeasonPublication,
  MultiSourceCoordinator,
  assembleSeasonSource,
  type CoordinatedResource,
  type CoordinationRun,
} from '../../../src/providers/coordination';
import { EVENT_STATUSES } from '../../../src/contract/enums';
import type { EventStatus } from '../../../src/contract/enums';
import type { ProviderSeasonSource } from '../../../src/providers/formula-one-provider';
import {
  FIXED_NOW,
  SEASON,
  completePort,
  metadataFor,
  publicationHarness,
  raceResource,
  rounds,
  seasonFixture,
  seasonResources,
  type PublicationHarness,
} from './support';

const VERSION = 'v1';

/**
 * The curated finished season, re-shaped as an **active** one.
 *
 * The last calendar round becomes a future event and loses its classification;
 * every earlier round keeps its completed status and its race result. Nothing
 * is invented: the future round is the fixture's own event with its status
 * changed and its result withheld, which is exactly what an in-season source
 * looks like.
 */
async function activeSeason(futureStatus: EventStatus = 'scheduled'): Promise<{
  source: ProviderSeasonSource;
  completedRounds: number[];
  futureRound: number;
}> {
  const base = await seasonFixture();
  const all = rounds(base);
  const futureRound = all[all.length - 1];
  if (futureRound === undefined) throw new Error('fixture gap');
  const completedRounds = all.filter((round) => round !== futureRound);

  const source: ProviderSeasonSource = {
    ...base,
    calendar: base.calendar.map((event) =>
      event.round === futureRound
        ? { ...event, status: futureStatus, hasResults: false }
        : { ...event, status: 'completed' },
    ),
    results: base.results.filter((result) => result.round !== futureRound),
  };
  return { source, completedRounds, futureRound };
}

/** The realistic in-season plan: classifications only for rounds that ran. */
function activePlan(completedRounds: readonly number[]): CoordinatedResource[] {
  return [
    ...seasonResources,
    ...completedRounds.map((round) => raceResource(round)),
  ];
}

function coordinate(
  source: ProviderSeasonSource,
  resources: readonly CoordinatedResource[],
  logger = new CapturingLogger(),
): Promise<CoordinationRun> {
  return new MultiSourceCoordinator({
    ports: [completePort('jolpica', source)],
    logger,
  }).coordinate({ plan: { season: SEASON, resources } });
}

function publish(
  harness: PublicationHarness,
  run: CoordinationRun,
  source: ProviderSeasonSource,
): Promise<Awaited<ReturnType<CoordinatedSeasonPublication['publish']>>> {
  return new CoordinatedSeasonPublication({
    publisher: harness.publisher,
    logger: harness.logger,
  }).publish(run, metadataFor(source), FIXED_NOW, VERSION);
}

describe('an active season publishes without results for future rounds', () => {
  it('does not withhold the season because a future round has no race result', async () => {
    const { source, completedRounds } = await activeSeason();
    const harness = publicationHarness();

    const run = await coordinate(source, activePlan(completedRounds));
    const assembly = assembleSeasonSource(run, metadataFor(source));
    const outcome = await publish(harness, run, source);

    expect(run.status).toBe('completed');
    expect(assembly.complete).toBe(true);
    expect(outcome.outcome).toBe('published');
    expect(harness.publishCalls).toBe(1);
    expect(await harness.storage.getActiveVersion(SEASON)).toBe(VERSION);
  });

  it('emits no results document for the future round', async () => {
    const { source, completedRounds, futureRound } = await activeSeason();
    const harness = publicationHarness();

    const run = await coordinate(source, activePlan(completedRounds));
    await publish(harness, run, source);

    expect(
      await harness.storage.readVersionedDocument(
        SEASON,
        VERSION,
        `grand-prix:${futureRound}:results`,
      ),
    ).toBeNull();
    // The event document itself is still published: the round exists, only its
    // classification is meaningfully absent.
    expect(
      await harness.storage.readVersionedDocument(
        SEASON,
        VERSION,
        `grand-prix:${futureRound}`,
      ),
    ).not.toBeNull();
    for (const round of completedRounds) {
      expect(
        await harness.storage.readVersionedDocument(
          SEASON,
          VERSION,
          `grand-prix:${round}:results`,
        ),
      ).not.toBeNull();
    }
  });

  it('still blocks publication when a completed round lost its result', async () => {
    const { source, completedRounds } = await activeSeason();
    const dropped = completedRounds[0];
    if (dropped === undefined) throw new Error('fixture gap');
    const harness = publicationHarness();

    const run = await coordinate(
      source,
      activePlan(completedRounds.filter((round) => round !== dropped)),
    );
    const assembly = assembleSeasonSource(run, metadataFor(source));
    const outcome = await publish(harness, run, source);

    expect(assembly.complete).toBe(false);
    if (!assembly.complete) {
      expect(assembly.gap).toBe('missing-round-classification');
      expect(
        assembly.missing.map((resource) =>
          resource.kind === 'session-classification' ? resource.round : null,
        ),
      ).toEqual([dropped]);
    }
    expect(outcome.outcome).toBe('withheld');
    expect(harness.publishCalls).toBe(0);
  });

  it('resolves every event status explicitly', async () => {
    // Whatever the rule turns out to be, it must be a *total* function of the
    // closed status union - never an accident of which statuses a fixture
    // happens to contain.
    const requiresResult: Record<EventStatus, boolean> = {
      scheduled: false,
      upcoming: false,
      in_progress: false,
      completed: true,
      postponed: false,
      cancelled: false,
      unknown: false,
    };
    expect(Object.keys(requiresResult).sort()).toEqual(
      [...EVENT_STATUSES].sort(),
    );

    for (const status of EVENT_STATUSES) {
      const { source, completedRounds } = await activeSeason(status);
      const harness = publicationHarness();
      const run = await coordinate(source, activePlan(completedRounds));
      const assembly = assembleSeasonSource(run, metadataFor(source));
      await publish(harness, run, source);

      const blocked =
        !assembly.complete && assembly.gap === 'missing-round-classification';
      expect(blocked, `status ${status}`).toBe(requiresResult[status]);
    }
  });

  it('keeps the prior active release when a completed round is missing', async () => {
    const { source, completedRounds } = await activeSeason();
    const harness = publicationHarness();
    const healthy = await coordinate(source, activePlan(completedRounds));
    await publish(harness, healthy, source);
    expect(await harness.storage.getActiveVersion(SEASON)).toBe(VERSION);

    const dropped = completedRounds[0];
    if (dropped === undefined) throw new Error('fixture gap');
    const broken = await coordinate(
      source,
      activePlan(completedRounds.filter((round) => round !== dropped)),
    );
    const outcome = await new CoordinatedSeasonPublication({
      publisher: harness.publisher,
      logger: harness.logger,
    }).publish(broken, metadataFor(source), FIXED_NOW, 'v2');

    expect(outcome.outcome).toBe('withheld');
    expect(harness.publishCalls).toBe(1);
    expect(await harness.storage.getActiveVersion(SEASON)).toBe(VERSION);
  });

  it('is deterministic under reversed plan order', async () => {
    const { source, completedRounds } = await activeSeason();
    const forward = activePlan(completedRounds);
    const reversed = [...forward].reverse();

    for (const plan of [forward, reversed]) {
      const harness = publicationHarness();
      const run = await coordinate(source, plan);
      const outcome = await publish(harness, run, source);
      expect(outcome.outcome).toBe('published');
      expect(await harness.storage.getActiveVersion(SEASON)).toBe(VERSION);
    }
  });
});
