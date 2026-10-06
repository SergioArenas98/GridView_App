/**
 * The late-answer pass-through: it answers exactly what the wrapped port
 * answers, and notes only the resources answered after the signal aborted.
 */

import { describe, expect, it } from 'vitest';

import {
  recordLateAnswers,
  type ProviderResourceOutcome,
  type ProviderResourcePort,
  type ProviderResourceRequest,
} from '../../../src/providers/coordination';

const SEASON = 2026;
const round = (value: number) =>
  ({
    kind: 'session-classification',
    season: SEASON,
    round: value,
    sessionType: 'race',
  }) as const;
const answer: ProviderResourceOutcome = {
  outcome: 'not-attempted',
  reason: 'resource-unsupported',
};

describe('recordLateAnswers', () => {
  it('passes every request and answer through unchanged, under the same source', async () => {
    const seen: ProviderResourceRequest[] = [];
    const port: ProviderResourcePort = {
      sourceId: 'jolpica',
      fetchResource: async (request) => {
        seen.push(request);
        return answer;
      },
    };
    const record = recordLateAnswers(port);
    const request = { source: 'jolpica', resource: round(1) } as const;

    expect(record.port.sourceId).toBe('jolpica');
    expect(Object.isFrozen(record.port)).toBe(true);
    expect(await record.port.fetchResource(request)).toBe(answer);
    expect(seen).toEqual([request]);
    expect(record.answeredAfterAbort(round(1))).toBe(false);
  });

  it('notes a resource answered after the abort, and only that one', async () => {
    const controller = new AbortController();
    const port: ProviderResourcePort = {
      sourceId: 'jolpica',
      fetchResource: async (request) => {
        // The deadline passes while round 2 is in flight.
        if (request.resource.kind === 'session-classification') {
          if (request.resource.round === 2) controller.abort();
        }
        return answer;
      },
    };
    const record = recordLateAnswers(port);

    for (const value of [1, 2, 3]) {
      await record.port.fetchResource({
        source: 'jolpica',
        resource: round(value),
        signal: controller.signal,
      });
    }

    expect(
      [1, 2, 3].map((value) => record.answeredAfterAbort(round(value))),
    ).toEqual([false, true, true]);
  });
});
