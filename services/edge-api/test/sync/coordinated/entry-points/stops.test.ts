/**
 * Stopped seasons, the attention line and every environment and mode
 * combination, through the Worker's real entry points.
 *
 * - A held or durably blocked season is refused publication by a manual run
 *   before any request, and every scheduled tick writes the bounded attention
 *   line, as does a review backlog at 48 or 60 of its 60 slots.
 * - Production's legacy authority refuses the coordinated run at the gate,
 *   with a ledger bound or not, and a scheduled run still reads a bound
 *   ledger for the attention line.
 * - `mock` and `none` never reach the coordinated path even when the resolver
 *   answers a ledger: they read none of it and produce the baseline trace.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { composeCoordinatedRuntime } from '../../../../src/sync/coordinated/composition';
import type { ReconciliationLedgerPort } from '../../../../src/sync/coordinated/ledger-port';
import { observeCoordinatedSeason } from '../../../../src/sync/coordinated/observation';
import { runCoordinatedSync } from '../../../../src/sync/coordinated/run';
import { sequencerTransports } from '../../../publication/sequenced/support';
import {
  wholeSeasonTrace,
  type StepTrace,
} from '../../baseline/whole-season-trace';
import { OperatorLedger } from '../../../admin/reconciliation-support';
import {
  EntryPointHarness,
  FIRST_PUBLICATION,
  HOUR,
  MINUTE,
  PRE_SEASON,
  SEASON,
  later,
  linesOf,
  type LedgerBinding,
} from './support';

const injected = vi.hoisted(() => ({
  ledger: null as null | (() => unknown),
}));

vi.mock(
  '../../../../src/sync/coordinated/ledger-port',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('../../../../src/sync/coordinated/ledger-port')
      >();
    return {
      ...actual,
      resolveReconciliationLedger: () =>
        (injected.ledger?.() ?? null) as ReconciliationLedgerPort | null,
    };
  },
);
vi.mock(
  '../../../../src/sync/coordinated/composition',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('../../../../src/sync/coordinated/composition')
      >();
    return {
      ...actual,
      composeCoordinatedRuntime: vi.fn(actual.composeCoordinatedRuntime),
    };
  },
);
vi.mock(
  '../../../../src/sync/coordinated/observation',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('../../../../src/sync/coordinated/observation')
      >();
    return {
      ...actual,
      observeCoordinatedSeason: vi.fn(actual.observeCoordinatedSeason),
    };
  },
);
vi.mock('../../../../src/sync/coordinated/run', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../../../src/sync/coordinated/run')
    >();
  return { ...actual, runCoordinatedSync: vi.fn(actual.runCoordinatedSync) };
});

const compose = vi.mocked(composeCoordinatedRuntime);
const observe = vi.mocked(observeCoordinatedSeason);
const runSync = vi.mocked(runCoordinatedSync);

const globalFetch = vi.fn(async () => {
  throw new Error('the global fetch must not be reached');
});

beforeEach(() => {
  injected.ledger = null;
  compose.mockClear();
  observe.mockClear();
  runSync.mockClear();
  globalFetch.mockClear();
  vi.stubGlobal('fetch', globalFetch);
});

afterEach(() => {
  expect(globalFetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

const bind = (binding: LedgerBinding) => {
  injected.ledger = binding;
};

const attention = 'reconciliation.attention';

describe.each(sequencerTransports)(
  'stopped seasons over the %s transport',
  (transport) => {
    const published = async () => {
      const harness = await EntryPointHarness.create(transport, bind);
      await harness.published();
      return harness;
    };

    it('refuses a manual run on a held season before any request, and raises the hold on every tick', async () => {
      const harness = await published();
      await harness.operate(later(FIRST_PUBLICATION, MINUTE), 'hold');
      const release = harness.activeVersion();

      const manual = await harness.manual(later(PRE_SEASON, 2 * HOUR));

      expect(manual.status).toBe(200);
      expect(manual.body.data).toEqual({
        status: 'nothing-due',
        season: SEASON,
        run: {
          trigger: 'manual',
          forcedPublication: true,
          advancesSchedule: false,
        },
        reason: 'publication-stopped',
        providerRequests: 0,
        leaseRelease: 'released',
      });
      expect(manual).toMatchObject({
        requests: [],
        reservations: 0,
        prepares: 0,
        storageWrites: 0,
      });
      // A manual run writes no attention line: its operator is looking.
      expect(linesOf(manual, attention)).toEqual([]);

      for (const hours of [3, 4]) {
        const tick = await harness.scheduled(later(PRE_SEASON, hours * HOUR));
        expect(tick.prepares).toBe(0);
        expect(linesOf(tick, attention)).toEqual([
          {
            level: 'warn',
            operation: attention,
            season: SEASON,
            syncTrigger: 'scheduled',
            reconciliationAttention: ['operator-hold'],
            backlogCount: 0,
            backlogCapacity: 60,
          },
        ]);
      }
      expect(harness.activeVersion()).toBe(release);
    });

    it('refuses a durably blocked season the same way, and names the block', async () => {
      const harness = await published();
      await harness.block(later(FIRST_PUBLICATION, MINUTE));

      const manual = await harness.manual(later(PRE_SEASON, 2 * HOUR));
      const tick = await harness.scheduled(later(PRE_SEASON, 3 * HOUR));

      expect(manual.body.data).toMatchObject({
        status: 'nothing-due',
        reason: 'publication-stopped',
        providerRequests: 0,
      });
      expect([manual.requests, manual.prepares]).toEqual([[], 0]);
      expect(tick.prepares).toBe(0);
      expect(linesOf(tick, attention)).toEqual([
        expect.objectContaining({
          level: 'warn',
          reconciliationAttention: ['durable-block'],
          durableBlockReason: 'classification-superseded',
        }),
      ]);
    });

    it.each([
      [47, null, null],
      [48, ['backlog-warning'], 'warn'],
      [60, ['backlog-full'], 'error'],
    ] as const)(
      'with %i of 60 backlog slots taken, a scheduled tick raises %j',
      async (count, conditions, level) => {
        const harness = await published();
        await harness.fillBacklog(later(FIRST_PUBLICATION, MINUTE), count);

        const tick = await harness.scheduled(later(PRE_SEASON, 2 * HOUR));
        const manual = await harness.manual(later(PRE_SEASON, 3 * HOUR));

        expect(linesOf(tick, attention)).toEqual(
          conditions === null
            ? []
            : [
                {
                  level,
                  operation: attention,
                  season: SEASON,
                  syncTrigger: 'scheduled',
                  reconciliationAttention: [...conditions],
                  backlogCount: count,
                  backlogCapacity: 60,
                },
              ],
        );
        expect(linesOf(manual, attention)).toEqual([]);
      },
    );
  },
);

describe('production selecting coordinated, under its legacy authority', () => {
  async function production(transport: 'local' | 'durable-object') {
    return EntryPointHarness.create(transport, bind, {
      env: {
        ENVIRONMENT: 'production',
        SEASON_PUBLICATION_AUTHORITY: undefined,
        SEASON_PUBLICATION_CUTOVER_CONTROL: undefined,
        __SEASON_PUBLICATION_SEQUENCER: undefined,
      },
    });
  }

  it.each(sequencerTransports)(
    'refuses both triggers at the gate, with or without a ledger (%s)',
    async (transport) => {
      const harness = await production(transport);

      harness.unbindLedger();
      const unbound = await harness.manual(PRE_SEASON);
      harness.bindLedger();
      const bound = await harness.manual(PRE_SEASON);
      const tick = await harness.scheduled(PRE_SEASON);

      expect(unbound.status).toBe(503);
      expect(unbound.body.data).toMatchObject({
        reasons: ['authority-not-sequencer', 'ledger-unbound'],
      });
      expect(bound.status).toBe(503);
      expect(bound.body.data).toMatchObject({
        reasons: ['authority-not-sequencer'],
      });
      for (const record of [unbound, bound, tick]) {
        expect(record).toMatchObject({
          requests: [],
          reservations: 0,
          prepares: 0,
          storageWrites: 0,
          mockProviderCalls: 0,
        });
      }
      expect(compose).not.toHaveBeenCalled();
      expect(observe).not.toHaveBeenCalled();
      // A scheduled run still reads the bound ledger for attention.
      expect(tick.ledgerCalls).toEqual(['readSeason']);
      expect(bound.ledgerCalls).toEqual([]);
    },
  );

  it('still raises a held season from the gate on a scheduled tick', async () => {
    const harness = await production('local');
    await harness.operate(PRE_SEASON, 'hold');

    const tick = await harness.scheduled(later(PRE_SEASON, HOUR));

    expect(
      tick.logs
        .filter((line) => /^(sync|reconciliation)\./.test(line.operation))
        .map((line) => line.operation),
    ).toEqual(['sync.coordinated.withheld', attention]);
    expect(linesOf(tick, attention)).toEqual([
      expect.objectContaining({ reconciliationAttention: ['operator-hold'] }),
    ]);
  });
});

describe('mock and none with a ledger bound', () => {
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

  it('read no ledger, reach no coordinated code and produce the baseline trace', async () => {
    const ledger = new OperatorLedger('local');
    injected.ledger = () => ledger.client();

    const trace = await wholeSeasonTrace();

    // The read-only inspection route (PR-E2) lists `ledger-unbound` among
    // its reasons only while no ledger is bound; that reason and the answer
    // carrying it are the one expected difference. Everything else - every
    // sync, admin and public step - is the baseline, byte for byte.
    expect(withoutInspectionReasons(trace)).toEqual(
      withoutInspectionReasons(recorded),
    );
    expect(ledger.calls).toEqual([]);
    // `development/coordinated` is refused as a configuration error, so no
    // traced combination reaches the coordinated entry.
    expect(runSync).not.toHaveBeenCalled();
    expect(compose).not.toHaveBeenCalled();
    expect(observe).not.toHaveBeenCalled();
  });
});

const inspection = 'GET /internal/admin/reconciliation?season=2026';

function withoutInspectionReasons(
  trace: Record<string, StepTrace[]>,
): Record<string, StepTrace[]> {
  return Object.fromEntries(
    Object.entries(trace).map(([key, steps]) => [
      key,
      steps.map((step) =>
        step.step !== inspection || step.status !== 503
          ? step
          : {
              ...step,
              bodySha256: null,
              logs: step.logs.map((line) => ({
                ...line,
                coordinationMissingDependencies: (
                  (line.coordinationMissingDependencies as string[]) ?? []
                ).filter((reason) => reason !== 'ledger-unbound'),
              })),
            },
      ),
    ]),
  );
}
