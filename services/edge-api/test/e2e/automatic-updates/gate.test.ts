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
 * Polling (ADR 0028 D5): a race's result is first asked for on the first tick
 * at or after its scheduled start + 1 h 30 min - the start of polling, not
 * evidence that the race has finished - then on every hourly tick while no
 * valid, complete result has been accepted, through the window's last check
 * at + 10 h 30 min, then at + 15 h, + 24 h and daily to day 14. For a race at
 * minute 00 the ticks are + 2 h 17 min, + 3 h 17 min, ... + 11 h 17 min.
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
  MINUTE,
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
/** `hours` (fractional allowed) after round `round`'s race start. */
const afterRace = (round: number, hours: number) =>
  later(race(round), Math.round(hours * 60) * MINUTE);

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

/** The ticks that asked Jolpica for `round`'s classification. */
const askedFor = (ticks: readonly TickRecord[], round: number) =>
  ticks
    .filter((tick) => tick.requests.includes(`/${round}/results/`))
    .map((tick) => tick.at);

/** The minute-17 ticks `fromHour` to `toHour` after round 1's start. */
const ticksAfterRace = (fromHour: number, toHour: number) =>
  Array.from({ length: toHour - fromHour + 1 }, (_, index) =>
    tickAfterRace(1, fromHour + index),
  );

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
  { timeout: 180_000 },
  () => {
    it('starts polling at race start + 1 h 30 min, publishes the result at that first check, and the client receives it', async () => {
      const stage = await started();
      // Jolpica has the result two hours after the race starts.
      stage.source.available(1, afterRace(1, 2));
      const client = new ConditionalClient(stage);
      expect(await client.refresh(results(1))).toBe(404);
      expect(await client.refresh('/v1/content/manifest')).toBe(200);

      const ticks = await stage.hourly(
        tickAfterRace(1, -1),
        tickAfterRace(1, 30),
      );

      // Nothing asks for the result before + 1 h 30 min; the first tick at or
      // after it is + 2 h 17 min, and it publishes.
      expect(askedFor(ticks, 1)[0]).toBe(tickAfterRace(1, 2));
      expect(firstRelease(ticks)?.at).toBe(tickAfterRace(1, 2));
      expect(stage.releases()).toHaveLength(2);
      expect(await client.refresh(results(1))).toBe(200);
      expect(await client.refresh('/v1/content/manifest')).toBe(200);
      // The release covers the season until the next race starts (ADR 0005,
      // calendar horizon), so the app is told exactly when to look again.
      expect(client.body(results(1))?.meta.staleAfter).toBe(race(2));
      // Accepted, the result is only confirmed afterwards: + 5 h 30 min,
      // + 9 h 30 min, + 15 h and + 24 h, never hourly.
      expect(askedFor(ticks, 1)).toEqual([
        tickAfterRace(1, 2),
        tickAfterRace(1, 6),
        tickAfterRace(1, 10),
        tickAfterRace(1, 15),
        tickAfterRace(1, 24),
      ]);
      // The heartbeat follows the last healthy tick.
      const status = (await (await stage.fetch('/v1/status')).json()) as {
        data: { lastSuccessfulSyncAt: string };
      };
      expect(status.data.lastSuccessfulSyncAt).toBe(tickAfterRace(1, 30));
      expect(
        stage.workerRequests.some((path) => path.startsWith('/internal')),
      ).toBe(false);
    });

    it.each([
      ['an on-time race, published two hours after the start', 2, 2],
      [
        'an unusually long race (red flags), published at + 3 h 45 min',
        3.75,
        4,
      ],
      ['a start delayed by three hours, published at + 5 h 30 min', 5.5, 6],
      ['a result first published at the window’s last check', 10.5, 11],
    ])(
      'asks hourly while the result is missing and publishes it on the next tick: %s',
      async (_label, availableAfterHours, publishedTickHour) => {
        const stage = await started();
        stage.source.available(1, afterRace(1, availableAfterHours));
        const before = stage.activeVersion();

        const ticks = await stage.hourly(
          tickAfterRace(1, -1),
          tickAfterRace(1, 12),
        );

        // Every tick from the first check to the publication asked for it.
        expect(askedFor(ticks, 1).slice(0, publishedTickHour - 1)).toEqual(
          ticksAfterRace(2, publishedTickHour),
        );
        const published = firstRelease(ticks);
        expect(published?.at).toBe(tickAfterRace(1, publishedTickHour));
        // Until then the previous release kept serving, untouched.
        for (const tick of ticks) {
          if (tick.at < published!.at) {
            expect(tick.releasesAfter).toBe(tick.releasesBefore);
          }
        }
        expect(before).not.toBe(stage.activeVersion());
        expect(await winnerPoints(stage, 1)).toBe(25);
      },
    );

    it('backs off after the window: a late Jolpica publication appears at the next back-off check', async () => {
      const stage = await started();
      stage.source.available(1, afterRace(1, 12));
      const before = stage.activeVersion();

      const window = await stage.hourly(
        tickAfterRace(1, -1),
        tickAfterRace(1, 14),
      );
      // Ten hourly checks, + 2 h 17 min to + 11 h 17 min, then none until
      // + 15 h, although Jolpica has had the result since + 12 h.
      expect(askedFor(window, 1)).toEqual(ticksAfterRace(2, 11));
      expect(firstRelease(window)).toBeUndefined();
      expect(stage.activeVersion()).toBe(before);
      expect(await winnerPoints(stage, 1)).toBeNull();

      const backoff = await stage.hourly(
        tickAfterRace(1, 15),
        tickAfterRace(1, 15),
      );
      expect(firstRelease(backoff)?.at).toBe(tickAfterRace(1, 15));
      expect(await winnerPoints(stage, 1)).toBe(25);
    });

    it('keeps asking on a bounded schedule while a result is missing, then stops, never publishing one', async () => {
      const stage = await started();

      const ticks = await stage.hourly(
        tickAfterRace(1, -1),
        tickAfterRace(1, 15 * 24),
      );

      // 10 hourly checks, + 15 h, + 24 h, and days 2 to 14: 25, then none.
      expect(askedFor(ticks, 1)).toEqual([
        ...ticksAfterRace(2, 11),
        tickAfterRace(1, 15),
        tickAfterRace(1, 24),
        ...Array.from({ length: 13 }, (_, day) =>
          tickAfterRace(1, (day + 2) * 24),
        ),
      ]);
      // Every run that asked was withheld whole (O-5(a)), so none released.
      // Releases between them are the calendar's own (Home moves on to the
      // next race at its start) and carry no round 1 result.
      const asking = new Set(askedFor(ticks, 1));
      for (const tick of ticks.filter((entry) => asking.has(entry.at))) {
        expect(tick.releasesAfter).toBe(tick.releasesBefore);
      }
      expect(await winnerPoints(stage, 1)).toBeNull();
      expect((await stage.harness.record(1))?.terminalReason).toBe(
        'never-reconciled-abandoned',
      );
    });

    it('rejects a structurally incomplete page, keeps asking hourly, and publishes the complete result', async () => {
      const stage = await started();
      stage.source.incomplete(1, afterRace(1, 2)).available(1, afterRace(1, 4));
      const before = stage.activeVersion();

      const ticks = await stage.hourly(
        tickAfterRace(1, -1),
        tickAfterRace(1, 6),
      );

      // + 2 h 17 min and + 3 h 17 min read the incomplete page: neither is
      // accepted, and nothing is published from it.
      for (const tick of ticks.filter((entry) => entry.at < afterRace(1, 4))) {
        expect(tick.releasesAfter).toBe(tick.releasesBefore);
      }
      expect(askedFor(ticks, 1).slice(0, 3)).toEqual(ticksAfterRace(2, 4));
      expect(firstRelease(ticks)?.at).toBe(tickAfterRace(1, 4));
      expect(before).not.toBe(stage.activeVersion());
      expect(await winnerPoints(stage, 1)).toBe(25);
    });

    it('replaces a self-consistent but short classification once the complete one is corroborated', async () => {
      // Variant D is A without its last classified driver, on a page whose
      // `total` agrees: nothing structural tells it from a complete result.
      const stage = await started();
      stage.source
        .available(1, afterRace(1, 2), 'D')
        .available(1, afterRace(1, 3), 'A');
      const client = new ConditionalClient(stage);

      const ticks = await stage.hourly(
        tickAfterRace(1, -1),
        tickAfterRace(1, 8),
      );

      const releases = ticks.filter(
        (tick) => tick.releasesAfter > tick.releasesBefore,
      );
      // Published as first seen; A is sighted at the + 5 h 30 min
      // confirmation, pending, asked for again on the next hourly tick, and
      // published there (ADR 0020 D2.1).
      expect(releases.map((tick) => tick.at)).toEqual([
        tickAfterRace(1, 2),
        tickAfterRace(1, 7),
      ]);
      expect(askedFor(ticks, 1)).toEqual([
        tickAfterRace(1, 2),
        tickAfterRace(1, 6),
        tickAfterRace(1, 7),
      ]);
      expect(await client.refresh(results(1))).toBe(200);
      const entries = client.body<{ data: { entries: unknown[] } }>(results(1))!
        .data.entries;
      expect(entries.length).toBeGreaterThan(1);
      expect((await stage.harness.record(1))?.supersededRevisions).toHaveLength(
        1,
      );
    });

    it('never publishes a duplicate: confirming checks change nothing', async () => {
      const stage = await started();
      stage.source.available(1, afterRace(1, 2));
      await stage.hourly(tickAfterRace(1, -1), tickAfterRace(1, 5));
      const client = new ConditionalClient(stage);
      expect(await client.refresh(results(1))).toBe(200);
      const released = stage.releases().length;

      // The + 5 h 30 min, + 9 h 30 min, + 15 h and + 24 h checks, and the
      // daily ones after them.
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

    it('corroborates a correction made before the result settles, then publishes it', async () => {
      const stage = await started();
      stage.source
        .available(1, afterRace(1, 2), 'A')
        .available(1, afterRace(1, 8), 'B');

      await stage.hourly(tickAfterRace(1, -1), tickAfterRace(1, 10));
      // Published at + 2 h 17 min; the + 9 h 30 min confirmation (the
      // + 10 h 17 min tick) saw B once, and one sighting is only pending
      // (ADR 0020 D2.1).
      expect(await winnerPoints(stage, 1)).toBe(25);

      const corroborated = await stage.hourly(
        tickAfterRace(1, 11),
        tickAfterRace(1, 15),
      );
      // Pending, the round is asked for on the next hourly tick again.
      expect(firstRelease(corroborated)?.at).toBe(tickAfterRace(1, 11));
      expect(await winnerPoints(stage, 1)).toBe(26);
    });

    it('stops for an operator on a correction after settlement, keeps the release, and the heartbeat stops', async () => {
      const stage = await started();
      stage.source
        .available(1, afterRace(1, 2), 'A')
        .available(1, later(race(1), 4 * DAY), 'C')
        .available(2, afterRace(2, 2), 'A');
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
        .available(1, afterRace(1, 2))
        .outage(afterRace(1, 1), afterRace(1, 6));
      const before = stage.activeVersion();

      const during = await stage.hourly(
        tickAfterRace(1, -1),
        tickAfterRace(1, 5),
      );
      expect(firstRelease(during)).toBeUndefined();
      expect(stage.activeVersion()).toBe(before);
      // At most one run an hour, each a bounded set of requests; every tick
      // of the window asked again.
      for (const tick of during)
        expect(tick.requests.length).toBeLessThanOrEqual(7);
      expect(askedFor(during, 1)).toEqual(ticksAfterRace(2, 5));

      const recovered = await stage.hourly(
        tickAfterRace(1, 6),
        tickAfterRace(1, 7),
      );
      expect(firstRelease(recovered)?.at).toBe(tickAfterRace(1, 6));
      expect(await winnerPoints(stage, 1)).toBe(25);
    });

    it('recovers a lost commit answer without publishing twice', async () => {
      const stage = await started();
      stage.source.available(1, afterRace(1, 4.5));
      await stage.hourly(tickAfterRace(1, -1), tickAfterRace(1, 4));
      expect(await winnerPoints(stage, 1)).toBeNull();
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

      stagedStart.source.available(1, afterRace(1, 2));
      const ticks = await stagedStart.hourly(
        tickAfterRace(1, -1),
        tickAfterRace(1, 6),
      );
      expect(firstRelease(ticks)?.at).toBe(tickAfterRace(1, 2));
      expect(await winnerPoints(stagedStart, 1)).toBe(25);
      expect(
        stagedStart.workerRequests.some((path) => path.startsWith('/internal')),
      ).toBe(false);
    });

    it("stays inside Jolpica's limits and the run budget across race weekends, a missing result included", async () => {
      const stage = await started();
      for (const round of [1, 2]) {
        stage.source.available(round, afterRace(round, 2));
      }
      // Round 3's result never appears: its whole window is spent asking.
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
      // The missing result was asked for 12 times in its first 30 hours: ten
      // hourly checks, then + 15 h and + 24 h.
      expect(askedFor(ticks, 3)).toHaveLength(12);
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
      expect(await winnerPoints(stage, 2)).toBe(25);
      expect(await winnerPoints(stage, 3)).toBeNull();
    });
  },
);
