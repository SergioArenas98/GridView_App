/**
 * Rehearses release gate AU-4 step 2 (`docs/release/automatic-updates.md`
 * §8.3) in process: the first two authenticated `POST
 * /internal/admin/sync/full?season=2026` runs of the committed staging
 * configuration, against the release live staging serves.
 *
 * Skipped unless asked for. From `services/edge-api`:
 *
 *   GRIDVIEW_AU4_CAPTURE_DIR=<an operator capture directory: capture.json and
 *     the bodies it names, kept outside the repository>
 *   GRIDVIEW_AU4_REPORT_OUT=<optional JSON report file outside the repository>
 *   npx vitest run test/e2e/automatic-updates/staging-first-run-rehearsal.test.ts
 *
 * The capture is the one live staging's active release was published from
 * (2026-10-19, `pm1-000000000001d-aed72435`). The rehearsal:
 *
 * 1. regenerates that release with the real offline generator and seeds an
 *    in-process sequencer with it, credited `data-sources-v2` as the live
 *    release is;
 * 2. composes the Worker from the committed `[env.staging]` variables
 *    (`coordinated`, as Wrangler resolves them) with a bound ledger over the
 *    real `ReconciliationLedger` class, the real limiter and hardened client,
 *    and a transport that answers each captured URL with its captured body;
 * 3. sends the two manual runs and records what each requested, answered,
 *    logged and published, and how the release that serves afterwards
 *    differs from the starting one.
 *
 * Two instants are rehearsed: right after the capture, when Jolpica served
 * exactly the captured bodies, and today, when rounds 18 and 19 have raced.
 * Their results are not in the capture and nothing may ask Jolpica for them,
 * so today's run sees them as not yet published - an empty race list, as
 * Jolpica answers - which is the one difference from the real step 2, where
 * Jolpica will serve them.
 *
 * Nothing here reaches Jolpica, Cloudflare or staging: the global `fetch` is
 * stubbed to throw, and every answer comes from the local capture.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import worker, { type Env } from '../../../src/index';
import { MemoryCachePurgeAdapter } from '../../../src/cache/purge';
import type { ProviderSeasonSource } from '../../../src/providers/formula-one-provider';
import { generateSnapshotSet } from '../../../src/snapshots/generator';
import type { StoredSnapshot } from '../../../src/storage/types';
import { ReconciliationLedger } from '../../../src/sync/coordinated/ledger';
import { runtimeSnapshotValidator } from '../../../src/validation/snapshot-validator';
import { generateSeasonBatch } from '../../../scripts/season-batch/generate';
import { emptyResultsEnvelope } from '../../providers/jolpica/results-support';
import { SEED_VERSION } from '../../publication/sequenced/support';
import {
  ObservationHarness,
  durableStateOver,
} from '../../sync/coordinated/observation/support';
import { committedVars, realLimiter } from './stage';

const captureDir = process.env.GRIDVIEW_AU4_CAPTURE_DIR;
const reportOut = process.env.GRIDVIEW_AU4_REPORT_OUT;

const SEASON = 2026;
const ADMIN_TOKEN = 'rehearsal-only-token';
/** When live staging committed `pm1-000000000001d-aed72435`. */
const STAGING_PUBLISHED_AT = '2026-10-19T18:43:32.476Z';
/** The attribution version the live release carries. */
const LIVE_ATTRIBUTION_VERSION = 'data-sources-v2';

/** Fields that only date a document, masked when documents are compared. */
const instantKeys = new Set([
  'generatedAt',
  'staleAfter',
  'sourceUpdatedAt',
  'lastPublishedAt',
  'snapshotObservedAt',
  'observedAt',
]);

type Json = Record<string, unknown>;

interface Capture {
  readonly manifest: Json & {
    readonly observedAt: string;
    readonly responses: readonly { url: string; file: string }[];
  };
  readonly bodies: ReadonlyMap<string, Uint8Array>;
  /** Each captured body, by its path below the season. */
  readonly byPath: ReadonlyMap<string, unknown>;
}

function readCapture(dir: string): Capture {
  const manifest = JSON.parse(
    readFileSync(join(dir, 'capture.json'), 'utf8'),
  ) as Capture['manifest'];
  const bodies = new Map<string, Uint8Array>();
  const byPath = new Map<string, unknown>();
  for (const { url, file } of manifest.responses) {
    const bytes = new Uint8Array(readFileSync(join(dir, file)));
    bodies.set(file, bytes);
    const path = new URL(url).pathname.slice('/ergast/f1/2026'.length);
    byPath.set(path, JSON.parse(new TextDecoder().decode(bytes)) as unknown);
  }
  return { manifest, bodies, byPath };
}

/** JSON with object keys sorted, so key order never reads as a change. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value as Json)
      .sort()
      .map((key) => `"${key}":${canonical((value as Json)[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Up to `limit` JSON paths at which `left` and `right` differ. */
function differingPaths(
  left: unknown,
  right: unknown,
  limit = 12,
  at = '$',
  found: string[] = [],
): string[] {
  if (found.length >= limit) return found;
  if (canonical(left) === canonical(right)) return found;
  const isObject = (value: unknown): value is Json =>
    value !== null && typeof value === 'object';
  if (isObject(left) && isObject(right)) {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of [...keys].sort()) {
      differingPaths(left[key], right[key], limit, `${at}.${key}`, found);
    }
    return found;
  }
  found.push(at);
  return found;
}

/** Recursively drops the instant fields, so only content is compared. */
function masked(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(masked);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Json)
        .filter(([key]) => !instantKeys.has(key))
        .map(([key, inner]) => [key, masked(inner)]),
    );
  }
  return value;
}

interface RunRecord {
  readonly at: string;
  readonly status: number;
  readonly data: unknown;
  readonly requests: readonly string[];
  readonly operations: readonly string[];
  readonly activeBefore: string | null;
  readonly activeAfter: string | null;
  readonly elapsedMs: number;
}

interface ReleaseDiff {
  readonly documentsBefore: number;
  readonly documentsAfter: number;
  readonly added: readonly string[];
  readonly removed: readonly string[];
  /** Documents whose content differs once instants are masked. */
  readonly contentChanged: readonly string[];
  /** Documents that differ only in instants. */
  readonly instantsOnly: readonly string[];
  readonly attributionVersions: readonly [unknown, unknown];
  /** Where the first few content changes are, instants masked. */
  readonly samplePaths: Readonly<Record<string, readonly string[]>>;
}

class Rehearsal {
  readonly requests: string[] = [];

  private constructor(
    readonly harness: ObservationHarness,
    readonly env: Env,
  ) {}

  static async create(capture: Capture): Promise<Rehearsal> {
    const batch = await generateSeasonBatch({
      capture: capture.manifest,
      bodies: capture.bodies,
      provenance: { gitCommit: '0'.repeat(40), treeClean: false },
    });
    if (!batch.ok) throw new Error(`capture refused: ${batch.failure}`);
    const artifact = JSON.parse(batch.artifact.text) as Json;
    const source = {
      ...(artifact.source as ProviderSeasonSource),
      attributionVersion: LIVE_ATTRIBUTION_VERSION,
    } as ProviderSeasonSource;
    const harness = await ObservationHarness.create({
      transport: 'durable-object',
      seedAt: STAGING_PUBLISHED_AT,
      seedOrderingInput: capture.manifest.observedAt,
      seedTransform: () =>
        generateSnapshotSet(source, STAGING_PUBLISHED_AT, SEED_VERSION),
    });
    for (const [path, body] of capture.byPath) {
      harness.server.answers.set(path, () => ({ kind: 'json', body }));
    }
    // A round the capture does not hold has not been published by Jolpica.
    for (let round = 1; round <= 24; round += 1) {
      const path = `/${round}/results/`;
      if (!capture.byPath.has(path)) {
        harness.server.answers.set(path, () => ({
          kind: 'json',
          body: emptyResultsEnvelope(),
        }));
      }
    }
    const clock = harness.clock;
    const env: Env = {
      ...committedVars('staging'),
      ADMIN_TOKEN,
      RECONCILIATION_LEDGER: {
        idFromName: (name: string) => name,
        get: () => {
          const object = new ReconciliationLedger(
            durableStateOver(harness.host),
            { clock },
          );
          return {
            fetch: (url: string, init: RequestInit) =>
              object.fetch(new Request(url, init)),
          };
        },
      } as unknown as DurableObjectNamespace,
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
    return new Rehearsal(harness, env);
  }

  /** One authenticated manual run at `at`, as AU-4 step 2 sends it. */
  async manual(at: string): Promise<RunRecord> {
    this.harness.clock.set(at);
    const requests = this.harness.server.requests.length;
    const logs = this.harness.logger.events.length;
    const activeBefore = this.harness.activeVersion();
    const started = performance.now();
    const response = await worker.fetch(
      new Request(
        `https://gridview-api-staging.sejuma18.workers.dev/internal/admin/sync/full?season=${SEASON}`,
        { method: 'POST', headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } },
      ),
      this.env,
    );
    const elapsedMs = Math.round(performance.now() - started);
    const body = (await response.json()) as { data?: unknown };
    return {
      at,
      status: response.status,
      data: body.data ?? body,
      requests: this.harness.server.requests.slice(requests),
      operations: this.harness.logger.events
        .slice(logs)
        .map((event) => event.operation),
      activeBefore,
      activeAfter: this.harness.activeVersion(),
      elapsedMs,
    };
  }

  async documents(version: string): Promise<Map<string, StoredSnapshot>> {
    const storage = this.harness.storage;
    const names = (await storage.readVersionInventory(SEASON, version)) ?? [];
    const documents = new Map<string, StoredSnapshot>();
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

  async diff(before: string, after: string): Promise<ReleaseDiff> {
    const left = await this.documents(before);
    const right = await this.documents(after);
    const contentChanged: string[] = [];
    const instantsOnly: string[] = [];
    for (const [name, document] of right) {
      const previous = left.get(name);
      if (previous === undefined) continue;
      const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);
      if (same(previous, document)) continue;
      if (same(masked(previous.data), masked(document.data))) {
        instantsOnly.push(name);
      } else {
        contentChanged.push(name);
      }
    }
    const attribution = (documents: Map<string, StoredSnapshot>) =>
      (documents.get('content:manifest')?.data as Json | undefined)
        ?.attributionVersion;
    const samplePaths: Record<string, readonly string[]> = {};
    for (const name of contentChanged.slice(0, 6)) {
      samplePaths[name] = differingPaths(
        masked(left.get(name)!.data),
        masked(right.get(name)!.data),
      );
    }
    return {
      documentsBefore: left.size,
      documentsAfter: right.size,
      added: [...right.keys()].filter((name) => !left.has(name)),
      removed: [...left.keys()].filter((name) => !right.has(name)),
      contentChanged: contentChanged.sort(),
      instantsOnly: instantsOnly.sort(),
      attributionVersions: [attribution(left), attribution(right)],
      samplePaths,
    };
  }
}

const globalFetch = vi.fn(async () => {
  throw new Error('the rehearsal must not reach the network');
});

beforeEach(() => {
  globalFetch.mockClear();
  vi.stubGlobal('fetch', globalFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const report: Record<string, unknown> = {};

describe.skipIf(captureDir === undefined)(
  'AU-4 step 2, rehearsed in process against staging’s live release',
  () => {
    const scenarios = [
      // Right after the capture: Jolpica served exactly these bodies.
      ['after the capture', '2026-10-19T19:00:00.000Z'],
      // Today: rounds 18 and 19 have raced and are answered as unpublished.
      ['today', '2026-11-04T10:00:00.000Z'],
    ] as const;

    for (const [name, at] of scenarios) {
      it(`runs the bootstrap and the publication run ${name}`, async () => {
        const capture = readCapture(captureDir!);
        const rehearsal = await Rehearsal.create(capture);
        const starting = rehearsal.harness.activeVersion();
        expect(starting).not.toBeNull();

        const first = await rehearsal.manual(at);
        const second = await rehearsal.manual(
          new Date(Date.parse(at) + 5 * 60_000).toISOString(),
        );
        const serving = rehearsal.harness.activeVersion();
        const diff =
          serving !== null && serving !== starting
            ? await rehearsal.diff(starting!, serving)
            : null;

        report[name] = { at, starting, first, second, serving, diff };

        // Nothing left the process, and every request was a Jolpica path the
        // capture holds or a result it does not.
        expect(globalFetch).not.toHaveBeenCalled();
        for (const path of [...first.requests, ...second.requests]) {
          expect(
            capture.byPath.has(path) || /^\/\d+\/results\/$/.test(path),
            path,
          ).toBe(true);
        }
        expect(first.status).toBe(200);
        expect(second.status).toBe(200);

        // The first run only bootstraps the calendar; it publishes nothing.
        expect(first.requests).toEqual(['/races/']);
        expect(first.data).toMatchObject({
          plan: 'observation',
          publication: 'not-attempted',
        });
        expect(first.activeAfter).toBe(starting);
        // The second is the forced publication run: the six season-level
        // resources, then every round whose race has started.
        const raced = capture.manifest.responses.filter(({ url }) =>
          /\/\d+\/results\//.test(url),
        ).length;
        const missing = name === 'today' ? 2 : 0;
        expect(second.requests).toHaveLength(6 + raced + missing);
        expect(second.data).toMatchObject({ plan: 'publication' });

        if (name === 'after the capture') {
          // Jolpica unchanged: one new release whose only content change is
          // the attribution version this change issues.
          expect(second.data).toMatchObject({
            publication: { outcome: 'published' },
          });
          expect(diff).toMatchObject({
            added: [],
            removed: [],
            contentChanged: ['content:manifest'],
            attributionVersions: [LIVE_ATTRIBUTION_VERSION, 'data-sources-v3'],
            samplePaths: { 'content:manifest': ['$.attributionVersion'] },
          });
        } else {
          // A raced round without a result withholds the whole run; the
          // live release keeps serving and the next run asks again.
          expect(second.data).toMatchObject({
            publication: {
              outcome: 'withheld',
              cause: 'classification-unavailable',
            },
          });
          expect(serving).toBe(starting);
        }
      });
    }

    it('writes the report when asked', () => {
      if (reportOut !== undefined) {
        writeFileSync(reportOut, `${JSON.stringify(report, null, 2)}\n`);
      }
      expect(Object.keys(report)).toHaveLength(scenarios.length);
    });
  },
);
