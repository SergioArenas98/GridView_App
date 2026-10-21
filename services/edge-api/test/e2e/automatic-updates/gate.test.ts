/**
 * Release gate AU-3, in process: automatic updates end to end with
 * controlled data (ADR 0028 D10; `docs/release/automatic-updates.md`).
 *
 * Every case drives the Worker only through its scheduled handler, at
 * minute 17 of each hour as the `17 * * * *` Cron Trigger would, and reads it
 * only through public GETs. No admin route is called (the stage refuses
 * one), no capture is taken and no batch is submitted. A newly available
 * result must still reach a conditional client; a failure at any stage must
 * leave the last valid release served.
 *
 * The app half of the gate - the Flutter data layer itself refreshing from
 * the same stage over HTTP - is `app-gate.test.ts`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { COORDINATED_HEARTBEAT_OPERATION } from '../../../src/sync/coordinated/heartbeat';
import {
  AutomaticUpdateStage,
  ConditionalClient,
  DAY,
  HOUR,
  PRE_SEASON,
  anchorOf,
  later,
  tickAfterRace,
  type TickRecord,
} from './stage';

const globalFetch = vi.fn(async () => {
  throw new Error('the global fetch must not be reached');
});

beforeEach(() => {
  globalFetch.mockClear();
  vi.stubGlobal('fetch', globalFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  expect(globalFetch).not.toHaveBeenCalled();
});

const results = (round: number) =>
  `/v1/seasons/2026/grand-prix/${round}/results`;
const race = (round: number) => anchorOf(round).toISOString();

/** The winner's points, which tell the synthetic variants apart. */
async function winnerPoints(
  stage: AutomaticUpdateStage,
  round: number,
): Promise<number | null> {
  const response = await stage.fetch(results(round));
  if (response.status !== 200) return null;
  const body = (await response.json()) as {
    data: { entries: { position: number; points: number }[] };
  };
  return body.data.entries.find((entry) => entry.position === 1)!.points;
}

/** The first tick that committed a release, or `undefined`. */
const firstRelease = (ticks: readonly TickRecord[]) =>
  ticks.find((tick) => tick.releasesAfter > tick.releasesBefore);

/** The bootstrap observation and the season's first automatic release. */
async function started(
  environment: 'staging' | 'production' = 'staging',
): Promise<AutomaticUpdateStage> {
  const stage = await AutomaticUpdateStage.create(environment);
  await stage.tick(PRE_SEASON);
  await stage.tick(later(PRE_SEASON, HOUR));
  expect(stage.releases()).toHaveLength(1);
  return stage;
}

// Each case simulates days of hourly runs; the default 5 s is too short
// under the full parallel suite.
describe(
  'automatic updates, end to end (gate AU-3)',
  { timeout: 120_000 },
  () => {
    it('publishes a new result within the hour after its first check, and the client receives it', async () => {
      const stage = await started();
      // Jolpica has the result two hours after the race starts.
      stage.source.available(1, later(race(1), 2 * HOUR));
      const client = new ConditionalClient(stage);
      expect(await client.refresh(results(1))).toBe(404);
      expect(await client.refresh('/v1/content/manifest')).toBe(200);

      const ticks = await stage.hourly(
        tickAfterRace(1, -1),
        tickAfterRace(1, 30),
      );

      // The first check is due at race start + 5 h; the cron runs at :17.
      expect(firstRelease(ticks)?.at).toBe(tickAfterRace(1, 5));
      expect(stage.releases()).toHaveLength(2);
      expect(await client.refresh(results(1))).toBe(200);
      expect(await client.refresh('/v1/content/manifest')).toBe(200);
      // The release covers the season until the next race starts (ADR 0005,
      // calendar horizon), so the app is told exactly when to look again.
      expect(client.body(results(1))?.meta.staleAfter).toBe(race(2));
      // The heartbeat follows the last healthy tick.
      const status = (await (await stage.fetch('/v1/status')).json()) as {
        data: { lastSuccessfulSyncAt: string };
      };
      expect(status.data.lastSuccessfulSyncAt).toBe(tickAfterRace(1, 30));
      expect(
        stage.workerRequests.some((path) => path.startsWith('/internal')),
      ).toBe(false);
    });

    it('never publishes a duplicate: confirming checks change nothing', async () => {
      const stage = await started();
      stage.source.available(1, later(race(1), 2 * HOUR));
      await stage.hourly(tickAfterRace(1, -1), tickAfterRace(1, 5));
      const client = new ConditionalClient(stage);
      expect(await client.refresh(results(1))).toBe(200);
      const released = stage.releases().length;

      // The +9 h, +15 h and +24 h checks, and the daily ones after them.
      const checks = await stage.hourly(
        tickAfterRace(1, 6),
        tickAfterRace(1, 4 * 24),
      );

      expect(
        checks.filter((tick) => tick.requests.length > 0).length,
      ).toBeGreaterThan(3);
      expect(stage.releases()).toHaveLength(released);
      expect(
        checks
          .flatMap((tick) => tick.logs)
          .filter(
            (line) => line.operation === 'publication.sequencer.committed',
          ),
      ).toEqual([]);
      expect(await client.refresh(results(1))).toBe(304);
    });

    it('keeps serving the last release while a result is late, and publishes it at the next check', async () => {
      const stage = await started();
      stage.source.available(1, later(race(1), 7 * HOUR));
      const before = stage.activeVersion();

      const early = await stage.hourly(
        tickAfterRace(1, -1),
        tickAfterRace(1, 8),
      );
      expect(firstRelease(early)).toBeUndefined();
      expect(stage.activeVersion()).toBe(before);
      expect(await winnerPoints(stage, 1)).toBeNull();

      const next = await stage.hourly(tickAfterRace(1, 9), tickAfterRace(1, 9));
      expect(firstRelease(next)?.at).toBe(tickAfterRace(1, 9));
      expect(await winnerPoints(stage, 1)).toBe(25);
    });

    it('corroborates a correction made before the result settles, then publishes it', async () => {
      const stage = await started();
      stage.source
        .available(1, later(race(1), 2 * HOUR), 'A')
        .available(1, later(race(1), 8 * HOUR), 'B');

      await stage.hourly(tickAfterRace(1, -1), tickAfterRace(1, 9));
      // Published at +5 h; the +9 h check saw B once, and one sighting is
      // only pending (ADR 0020 D2.1).
      expect(await winnerPoints(stage, 1)).toBe(25);

      const corroborated = await stage.hourly(
        tickAfterRace(1, 10),
        tickAfterRace(1, 15),
      );
      expect(firstRelease(corroborated)?.at).toBe(tickAfterRace(1, 15));
      expect(await winnerPoints(stage, 1)).toBe(26);
    });

    it('stops for an operator on a correction after settlement, keeps the release, and the heartbeat stops', async () => {
      const stage = await started();
      stage.source
        .available(1, later(race(1), 2 * HOUR), 'A')
        .available(1, later(race(1), 4 * DAY), 'C')
        .available(2, later(race(2), 2 * HOUR), 'A');
      await stage.hourly(tickAfterRace(1, -1), tickAfterRace(1, 3 * 24));
      expect((await stage.harness.record(1))?.reviewState).toBe('settled');
      const settled = stage.activeVersion();

      const after = await stage.hourly(
        tickAfterRace(1, 3 * 24 + 1),
        tickAfterRace(2, 30),
      );

      // The settled round's correction is staged for review (ADR 0020 D2.5),
      // and the whole season is withheld meanwhile (O-5(a)): round 2's new
      // result is not published either.
      expect(firstRelease(after)).toBeUndefined();
      expect(stage.activeVersion()).toBe(settled);
      expect(await winnerPoints(stage, 1)).toBe(25);
      expect(await winnerPoints(stage, 2)).toBeNull();
      expect((await stage.harness.record(1))?.markers).toContain('staged');
      expect(
        (await stage.harness.season()).publicationDisposition,
      ).toMatchObject({
        state: 'blocked',
        reason: 'classification-staged',
      });
      // The heartbeat stopped at the last healthy run, which is what the
      // outside monitor alerts on.
      const status = (await (await stage.fetch('/v1/status')).json()) as {
        data: { lastSuccessfulSyncAt: string };
      };
      expect(Date.parse(status.data.lastSuccessfulSyncAt)).toBeLessThan(
        Date.parse(tickAfterRace(2, 10)),
      );
      expect(
        after
          .flatMap((tick) => tick.logs)
          .filter((line) => line.operation === COORDINATED_HEARTBEAT_OPERATION),
      ).toEqual([]);
    });

    it('retries hourly through a provider outage, keeps the release, and publishes once it ends', async () => {
      const stage = await started();
      stage.source
        .available(1, later(race(1), 2 * HOUR))
        .outage(later(race(1), 4 * HOUR), later(race(1), 14 * HOUR));
      const before = stage.activeVersion();

      const during = await stage.hourly(
        tickAfterRace(1, -1),
        tickAfterRace(1, 13),
      );
      expect(firstRelease(during)).toBeUndefined();
      expect(stage.activeVersion()).toBe(before);
      // At most one run an hour, each a bounded set of requests.
      for (const tick of during)
        expect(tick.requests.length).toBeLessThanOrEqual(7);

      const recovered = await stage.hourly(
        tickAfterRace(1, 14),
        tickAfterRace(1, 16),
      );
      expect(firstRelease(recovered)).toBeDefined();
      expect(await winnerPoints(stage, 1)).toBe(25);
    });

    it('recovers a lost commit answer without publishing twice', async () => {
      const stage = await started();
      stage.source.available(1, later(race(1), 2 * HOUR));
      await stage.hourly(tickAfterRace(1, -1), tickAfterRace(1, 4));
      // The sequencer commits the release, but every answer to `finalize` in
      // this tick is lost on the way back, as a stalled isolate would lose it.
      const transport = stage.harness.context.transport!;
      let lost = 0;
      transport.intercept = async (command, run) => {
        const answer = await run();
        if (command === 'finalize') {
          lost += 1;
          throw new Error('answer lost');
        }
        return answer;
      };
      await stage.tick(tickAfterRace(1, 5));
      transport.intercept = null;
      // The first answer and its one re-drive (ADR 0025 D4) were both lost.
      expect(lost).toBeGreaterThanOrEqual(1);
      const committed = stage.activeVersion();
      expect(await winnerPoints(stage, 1)).toBe(25);

      await stage.hourly(tickAfterRace(1, 6), tickAfterRace(1, 30));
      expect(stage.activeVersion()).toBe(committed);
      expect(new Set(stage.releases()).size).toBe(stage.releases().length);
      expect((await stage.harness.season()).publicationDisposition).toBeNull();
    });

    it('takes production from genesis to its first release and a race result, automatically', async () => {
      const stage = await AutomaticUpdateStage.create('production');
      expect((await stage.fetch('/v1/seasons/current')).status).toBe(503);

      const stagedStart = await started('production');
      expect((await stagedStart.fetch('/v1/seasons/current')).status).toBe(200);
      const authority =
        stagedStart.harness.context.coordinator.readAuthority(2026);
      expect(authority).toMatchObject({
        cutoverState: 'active',
        previousVersion: null,
      });

      stagedStart.source.available(1, later(race(1), 2 * HOUR));
      const ticks = await stagedStart.hourly(
        tickAfterRace(1, -1),
        tickAfterRace(1, 6),
      );
      expect(firstRelease(ticks)?.at).toBe(tickAfterRace(1, 5));
      expect(await winnerPoints(stagedStart, 1)).toBe(25);
      expect(
        stagedStart.workerRequests.some((path) => path.startsWith('/internal')),
      ).toBe(false);
    });

    it("stays inside Jolpica's limits and the run budget across a race weekend", async () => {
      const stage = await started();
      for (const round of [1, 2, 3]) {
        stage.source.available(round, later(race(round), 2 * HOUR));
      }
      const ticks = await stage.hourly(
        tickAfterRace(1, -1),
        tickAfterRace(3, 30),
      );

      // One run an hour: its requests are that hour's requests. The ceiling is
      // 6 season-level resources plus one per eligible round (O-3).
      const busiest = Math.max(...ticks.map((tick) => tick.requests.length));
      expect(busiest).toBeLessThanOrEqual(6 + 3);
      expect(busiest).toBeLessThan(500);
      const perDay = new Map<string, number>();
      for (const tick of ticks) {
        const day = tick.at.slice(0, 10);
        perDay.set(day, (perDay.get(day) ?? 0) + tick.requests.length);
      }
      expect(Math.max(...perDay.values())).toBeLessThan(200);
      // The real limiter never had to defer a request, and no run ran out of
      // budget.
      const lines = ticks.flatMap((tick) => tick.logs);
      for (const line of lines) {
        expect(
          line.reconciliationEvents?.['classification.check-deferred'] ?? 0,
        ).toBe(0);
        expect(line.reconciliationEvents?.['refresh.deferred'] ?? 0).toBe(0);
        expect(line.publicationReason).not.toBe('run-budget-exhausted');
      }
      expect(stage.releases().length).toBeGreaterThanOrEqual(4);
    });
  },
);
