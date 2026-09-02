/**
 * Bounded operational signals, provider containment, side-effect freedom and
 * the dormancy of the seam.
 *
 * Required cases 32-35, plus the field discipline for every failure category.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import worker from '../../../src/index';
import { CapturingLogger } from '../../../src/logging/logger';
import {
  COORDINATION_CONTRIBUTION_OPERATION,
  CoordinatedSeasonPublication,
  MultiSourceCoordinator,
  attemptedFailureReasons,
  contributionEvent,
  coordinationFailureReasons,
  notAttemptedReasons,
  runEvent,
  selectionEvent,
  transportReferenceMaxLength,
  type CoordinationOutcomeReason,
  type SourceContribution,
} from '../../../src/providers/coordination';
import {
  createHarness,
  providerCalls,
  request,
  seedPublishedSnapshot,
} from '../../support/edge-harness';
import {
  FakePort,
  SEASON,
  attempt,
  completePort,
  fullPlan,
  metadataFor,
  payloadFor,
  publicationHarness,
  raceResource,
  seasonFixture,
} from './support';

const repoRoot = join(__dirname, '..', '..', '..', '..', '..');
const sourceDir = join(repoRoot, 'services', 'edge-api', 'src');

function sourceFiles(): string[] {
  return (readdirSync(sourceDir, { recursive: true }) as string[])
    .map((entry) => entry.toString().replace(/\\/g, '/'))
    .filter((entry) => entry.endsWith('.ts'));
}

const everyReason: readonly CoordinationOutcomeReason[] = [
  ...notAttemptedReasons,
  ...attemptedFailureReasons,
  ...coordinationFailureReasons,
];

function contributionWith(
  reason: CoordinationOutcomeReason,
  overrides: Partial<SourceContribution> = {},
): SourceContribution {
  return {
    source: 'jolpica',
    role: 'reconciled',
    resource: raceResource(12),
    jobCategory: 'results',
    status: 'failed',
    attempted: false,
    reason,
    retryAt: null,
    retryAfter: null,
    payload: null,
    ...overrides,
  };
}

describe('coordination signals are bounded', () => {
  const allowedContributionKeys = new Set([
    'level',
    'operation',
    'season',
    'providerSourceId',
    'providerSourceRole',
    'coordinationResource',
    'jobCategory',
    'coordinationStatus',
    'providerRequestAttempted',
    'failureCategory',
    'providerRetryAt',
    'providerRetryAfter',
  ]);

  // Case 34
  it('emits only bounded scalar metadata for every failure category', () => {
    const logger = new CapturingLogger();
    for (const reason of everyReason) {
      logger.warn(contributionEvent(contributionWith(reason)));
    }

    for (const event of logger.events) {
      for (const value of Object.values(event)) {
        // No nested object, array or null ever reaches a coordination line.
        expect(['string', 'number', 'boolean']).toContain(typeof value);
      }
    }

    const emitted = logger.events.filter(
      (event) => event.operation === COORDINATION_CONTRIBUTION_OPERATION,
    );
    expect(emitted).toHaveLength(everyReason.length);
    for (const event of emitted) {
      for (const key of Object.keys(event)) {
        expect(allowedContributionKeys, key).toContain(key);
      }
      expect(typeof event.season).toBe('number');
      expect(typeof event.failureCategory).toBe('string');
      expect(String(event.failureCategory).length).toBeLessThan(40);
    }
  });

  it('never writes a transport reference or a payload into a log line', async () => {
    const source = await seasonFixture();
    const hostile =
      'https://api.jolpi.ca/ergast/f1/2026/results.json?key=SECRET&x=<script>&limit=100';
    expect(hostile.length).toBeGreaterThan(transportReferenceMaxLength);

    const logger = new CapturingLogger();
    const port = new FakePort('jolpica', (candidate) => {
      const payload = payloadFor(source, candidate.resource);
      if (payload === null) throw new Error('fixture gap');
      return {
        outcome: 'candidate',
        attempt: attempt(hostile.slice(0, transportReferenceMaxLength)),
        payload,
      };
    });
    const coordinator = new MultiSourceCoordinator({ ports: [port], logger });

    const run = await coordinator.coordinate({
      plan: { season: SEASON, resources: [raceResource(12)] },
    });
    const serialized = logger.serialized();

    expect(run.counts.selected).toBe(1);
    expect(serialized).not.toContain('jolpi.ca');
    expect(serialized).not.toContain('SECRET');
    expect(serialized).not.toContain('<script>');
    expect(serialized).not.toContain('reference');
    // No payload body, no entity identity, no snapshot content.
    expect(serialized).not.toContain('max-verstappen');
    expect(serialized).not.toContain('entries');
    expect(serialized).not.toContain('grandPrixId');
  });

  it('refuses to carry a hostile retry hint at all', async () => {
    const logger = new CapturingLogger();
    const port = new FakePort('jolpica', () => ({
      outcome: 'not-attempted',
      reason: 'rate-limit-deferred',
      retryAt: 'javascript:alert(1)',
    }));
    const coordinator = new MultiSourceCoordinator({ ports: [port], logger });

    await coordinator.coordinate({
      plan: { season: SEASON, resources: [raceResource(12)] },
    });

    expect(logger.serialized()).not.toContain('javascript:');
    expect(logger.serialized()).not.toContain('alert');
  });

  it('bounds the selection and run events to counts and closed members', async () => {
    const source = await seasonFixture();
    const logger = new CapturingLogger();
    const coordinator = new MultiSourceCoordinator({
      ports: [completePort('jolpica', source)],
      logger,
    });

    const run = await coordinator.coordinate({ plan: fullPlan(source) });
    const selection = selectionEvent(
      run.resources[0] as (typeof run.resources)[number],
    );
    const summary = runEvent(run);

    expect(selection.coordinationOutcome).toBe('selected');
    expect(
      Object.values(summary).every((value) => typeof value !== 'object'),
    ).toBe(true);
    expect(summary.coordinationPlanned).toBe(run.counts.planned);
    expect(summary.coordinationSelected).toBe(run.counts.selected);
  });
});

describe('coordination performs no I/O of its own', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Case 35
  it('needs no fetch, no binding and no provider endpoint', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('coordination must not fetch'));
    const source = await seasonFixture();
    const harness = publicationHarness();
    const coordinator = new MultiSourceCoordinator({
      ports: [completePort('jolpica', source)],
      logger: harness.logger,
    });

    const run = await coordinator.coordinate({ plan: fullPlan(source) });
    await new CoordinatedSeasonPublication({
      publisher: harness.publisher,
      logger: harness.logger,
    }).publish(run, metadataFor(source), '2026-07-20T12:00:00.000Z', 'v1');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await harness.storage.getActiveVersion(SEASON)).toBe('v1');
  });

  it('declares no transport, storage or scheduling primitive', () => {
    const dir = join(sourceDir, 'providers', 'coordination');
    const forbidden = [
      /\bfetch\s*\(/,
      /\bKVNamespace\b/,
      /\bDurableObject\b/,
      /\bcaches\b/,
      /\bsetActiveVersion\b/,
      /\bsetPreviousVersion\b/,
      /\bsetSyncState\b/,
      /\bsetQuotaState\b/,
      /\bsetInterval\b/,
      /\bsetTimeout\b/,
      /\bcrons?\b/,
    ];

    const files = readdirSync(dir).filter((file) => file.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const code = readFileSync(join(dir, file), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      for (const pattern of forbidden) {
        expect(pattern.test(code), `${file} must not match ${pattern}`).toBe(
          false,
        );
      }
    }
  });

  it('computes no event offset or recurring cadence', () => {
    const dir = join(sourceDir, 'providers', 'coordination');
    for (const file of readdirSync(dir).filter((name) =>
      name.endsWith('.ts'),
    )) {
      const code = readFileSync(join(dir, file), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      // Scheduling stays in sync/scheduler.ts; G5 is untouched.
      expect(code).not.toContain('intervalsSeconds');
      expect(code).not.toContain('calculateDueJobs');
      expect(code).not.toContain('isDue');
    }
  });
});

describe('the coordination seam is dormant', () => {
  it('is consumed by no runtime module', () => {
    const offenders = sourceFiles()
      .filter((file) => !file.startsWith('providers/coordination/'))
      .filter((file) => {
        const contents = readFileSync(join(sourceDir, file), 'utf8');
        return (
          contents.includes('providers/coordination') ||
          contents.includes("from './coordination") ||
          contents.includes('MultiSourceCoordinator')
        );
      });

    // No adapter exists, so nothing may drive the coordinator yet. The mock
    // provider remains the whole-season double the synchronization service
    // uses, and `PROVIDER_MODE` still admits exactly `mock | none`.
    expect(offenders).toEqual([]);
  });

  it('adds no provider adapter and no source-named module', () => {
    const providerFiles = (
      readdirSync(join(sourceDir, 'providers'), { recursive: true }) as string[]
    ).map((entry) => entry.toString().toLowerCase());

    expect(providerFiles.some((name) => name.includes('openf1'))).toBe(false);
    expect(providerFiles.some((name) => name.includes('jolpica'))).toBe(false);
  });

  it('keeps the runtime provider mode union unchanged', () => {
    const environment = readFileSync(
      join(sourceDir, 'config', 'environment.ts'),
      'utf8',
    );
    expect(environment).toContain(
      "const validProviderModes = ['mock', 'none'] as const;",
    );
  });
});

describe('the public surface is untouched', () => {
  // Case 32
  it('performs no provider work for a public read', async () => {
    const harness = createHarness();
    await seedPublishedSnapshot(harness);
    const before = providerCalls(harness.provider);

    for (const path of [
      '/v1/status',
      '/v1/home?season=2026',
      '/v1/seasons/2026/calendar',
      '/v1/seasons/2026/standings/drivers',
    ]) {
      const response = await worker.fetch(request(path), harness.env);
      expect(response.status).toBe(200);
    }

    expect(providerCalls(harness.provider)).toBe(before);
  });

  // Case 33
  it('keeps coordination vocabulary out of public responses and fixtures', async () => {
    const markers = [
      'coordinationResource',
      'providerSourceRole',
      'reconciled',
      'provisionalSessionEndBound',
      'session-classification',
      'sourceId',
    ];
    const harness = createHarness();
    await seedPublishedSnapshot(harness);

    for (const path of [
      '/v1/bootstrap?season=2026',
      '/v1/home?season=2026',
      '/v1/seasons/2026',
      '/v1/seasons/2026/calendar',
      '/v1/content/manifest',
    ]) {
      const body = await (
        await worker.fetch(request(path), harness.env)
      ).text();
      for (const marker of markers) {
        expect(body, `${path} must not contain ${marker}`).not.toContain(
          marker,
        );
      }
    }

    const openapi = readFileSync(
      join(repoRoot, 'docs', 'api', 'gridview-api-v1.yaml'),
      'utf8',
    );
    for (const marker of markers) {
      expect(openapi, `OpenAPI must not contain ${marker}`).not.toContain(
        marker,
      );
    }

    const fixtureDir = join(
      repoRoot,
      'services',
      'edge-api',
      'test',
      'fixtures',
    );
    const fixtures = (readdirSync(fixtureDir, { recursive: true }) as string[])
      .map((entry) => entry.toString())
      .filter((entry) => entry.endsWith('.json'));
    expect(fixtures.length).toBeGreaterThan(0);
    for (const fixture of fixtures) {
      const contents = readFileSync(join(fixtureDir, fixture), 'utf8');
      for (const marker of markers) {
        expect(contents, `${fixture} must not contain ${marker}`).not.toContain(
          marker,
        );
      }
    }
  });
});
