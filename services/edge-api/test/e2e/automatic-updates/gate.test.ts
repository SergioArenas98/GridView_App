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
 * A first sighting inside the window is held pending and published when the
 * next hourly tick sees it again (AU-D5); from the window's last check on, a
 * first sighting is published at once. Two equal sightings are not proof that
 * a classification is complete: they only keep a page that changed within the
 * hour from being published.
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

/** How many classified entries the API serves for `round`, or `null`. */
async function entryCount(
  stage: AutomaticUpdateStage,
  round: number,
): Promise<number | null> {
  const response = await stage.fetch(results(round));
  if (response.status !== 200) return null;
  const body = (await response.json()) as { data: { entries: unknown[] } };
  return body.data.entries.length;
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
    it('starts polling at race start + 1 h 30 min, publishes the result when the next check sees it again, and the client receives it', async () => {
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
      // after it is + 2 h 17 min, which sights it, and + 3 h 17 min, which
      // sees it again, publishes it (AU-D5).
      expect(askedFor(ticks, 1)[0]).toBe(tickAfterRace(1, 2));
      expect(firstRelease(ticks)?.at).toBe(tickAfterRace(1, 3));
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
        tickAfterRace(1, 3),
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
      ['an on-time race, served two hours after the start', 2, 3],
      ['an unusually long race (red flags), served at + 3 h 45 min', 3.75, 5],
      ['a start delayed by three hours, served at + 5 h 30 min', 5.5, 7],
      ['served one hour before the window’s last check', 9.5, 11],
      [
        'served by the window’s last check, which publishes it at once',
        10.5,
        11,
      ],
    ])(
      'asks hourly while the result is missing and publishes it once it is seen twice, or at the last check: %s',
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

    it.each([
      ['postponed three days, announced after its first check', 3, 3],
      ['postponed three days, announced just before its start', 3, -2],
      ['postponed sixteen days, past its first ceiling', 16, 3],
    ])(
      'follows a race the calendar moves after it was first asked for: %s',
      async (_label, days, announcedAfterHours) => {
        const stage = await started();
        const start = afterRace(1, days * 24);
        stage.source.reschedule(1, afterRace(1, announcedAfterHours), start);
        stage.source.available(1, later(start, 2 * HOUR));
        // The postponed race is the one under test: no later round runs.
        for (let round = 2; round <= 24; round += 1) {
          stage.source.reschedule(round, PRE_SEASON, later(start, round * DAY));
        }
        const tickAfterStart = (hours: number) =>
          later(start, hours * HOUR + 17 * MINUTE);

        const ticks = await stage.hourly(
          tickAfterRace(1, -3),
          tickAfterStart(30),
        );

        // Polling restarts from the new start: the first check at + 2 h 17
        // min sights the result and the next one publishes it (AU-D5), as for
        // a race that was never moved.
        const asked = askedFor(ticks, 1).filter((at) => at > start);
        expect(asked.slice(0, 2)).toEqual([
          tickAfterStart(2),
          tickAfterStart(3),
        ]);
        const published = ticks.find(
          (tick) => tick.at > start && tick.releasesAfter > tick.releasesBefore,
        );
        expect(published?.at).toBe(tickAfterStart(3));
        expect(await winnerPoints(stage, 1)).toBe(25);
        // The standings never ran ahead of an accepted result.
        const withheld = ticks.flatMap((tick) =>
          tick.logs.map((line) => String(line.publicationReason)),
        );
        expect(withheld).not.toContain('standings-round-incoherent');
        // It settles at + 24 h from the new start, as an on-time race does.
        expect(await stage.harness.record(1)).toMatchObject({
          anchor: start,
          terminalReason: 'settled',
        });
      },
    );

    it('rejects a structurally incomplete page, keeps asking hourly, and publishes the complete result', async () => {
      const stage = await started();
      stage.source.incomplete(1, afterRace(1, 2)).available(1, afterRace(1, 4));
      const before = stage.activeVersion();

      const ticks = await stage.hourly(
        tickAfterRace(1, -1),
        tickAfterRace(1, 6),
      );

      // + 2 h 17 min and + 3 h 17 min read the incomplete page: neither is
      // accepted, and nothing is published from it. + 4 h 17 min sights the
      // complete one and + 5 h 17 min publishes it.
      for (const tick of ticks.filter((entry) => entry.at < afterRace(1, 4))) {
        expect(tick.releasesAfter).toBe(tick.releasesBefore);
      }
      expect(askedFor(ticks, 1).slice(0, 4)).toEqual(ticksAfterRace(2, 5));
      expect(firstRelease(ticks)?.at).toBe(tickAfterRace(1, 5));
      expect(before).not.toBe(stage.activeVersion());
      expect(await winnerPoints(stage, 1)).toBe(25);
    });

    it('never publishes a self-consistent but short classification that changes within the hour (AU-D5)', async () => {
      // Variant D is A without its last classified driver, on a page whose
      // `total` agrees: nothing structural tells it from a complete result.
      const stage = await started();
      stage.source
        .available(1, afterRace(1, 2), 'D')
        .available(1, afterRace(1, 3), 'A');
      const before = stage.activeVersion();

      // + 2 h 17 min sights D; + 3 h 17 min sees A instead, which replaces
      // the pending sighting. Nothing is published from either.
      const sightings = await stage.hourly(
        tickAfterRace(1, -1),
        tickAfterRace(1, 3),
      );
      expect(firstRelease(sightings)).toBeUndefined();
      expect(stage.activeVersion()).toBe(before);
      expect(await entryCount(stage, 1)).toBeNull();

      // + 4 h 17 min sees A again and publishes it: the only release.
      const ticks = await stage.hourly(
        tickAfterRace(1, 4),
        tickAfterRace(1, 8),
      );
      const releases = ticks.filter(
        (tick) => tick.releasesAfter > tick.releasesBefore,
      );
      expect(releases.map((tick) => tick.at)).toEqual([tickAfterRace(1, 4)]);
      expect(askedFor([...sightings, ...ticks], 1)).toEqual([
        tickAfterRace(1, 2),
        tickAfterRace(1, 3),
        tickAfterRace(1, 4),
        tickAfterRace(1, 6),
      ]);
      expect(await entryCount(stage, 1)).toBeGreaterThan(1);
      const record = await stage.harness.record(1);
      // D was never accepted, so nothing was superseded.
      expect(record?.supersededRevisions).toEqual([]);
      expect(record?.contentRevision).toBe(record?.publishedRevision);
    });

    it('publishes a short classification served unchanged for an hour, then replaces it: two equal sightings do not prove it complete', async () => {
      const stage = await started();
      stage.source
        .available(1, afterRace(1, 2), 'D')
        .available(1, afterRace(1, 4), 'A');

      // D is sighted at + 2 h 17 min, seen again at + 3 h 17 min and
      // published as first seen: the residual AU-D5 accepts.
      const short = await stage.hourly(
        tickAfterRace(1, -1),
        tickAfterRace(1, 3),
      );
      expect(firstRelease(short)?.at).toBe(tickAfterRace(1, 3));
      const shortCount = await entryCount(stage, 1);
      expect(shortCount).not.toBeNull();

      // A is sighted at the + 5 h 30 min confirmation (+ 6 h 17 min),
      // pending, and published on the next hourly tick (ADR 0020 D2.1).
      const ticks = await stage.hourly(
        tickAfterRace(1, 4),
        tickAfterRace(1, 8),
      );
      expect(
        ticks
          .filter((tick) => tick.releasesAfter > tick.releasesBefore)
          .map((tick) => tick.at),
      ).toEqual([tickAfterRace(1, 7)]);
      expect(await entryCount(stage, 1)).toBe(shortCount! + 1);
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
      // Published at + 3 h 17 min; the + 9 h 30 min confirmation (the
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

      // + 6 h 17 min sights it once the outage ends; + 7 h 17 min publishes.
      const recovered = await stage.hourly(
        tickAfterRace(1, 6),
        tickAfterRace(1, 8),
      );
      expect(firstRelease(recovered)?.at).toBe(tickAfterRace(1, 7));
      expect(await winnerPoints(stage, 1)).toBe(25);
    });

    it('recovers a lost commit answer without publishing twice', async () => {
      const stage = await started();
      stage.source.available(1, afterRace(1, 4.5));
      // + 5 h 17 min sights it; + 6 h 17 min publishes it.
      await stage.hourly(tickAfterRace(1, -1), tickAfterRace(1, 5));
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
      await stage.tick(tickAfterRace(1, 6));
      transport.intercept = null;
      // The first answer and its one re-drive (ADR 0025 D4) were both lost.
      expect(lost).toBeGreaterThanOrEqual(1);
      const committed = stage.activeVersion();
      expect(await winnerPoints(stage, 1)).toBe(25);

      await stage.hourly(tickAfterRace(1, 7), tickAfterRace(1, 30));
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
      expect(firstRelease(ticks)?.at).toBe(tickAfterRace(1, 3));
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
