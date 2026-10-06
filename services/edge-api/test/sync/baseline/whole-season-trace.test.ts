/**
 * `mock` and `none` - and every configuration that refuses a mode - behave
 * exactly as they did before the coordinated orchestration was connected to
 * the Worker's entry points.
 *
 * `whole-season-trace.json` was recorded from the baseline source (`192e83d`)
 * by `wholeSeasonTrace()` itself, before any source change on this branch.
 * The same calls must produce the same answers, the same mock provider
 * requests, the same storage calls in the same order and the same log lines,
 * and no limiter reservation, transport call or global `fetch`.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  combinations,
  steps,
  wholeSeasonTrace,
  type StepTrace,
} from './whole-season-trace';

const recorded = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'whole-season-trace.json'),
    'utf8',
  ),
) as Record<string, StepTrace[]>;

describe('the whole-season modes are unchanged from the baseline', () => {
  it('records every combination and every step', () => {
    expect(Object.keys(recorded)).toEqual(
      combinations.map(
        ([environment, mode]) => `${environment}/${mode ?? 'unset'}`,
      ),
    );
    for (const traces of Object.values(recorded)) {
      expect(traces).toHaveLength(steps.length);
    }
  });

  it('makes exactly the baseline calls and gives exactly the baseline answers', async () => {
    const trace = await wholeSeasonTrace();
    for (const key of Object.keys(recorded)) {
      expect(trace[key], key).toEqual(recorded[key]);
    }
    expect(Object.keys(trace)).toEqual(Object.keys(recorded));
  });

  it('never reserves, sends or fetches anything coordinated', () => {
    for (const [key, traces] of Object.entries(recorded)) {
      for (const step of traces) {
        expect([step.reservations, step.transport, step.fetch], key).toEqual([
          0, 0, 0,
        ]);
        for (const line of step.logs) {
          expect(String(line.operation), key).not.toMatch(
            /^sync\.coordinated|^reconciliation\.attention/,
          );
        }
      }
    }
  });

  it('is not vacuous: mock synchronizes and publishes, and refused modes fail closed', () => {
    const full = (key: string) =>
      recorded[key]!.find(
        (step) => step.step === 'POST /internal/admin/sync/full',
      )!;
    expect(full('staging/mock')).toMatchObject({
      status: 200,
      providerCalls: 1,
    });
    expect(full('staging/mock').storage.calls).toBeGreaterThan(0);
    for (const refused of ['development/coordinated', 'production/mock']) {
      expect(full(refused).status, refused).toBe(500);
    }
  });
});
