/**
 * The reconciliation ledger resolved from the Worker's own environment,
 * through the real entry points: `worker.scheduled` and
 * `POST /internal/admin/sync/full`.
 *
 * Unlike the other entry-point files, nothing here replaces
 * `resolveReconciliationLedger`: the Worker reads `RECONCILIATION_LEDGER`
 * exactly as a deployment would. The namespace is a local double that
 * dispatches to a real `ReconciliationLedger` object over the orchestration
 * harness's in-memory host - a fresh object for every stub, as an eviction
 * would build - so every ledger command crosses the real Durable Object
 * client and its serialized protocol.
 *
 * - Without the binding - every committed environment - both entry points
 *   stop at `ledger-unbound` before any lease, limiter reservation, provider
 *   request or publication write.
 * - With a usable binding, the gate passes and runs reach the orchestration.
 * - A binding that is not a namespace is never used; a namespace that cannot
 *   answer leaves the run at its lease, before any reservation, request or
 *   publication write.
 * - `mock` and `none` never look the binding up, and keep the baseline trace.
 *
 * Nothing here can reach a provider or Cloudflare.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import worker from '../../../../src/index';
import {
  ReconciliationLedger,
  type LedgerNamespace,
} from '../../../../src/sync/coordinated/ledger';
import { SynchronizationService } from '../../../../src/sync/sync-service';
import {
  wholeSeasonTrace,
  withoutInspectionReasons,
  type StepTrace,
} from '../../baseline/whole-season-trace';
import { durableStateOver, paths, seasonPaths } from '../observation/support';
import {
  ADMIN_TOKEN,
  EntryPointHarness,
  FIRST_PUBLICATION,
  PUBLIC_BASE_URL,
  PRE_SEASON,
  SEASON,
  linesOf,
  type CallRecord,
} from './support';

const globalFetch = vi.fn(async () => {
  throw new Error('the global fetch must not be reached');
});
let wholeSeason: ReturnType<typeof vi.spyOn>;
/** Only the `mock` and `none` trace may take the whole-season path. */
let wholeSeasonExpected = false;

beforeEach(() => {
  wholeSeasonExpected = false;
  globalFetch.mockClear();
  vi.stubGlobal('fetch', globalFetch);
  wholeSeason = vi.spyOn(SynchronizationService.prototype, 'run');
});

afterEach(() => {
  if (!wholeSeasonExpected) expect(wholeSeason).not.toHaveBeenCalled();
  expect(globalFetch).not.toHaveBeenCalled();
  wholeSeason.mockRestore();
  vi.unstubAllGlobals();
});

/** The other entry-point files' resolver holder; unused here. */
const noHolder = () => {};

/** A namespace double, recording every lookup and every command it carried. */
interface RecordingNamespace extends LedgerNamespace {
  readonly lookups: string[];
  readonly commands: string[];
}

/** A usable namespace over the harness's ledger host. */
function namespaceOver(harness: EntryPointHarness): RecordingNamespace {
  const lookups: string[] = [];
  const commands: string[] = [];
  return {
    lookups,
    commands,
    idFromName: (name) => {
      lookups.push(`idFromName:${name}`);
      return name;
    },
    get: () => {
      lookups.push('get');
      const object = new ReconciliationLedger(
        durableStateOver(harness.harness.host),
        { clock: harness.clock },
      );
      return {
        fetch: async (url: string, init: RequestInit) => {
          const body = JSON.parse(String(init.body)) as { command: string };
          commands.push(body.command);
          return object.fetch(new Request(url, init));
        },
      };
    },
  };
}

/** A harness whose Worker environment carries `binding` as its ledger. */
async function harnessWith(
  binding: (harness: EntryPointHarness) => unknown,
): Promise<EntryPointHarness> {
  const harness = await EntryPointHarness.create('durable-object', noHolder);
  const value = binding(harness);
  if (value === undefined) {
    delete (harness.env as { RECONCILIATION_LEDGER?: unknown })
      .RECONCILIATION_LEDGER;
  } else {
    (harness.env as { RECONCILIATION_LEDGER?: unknown }).RECONCILIATION_LEDGER =
      value;
  }
  return harness;
}

/** Nothing that could reach a provider or publish happened in `record`. */
function expectNoTraffic(record: CallRecord): void {
  expect(record).toMatchObject({
    requests: [],
    reservations: 0,
    prepares: 0,
    finalizes: 0,
    storageWrites: 0,
    mockProviderCalls: 0,
  });
}

const unbound = {
  status: 'coordinated-runtime-unavailable',
  season: SEASON,
  run: { trigger: 'manual', forcedPublication: true, advancesSchedule: false },
  reasons: ['ledger-unbound'],
  providerRequests: 0,
};

const withheldLine = (syncTrigger: 'manual' | 'scheduled') => ({
  level: 'warn',
  operation: 'sync.coordinated.withheld',
  season: SEASON,
  syncTrigger,
  coordinationStatus: 'coordinated-runtime-unavailable',
  failureCategory: 'coordinated-runtime-unavailable',
  coordinationMissingDependencies: ['ledger-unbound'],
  providerOperationCallCount: 0,
});

describe('without a RECONCILIATION_LEDGER binding, as in every committed environment', () => {
  it('stops both entry points at ledger-unbound before any lease, reservation, request or publication write', async () => {
    const harness = await harnessWith(() => undefined);
    expect('RECONCILIATION_LEDGER' in harness.env).toBe(false);
    const before = harness.activeVersion();

    const scheduled = await harness.scheduled(PRE_SEASON);
    const manual = await harness.manual(PRE_SEASON);

    expect(manual.status).toBe(503);
    expect(manual.body.data).toEqual(unbound);
    for (const record of [scheduled, manual]) expectNoTraffic(record);
    expect(linesOf(scheduled, 'sync.coordinated.withheld')).toEqual([
      withheldLine('scheduled'),
    ]);
    expect(linesOf(manual, 'sync.coordinated.withheld')).toEqual([
      withheldLine('manual'),
    ]);
    // No lease was taken: the ledger host holds nothing at all.
    expect(harness.harness.host.committedKeys()).toEqual([]);
    expect(harness.activeVersion()).toBe(before);
  });
});

describe('with a usable RECONCILIATION_LEDGER binding', () => {
  it('passes the gate: the bootstrap observation and the first publication run through the bound ledger', async () => {
    let namespace: RecordingNamespace | null = null;
    const harness = await harnessWith((h) => (namespace = namespaceOver(h)));
    const bound = namespace!;
    const baseline = harness.activeVersion();

    const bootstrap = await harness.scheduled(PRE_SEASON);

    expect(bootstrap).toMatchObject({
      requests: [paths.calendar],
      reservations: 1,
      prepares: 0,
      storageWrites: 0,
    });
    expect(linesOf(bootstrap, 'sync.coordinated.withheld')).toEqual([]);
    expect(bound.lookups).toContain('idFromName:reconciliation');
    expect(bound.commands.slice(0, 1)).toEqual(['acquire-lease']);
    expect(bound.commands).toContain('commit');
    expect(bound.commands).toContain('release-lease');
    expect((await harness.season()).calendarAnchors).not.toBeNull();

    const publication = await harness.scheduled(FIRST_PUBLICATION);

    expect(publication.requests.slice(0, seasonPaths.length)).toEqual(
      seasonPaths,
    );
    expect(publication).toMatchObject({ prepares: 1, finalizes: 1 });
    expect(harness.activeVersion()).not.toBe(baseline);
    expect(harness.activeVersion()).not.toBeNull();
  });

  it('answers a manual run with its orchestrated outcome, not ledger-unbound', async () => {
    let namespace: RecordingNamespace | null = null;
    const harness = await harnessWith((h) => (namespace = namespaceOver(h)));
    await harness.published();
    namespace!.commands.length = 0;

    const manual = await harness.manual(FIRST_PUBLICATION);

    expect(manual.status).toBe(200);
    expect(manual.body.data).toMatchObject({
      season: SEASON,
      run: { trigger: 'manual' },
      leaseRelease: 'released',
    });
    expect(manual.body.data?.status).not.toBe(
      'coordinated-runtime-unavailable',
    );
    expect(namespace!.commands[0]).toBe('acquire-lease');
    expect(linesOf(manual, 'sync.coordinated.withheld')).toEqual([]);
  });

  it('serves the operator inspection route from the bound ledger', async () => {
    let namespace: RecordingNamespace | null = null;
    const harness = await harnessWith((h) => (namespace = namespaceOver(h)));
    await harness.scheduled(PRE_SEASON);
    namespace!.commands.length = 0;

    const response = await worker.fetch(
      new Request(
        `${PUBLIC_BASE_URL}/internal/admin/reconciliation?season=2026`,
        {
          headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        },
      ),
      harness.env,
    );

    expect(response.status).toBe(200);
    expect(namespace!.commands).toEqual(['read-season']);
  });
});

describe('a RECONCILIATION_LEDGER binding that cannot give a usable ledger client', () => {
  /** Values that are not a Durable Object namespace, each counting its use. */
  const unusable: readonly [string, () => unknown][] = [
    ['a string variable', () => 'reconciliation'],
    ['a number', () => 1],
    ['null', () => null],
    ['an empty object', () => ({})],
    [
      'a KV namespace',
      () => ({ get: vi.fn(), put: vi.fn(), list: vi.fn(), delete: vi.fn() }),
    ],
    ['a namespace without get', () => ({ idFromName: vi.fn() })],
    [
      'a namespace whose get is not a function',
      () => ({ idFromName: vi.fn(), get: 'stub' }),
    ],
  ];

  it.each(unusable)(
    'treats %s as unbound: ledger-unbound, never touched, nothing sent or written',
    async (_label, value) => {
      const binding = value();
      const harness = await harnessWith(() => binding);

      const scheduled = await harness.scheduled(PRE_SEASON);
      const manual = await harness.manual(PRE_SEASON);

      expect(manual.status).toBe(503);
      expect(manual.body.data).toEqual(unbound);
      for (const record of [scheduled, manual]) expectNoTraffic(record);
      expect(linesOf(scheduled, 'sync.coordinated.withheld')).toEqual([
        withheldLine('scheduled'),
      ]);
      if (typeof binding === 'object' && binding !== null) {
        for (const member of Object.values(binding)) {
          if (vi.isMockFunction(member)) expect(member).not.toHaveBeenCalled();
        }
      }
      expect(harness.harness.host.committedKeys()).toEqual([]);
    },
  );

  /** Namespaces with the right surface whose lookup or answer fails. */
  const failing: readonly [string, LedgerNamespace][] = [
    [
      'idFromName throws',
      {
        idFromName: () => {
          throw new Error('lookup failed');
        },
        get: () => {
          throw new Error('not reached');
        },
      },
    ],
    [
      'get throws',
      {
        idFromName: (name) => name,
        get: () => {
          throw new Error('stub unavailable');
        },
      },
    ],
    [
      'the stub rejects',
      {
        idFromName: (name) => name,
        get: () => ({
          fetch: async () => {
            throw new Error('transport failed');
          },
        }),
      },
    ],
    [
      'the stub answers 500',
      {
        idFromName: (name) => name,
        get: () => ({
          fetch: async () =>
            new Response('{"error":"ledger-unavailable"}', { status: 500 }),
        }),
      },
    ],
    [
      'the stub answers something that is not a ledger outcome',
      {
        idFromName: (name) => name,
        get: () => ({
          fetch: async () => new Response('{"outcome":"acquired"}'),
        }),
      },
    ],
  ];

  it.each(failing)(
    'stops at the lease when %s: no reservation, request or publication write',
    async (_label, namespace) => {
      const harness = await harnessWith(() => namespace);
      const before = harness.activeVersion();

      const scheduled = await harness.scheduled(PRE_SEASON);
      const manual = await harness.manual(PRE_SEASON);

      // Past the gate, the lease is the first ledger operation, and its
      // failure is the run's bounded failure - not a decision.
      expect(manual.status).toBe(200);
      expect(manual.body.data).toEqual({
        status: 'failed',
        season: SEASON,
        run: {
          trigger: 'manual',
          forcedPublication: true,
          advancesSchedule: false,
        },
        stage: 'lease',
        failure: 'ledger-unavailable',
        ledgerRejection: null,
        providerRequests: 0,
        leaseRelease: null,
      });
      for (const record of [scheduled, manual]) {
        expectNoTraffic(record);
        expect(linesOf(record, 'sync.coordinated.withheld')).toEqual([]);
      }
      expect(harness.activeVersion()).toBe(before);
    },
  );
});

describe('mock and none with a RECONCILIATION_LEDGER binding', () => {
  const recorded = JSON.parse(
    readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        '..',
        '..',
        'baseline',
        'whole-season-trace.json',
      ),
      'utf8',
    ),
  ) as Record<string, StepTrace[]>;

  it('never look it up and produce the baseline trace', async () => {
    wholeSeasonExpected = true;
    let touched = 0;
    const namespace: LedgerNamespace = {
      idFromName: (name) => {
        touched += 1;
        return name;
      },
      get: () => {
        touched += 1;
        throw new Error('a whole-season mode must not reach the ledger');
      },
    };

    const trace = await wholeSeasonTrace({
      RECONCILIATION_LEDGER: namespace as unknown as DurableObjectNamespace,
    });

    // With a ledger resolved, the read-only inspection route no longer lists
    // `ledger-unbound`; that reason is the one expected difference. Every
    // sync, admin and public step is the baseline, byte for byte.
    expect(withoutInspectionReasons(trace)).toEqual(
      withoutInspectionReasons(recorded),
    );
    expect(touched).toBe(0);
  });
});
