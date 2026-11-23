/**
 * Rehearses gate AU-7 (`docs/release/automatic-updates.md` §8.4) in process:
 * the first scheduled runs of the committed `[env.production]` automatic
 * configuration against the release production serves since 2026-11-23
 * (`pm1-0000000000001-15abf90e`, born by genesis and published through the
 * guarded ingest from the 2026-11-23 capture).
 *
 * Skipped unless asked for. From `services/edge-api`:
 *
 *   GRIDVIEW_AU7_CAPTURE_DIR=<the 2026-11-23 capture directory: capture.json
 *     and its bodies, kept outside the repository>
 *   GRIDVIEW_AU7_ARTIFACT=<the batch artifact.json production was published
 *     from; its normalized source seeds the release, and its 122 documents
 *     prove the seeded release equals it>
 *   GRIDVIEW_AU7_REPORT_OUT=<optional JSON report file outside the repository>
 *   npx vitest run test/e2e/automatic-updates/production-first-run-rehearsal.test.mjs
 *
 * What is real: the Worker module and its scheduled handler, the committed
 * production variables as Wrangler resolves them (coordinated, the proxy
 * transport's variables, runtime catalog authority with the optional-driver
 * inventory, the genesis control, the sequencer), the `ReconciliationLedger`
 * class, the guarded sequenced publication and its D14-D16 guard, the real
 * provider limiter and hardened client, and a workerd SQLite
 * `IdentityCatalog` under production's installation ID, seeded with the
 * reviewed P0 package and activated (its catalog hash is checked against the
 * one production's batch names).
 *
 * What is substituted: the transport answers every Jolpica path from the
 * capture (the proxy hop itself is covered by its own tests); the sequencer
 * is seeded in process with the release generated from the batch's
 * normalized source (proved equal to the batch's 122 documents, instants
 * masked), under the harness's seed version label rather than
 * `pm1-0000000000001-15abf90e`; the ledger holds only the released season
 * lease the ingest leaves (the ingest records no classification and no
 * publication). Results the capture lacks (round 22) are synthesized from
 * round 21's classification under round 22's calendar entry, with both
 * standings restated at round 22 and their totals unchanged: they show what
 * the runtime does with a result, not what Qatar's will say.
 *
 * Findings it pins: the first full run publishes once, a release equal in
 * every visible field but instants (the empty ledger has no last publication
 * for the no-change gate); the race start mints the Home release; a first
 * result is held, then published at the next tick; a 429 withholds and the
 * next tick recovers; an unmapped race driver withholds every run.
 *
 * Nothing here reaches Jolpica, Cloudflare or production: every non-loopback
 * `fetch` throws and the workerd catalog forbids all outbound requests.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import worker from '../../../src/index';
import { MemoryCachePurgeAdapter } from '../../../src/cache/purge';
import { generateSnapshotSet } from '../../../src/snapshots/generator';
import { ReconciliationLedger } from '../../../src/sync/coordinated/ledger';
import { resolveReconciliationLedger } from '../../../src/sync/coordinated/ledger-port';
import { releaseSeasonLease } from '../../../src/sync/coordinated/operator/lease';
import { runtimeSnapshotValidator } from '../../../src/validation/snapshot-validator';
import { emptyResultsEnvelope } from '../../providers/jolpica/results-support';
import { SEED_VERSION } from '../../publication/sequenced/support';
import {
  ObservationHarness,
  durableStateOver,
} from '../../sync/coordinated/observation/support';
import {
  assertNoExternalNetwork,
  guardNetwork,
  localInstallation,
  namespaceBridge,
} from '../../identity/integration/support.mjs';
import { committedVars, realLimiter } from './stage';

const captureDir = process.env.GRIDVIEW_AU7_CAPTURE_DIR;
const artifactFile = process.env.GRIDVIEW_AU7_ARTIFACT;
const reportOut = process.env.GRIDVIEW_AU7_REPORT_OUT;

const SEASON = 2026;
const ADMIN_TOKEN = 'rehearsal-only-token';
const PROXY_TOKEN = 'rehearsal-only-proxy-token';
const PRODUCTION_INSTALLATION = '98f14de8-d974-423a-bb78-dafe6251164a';
/** The P0 catalog hash production's first batch names. */
const P0_CATALOG_HASH =
  'sha256:0a1b093a150605221606bb7dd65d7204d074ec4fef031537af100f5c0ab7de91';
/** When production committed `pm1-0000000000001-15abf90e`. */
const PRODUCTION_PUBLISHED_AT = '2026-11-23T14:33:49.815Z';
const QATAR_ROUND = 22;
const UNKNOWN_DRIVER = 'synthetic_au7_unmapped_driver';
const OBSERVATION = 'sync.coordinated.observation';

const instantKeys = new Set([
  'generatedAt',
  'staleAfter',
  'sourceUpdatedAt',
  'lastPublishedAt',
  'snapshotObservedAt',
  'observedAt',
]);

/** The batch artifact production's release was published from. */
function readArtifact() {
  return JSON.parse(readFileSync(artifactFile, 'utf8'));
}

function readCapture(dir) {
  const manifest = JSON.parse(readFileSync(join(dir, 'capture.json'), 'utf8'));
  const bodies = new Map();
  const byPath = new Map();
  for (const { url, file } of manifest.responses) {
    const bytes = new Uint8Array(readFileSync(join(dir, file)));
    bodies.set(file, bytes);
    const path = new URL(url).pathname.slice('/ergast/f1/2026'.length);
    byPath.set(path, JSON.parse(new TextDecoder().decode(bytes)));
  }
  return { manifest, bodies, byPath };
}

/**
 * What Jolpica serves once `round` is classified, synthesized from the
 * capture (nothing may ask Jolpica for it): the last captured classification
 * under the round's own calendar entry, both standings restated at it.
 * `replace` swaps one provider driver for an unmapped one.
 */
function withRoundClassified(capture, round, replace = false) {
  const answers = new Map(capture.byPath);
  const calendar = capture.byPath.get('/races/');
  const lastCaptured = Math.max(...capture.manifest.classificationRounds);
  const body = structuredClone(capture.byPath.get(`/${lastCaptured}/results/`));
  const entry = calendar.MRData.RaceTable.Races.find(
    (race) => race.round === String(round),
  );
  body.MRData.RaceTable.round = String(round);
  const [race] = body.MRData.RaceTable.Races;
  for (const key of ['round', 'url', 'raceName', 'Circuit', 'date', 'time']) {
    race[key] = structuredClone(entry[key]);
  }
  if (replace) {
    const victim = race.Results.at(-1).Driver;
    victim.driverId = UNKNOWN_DRIVER;
    victim.code = 'XXX';
    victim.permanentNumber = '99';
    victim.givenName = 'Synthetic';
    victim.familyName = 'Unmapped';
  }
  answers.set(`/${round}/results/`, body);
  for (const path of ['/driverstandings/', '/constructorstandings/']) {
    const standings = structuredClone(capture.byPath.get(path));
    standings.MRData.StandingsTable.round = String(round);
    for (const list of standings.MRData.StandingsTable.StandingsLists) {
      list.round = String(round);
    }
    answers.set(path, standings);
  }
  return answers;
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `"${key}":${canonical(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Up to `limit` JSON paths at which `left` and `right` differ. */
function differingPaths(left, right, limit = 8, at = '$', found = []) {
  if (found.length >= limit) return found;
  if (canonical(left) === canonical(right)) return found;
  const isObject = (value) => value !== null && typeof value === 'object';
  if (isObject(left) && isObject(right)) {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of [...keys].sort()) {
      differingPaths(left[key], right[key], limit, `${at}.${key}`, found);
    }
    return found;
  }
  found.push(
    `${at}: ${JSON.stringify(left)?.slice(0, 80)} -> ${JSON.stringify(right)?.slice(0, 80)}`,
  );
  return found;
}

function masked(value) {
  if (Array.isArray(value)) return value.map(masked);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !instantKeys.has(key))
        .map(([key, inner]) => [key, masked(inner)]),
    );
  }
  return value;
}

let catalog;
let catalogActivation;

class Rehearsal {
  constructor(harness, env, capture) {
    this.harness = harness;
    this.env = env;
    this.capture = capture;
    this.ticks = [];
  }

  static async create(capture) {
    const source = readArtifact().source;
    const harness = await ObservationHarness.create({
      transport: 'durable-object',
      seedAt: PRODUCTION_PUBLISHED_AT,
      seedOrderingInput: capture.manifest.observedAt,
      seedTransform: () =>
        generateSnapshotSet(source, PRODUCTION_PUBLISHED_AT, SEED_VERSION),
    });
    const clock = harness.clock;
    const namespace = {
      idFromName: (name) => name,
      get: () => {
        const object = new ReconciliationLedger(
          durableStateOver(harness.host),
          { clock },
        );
        return {
          fetch: (url, init) => object.fetch(new Request(url, init)),
        };
      },
    };
    const env = {
      ...committedVars('production'),
      ADMIN_TOKEN,
      JOLPICA_PROXY_TOKEN: PROXY_TOKEN,
      RECONCILIATION_LEDGER: namespace,
      IDENTITY_CATALOG: namespaceBridge(catalog),
      __SEASON_PUBLICATION_SEQUENCER: harness.sequencer,
      __LOCAL_STORAGE: harness.storage,
      __CACHE_PURGER: new MemoryCachePurgeAdapter(),
      __SNAPSHOT_VALIDATOR: runtimeSnapshotValidator,
      __CLOCK: clock,
      __LOGGER: harness.logger,
      __PROVIDER_RATE_LIMITER: realLimiter(() => clock.now()),
      __PROVIDER_TRANSPORT: harness.server.transport,
      __PACER_SLEEP: async (millis) => clock.advance(millis),
    };
    const rehearsal = new Rehearsal(harness, env, capture);
    rehearsal.answer(capture.byPath);
    // What the ingest left in the ledger: one acquired and released lease.
    clock.set(PRODUCTION_PUBLISHED_AT);
    const ledger = resolveReconciliationLedger(env);
    const acquired = await ledger.acquireLease(SEASON);
    expect(acquired.outcome).toBe('acquired');
    await releaseSeasonLease(ledger, {
      season: acquired.lease.season,
      fence: acquired.lease.fence,
    });
    return rehearsal;
  }

  /** Jolpica answers `byPath`; a round it does not answer is unpublished. */
  answer(byPath) {
    const answers = this.harness.server.answers;
    answers.clear();
    for (const [path, body] of byPath) {
      answers.set(path, () => ({ kind: 'json', body }));
    }
    for (let round = 1; round <= 24; round += 1) {
      const path = `/${round}/results/`;
      if (!byPath.has(path)) {
        answers.set(path, () => ({
          kind: 'json',
          body: emptyResultsEnvelope(),
        }));
      }
    }
  }

  /** One scheduled invocation at `at`, exactly as the Cron Trigger makes it. */
  async tick(at, label = at) {
    this.harness.clock.set(at);
    const requests = this.harness.server.requests.length;
    const logs = this.harness.logger.events.length;
    const activeBefore = this.harness.activeVersion();
    await worker.scheduled({ cron: '17 * * * *' }, this.env);
    const events = this.harness.logger.events.slice(logs);
    const observation = events.find((event) => event.operation === OBSERVATION);
    const record = {
      label,
      at,
      requests: this.harness.server.requests.slice(requests),
      activeBefore,
      activeAfter: this.harness.activeVersion(),
      minted: this.harness.activeVersion() !== activeBefore,
      observation: observation ?? null,
      otherOperations: events
        .filter((event) => event.operation !== OBSERVATION)
        .map((event) => event.operation),
    };
    this.ticks.push(record);
    return record;
  }

  async status() {
    const response = await worker.fetch(
      new Request(`${this.env.PUBLIC_BASE_URL}/v1/status`),
      this.env,
    );
    return (await response.json()).data;
  }

  async documents(version) {
    const storage = this.harness.storage;
    const names = (await storage.readVersionInventory(SEASON, version)) ?? [];
    const documents = new Map();
    for (const name of names) {
      const document = await storage.readVersionedDocument(
        SEASON,
        version,
        name,
      );
      if (document !== null) documents.set(name, document);
    }
    return documents;
  }

  async diff(before, after) {
    const left = await this.documents(before);
    const right = await this.documents(after);
    // Data and envelope, instants masked: what a reader of the API sees.
    const visible = (document) =>
      masked({ data: document.data, meta: document.meta });
    const contentChanged = [];
    for (const [name, document] of right) {
      const previous = left.get(name);
      if (previous === undefined) continue;
      if (canonical(visible(previous)) !== canonical(visible(document)))
        contentChanged.push(name);
    }
    const samplePaths = {};
    for (const name of contentChanged.slice(0, 8)) {
      samplePaths[name] = differingPaths(
        visible(left.get(name)),
        visible(right.get(name)),
      );
    }
    return {
      samplePaths,
      documentsBefore: left.size,
      documentsAfter: right.size,
      added: [...right.keys()].filter((name) => !left.has(name)).sort(),
      removed: [...left.keys()].filter((name) => !right.has(name)).sort(),
      contentChanged: contentChanged.sort(),
    };
  }
}

const hours = (at, count) =>
  new Date(Date.parse(at) + count * 3_600_000).toISOString();

const report = {};

describe.skipIf(captureDir === undefined || artifactFile === undefined)(
  'AU-7, rehearsed in process against production’s live release',
  () => {
    let capture;

    beforeAll(async () => {
      guardNetwork();
      capture = readCapture(captureDir);
      catalog = await localInstallation(0, {
        installation: PRODUCTION_INSTALLATION,
      });
      catalogActivation = await catalog.initialize();
    }, 180_000);
    afterAll(async () => {
      await catalog?.stop();
      if (reportOut !== undefined) {
        writeFileSync(reportOut, `${JSON.stringify(report, null, 2)}\n`);
      }
    });
    afterEach(() => assertNoExternalNetwork());

    it('seeds the P0 catalog production pins, and the release production serves', async () => {
      expect(catalogActivation.proposal.catalogHash).toBe(P0_CATALOG_HASH);
      const rehearsal = await Rehearsal.create(capture);
      const seeded = await rehearsal.documents(
        rehearsal.harness.activeVersion(),
      );
      expect(seeded.size).toBe(122);
      const proof = { documents: seeded.size, artifactCompared: false };
      {
        const artifact = readArtifact();
        const expected = new Map(
          artifact.documents.map((document) => [
            document.documentName,
            document,
          ]),
        );
        const differing = [];
        for (const [name, document] of expected) {
          const actual = seeded.get(name);
          if (
            actual === undefined ||
            canonical(masked(actual.data ?? actual)) !==
              canonical(masked(document.data ?? document))
          )
            differing.push(name);
        }
        proof.artifactCompared = true;
        proof.artifactDocuments = expected.size;
        proof.differingFromArtifact = differing;
        expect(differing).toEqual([]);
        expect(expected.size).toBe(seeded.size);
      }
      report.seed = {
        catalogHash: catalogActivation.proposal.catalogHash,
        ...proof,
      };
    }, 180_000);

    /**
     * The ledger holds no `lastPublication` (the ingest records none), so the
     * no-change gate has nothing to compare the first full run's candidate
     * with: that run publishes once. Its release must equal the serving one
     * in everything a reader sees but instants; from then on the gate holds.
     */
    async function expectFirstCoordinatedRelease(rehearsal, starting) {
      const minted = rehearsal.ticks.filter((tick) => tick.minted);
      expect(minted).toHaveLength(1);
      const first = minted[0];
      expect(first.observation).toMatchObject({
        observationPlan: 'publication',
        publicationOutcome: 'published',
      });
      const diff = await rehearsal.diff(starting, first.activeAfter);
      expect(diff).toMatchObject({
        documentsBefore: 122,
        documentsAfter: 122,
        added: [],
        removed: [],
        contentChanged: [],
      });
      return { version: first.activeAfter, tick: first.label, diff };
    }

    it('a: the first ticks on 2026-11-24 bootstrap, observe every resource, re-mint once without a content change, then hold', async () => {
      const rehearsal = await Rehearsal.create(capture);
      const starting = rehearsal.harness.activeVersion();
      const at = '2026-11-24T10:17:00.000Z';
      const first = await rehearsal.tick(at, 'tick 1');
      const second = await rehearsal.tick(hours(at, 1), 'tick 2');
      const third = await rehearsal.tick(hours(at, 2), 'tick 3');
      const fourth = await rehearsal.tick(hours(at, 6), 'tick +6h');
      const status = await rehearsal.status();
      const firstRelease = await expectFirstCoordinatedRelease(
        rehearsal,
        starting,
      );
      report.a = { starting, firstRelease, ticks: rehearsal.ticks, status };

      for (const tick of rehearsal.ticks) {
        for (const path of tick.requests) {
          expect(
            capture.byPath.has(path) || /^\/\d+\/results\/$/.test(path),
            path,
          ).toBe(true);
        }
      }
      expect(first.requests).toEqual(['/races/']);
      expect(first.minted).toBe(false);
      // The six season resources and the 21 classified rounds.
      expect(second.requests).toHaveLength(27);
      expect(second.minted).toBe(true);
      expect(third.observation).toMatchObject({
        coordinationStatus: 'nothing-due',
      });
      expect(third.requests).toEqual([]);
      expect(fourth.minted).toBe(false);
      expect(status.lastSuccessfulSyncAt).not.toBeNull();
    }, 300_000);

    it('b: Qatar (R22) is held at its first sighting, published at the next tick, then confirmed without a new release', async () => {
      const rehearsal = await Rehearsal.create(capture);
      const starting = rehearsal.harness.activeVersion();
      await rehearsal.tick('2026-11-28T10:17:00.000Z', 'pre-race 1');
      await rehearsal.tick('2026-11-28T11:17:00.000Z', 'pre-race 2');
      const firstRelease = await expectFirstCoordinatedRelease(
        rehearsal,
        starting,
      );
      const preRace = rehearsal.harness.activeVersion();
      // Race at 16:00Z: polling starts at the first tick at or after 17:30Z.
      const quiet = [
        await rehearsal.tick('2026-11-29T16:17:00.000Z', 'race 16:17'),
        await rehearsal.tick('2026-11-29T17:17:00.000Z', 'race 17:17'),
      ];
      // Jolpica keeps R22 unpublished at 18:17Z, then serves it.
      const empty = await rehearsal.tick(
        '2026-11-29T18:17:00.000Z',
        'race 18:17 (empty)',
      );
      rehearsal.answer(withRoundClassified(capture, QATAR_ROUND));
      const sighted = await rehearsal.tick(
        '2026-11-29T19:17:00.000Z',
        'first sighting',
      );
      const published = await rehearsal.tick(
        '2026-11-29T20:17:00.000Z',
        'second sighting',
      );
      const later = [];
      for (const at of [
        '2026-11-29T21:17:00.000Z',
        '2026-11-29T22:17:00.000Z',
        '2026-11-30T03:17:00.000Z',
        '2026-11-30T07:17:00.000Z',
        '2026-11-30T16:17:00.000Z',
        '2026-12-01T16:17:00.000Z',
      ])
        later.push(await rehearsal.tick(at, `after ${at.slice(5, 16)}`));
      const serving = rehearsal.harness.activeVersion();
      const diff = await rehearsal.diff(quiet[0].activeAfter, serving);
      const status = await rehearsal.status();
      report.b = {
        starting,
        firstRelease,
        preRace,
        ticks: rehearsal.ticks,
        serving,
        diff,
        status,
      };

      // At the race start Home's featured event moves on (the race is under
      // way), a legitimate content change: one release, no result in it.
      const raceStart = await rehearsal.diff(preRace, quiet[0].activeAfter);
      report.b.raceStart = raceStart;
      expect(quiet[0].minted).toBe(true);
      expect(raceStart.added).toEqual([]);
      expect(raceStart.removed).toEqual([]);
      expect(quiet[1].minted).toBe(false);
      expect(empty.requests).toContain(`/${QATAR_ROUND}/results/`);
      expect(empty.minted).toBe(false);
      expect(sighted.requests).toContain(`/${QATAR_ROUND}/results/`);
      expect(sighted.minted).toBe(false);
      expect(published.minted).toBe(true);
      expect(published.observation).toMatchObject({
        publicationOutcome: 'published',
      });
      expect(later.every((tick) => !tick.minted)).toBe(true);
      expect(diff.added).toEqual([`grand-prix:${QATAR_ROUND}:results`]);
      expect(diff.removed).toEqual([]);
    }, 600_000);

    it('c: a 429 holds, withholds and keeps the release; the next tick after the hold recovers', async () => {
      const rehearsal = await Rehearsal.create(capture);
      const starting = rehearsal.harness.activeVersion();
      const at = '2026-11-24T10:17:00.000Z';
      await rehearsal.tick(at, 'tick 1');
      const answers = rehearsal.harness.server.answers;
      const normal = answers.get('/circuits/');
      answers.set('/circuits/', () => ({ kind: 'status', status: 429 }));
      const refused = await rehearsal.tick(hours(at, 1), 'tick 2 (429)');
      const held = rehearsal.harness.activeVersion();
      answers.set('/circuits/', normal);
      const recovered = await rehearsal.tick(hours(at, 2), 'tick 3');
      const after = await rehearsal.tick(hours(at, 3), 'tick 4');
      const status = await rehearsal.status();
      const firstRelease = await expectFirstCoordinatedRelease(
        rehearsal,
        starting,
      );
      report.c = { starting, firstRelease, ticks: rehearsal.ticks, status };

      expect(refused.requests.at(-1)).toBe('/circuits/');
      expect(refused.minted).toBe(false);
      expect(held).toBe(starting);
      expect(recovered.minted || after.minted).toBe(true);
    }, 300_000);

    it('d: an unmapped driver in the R22 classification withholds every run and publishes nothing', async () => {
      const rehearsal = await Rehearsal.create(capture);
      const starting = rehearsal.harness.activeVersion();
      await rehearsal.tick('2026-11-28T10:17:00.000Z', 'pre-race 1');
      await rehearsal.tick('2026-11-28T11:17:00.000Z', 'pre-race 2');
      const firstRelease = await expectFirstCoordinatedRelease(
        rehearsal,
        starting,
      );
      const preRace = rehearsal.harness.activeVersion();
      rehearsal.answer(withRoundClassified(capture, QATAR_ROUND, true));
      const race = [];
      for (const at of [
        '2026-11-29T17:17:00.000Z',
        '2026-11-29T18:17:00.000Z',
        '2026-11-29T19:17:00.000Z',
        '2026-11-29T20:17:00.000Z',
        '2026-11-29T21:17:00.000Z',
      ])
        race.push(await rehearsal.tick(at, `race ${at.slice(11, 16)}`));
      report.d = { starting, firstRelease, ticks: rehearsal.ticks };

      expect(race.every((tick) => !tick.minted)).toBe(true);
      expect(rehearsal.harness.activeVersion()).toBe(preRace);
      expect(
        race.some((tick) => tick.requests.includes(`/${QATAR_ROUND}/results/`)),
      ).toBe(true);
    }, 600_000);
  },
);
