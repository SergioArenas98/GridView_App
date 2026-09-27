/**
 * The Jolpica dispatching port: the single registration a coordinator holds
 * for source `jolpica`, routing each resource to the port that owns it.
 */

import { describe, expect, it } from 'vitest';

import type {
  CoordinatedResource,
  ProviderResourceOutcome,
  ProviderResourcePort,
  ProviderResourceRequest,
} from '../../../src/providers/coordination';
import {
  JolpicaResourcePort,
  type JolpicaResourcePorts,
} from '../../../src/providers/jolpica';

type PortName = keyof JolpicaResourcePorts;

interface RecordingPort extends ProviderResourcePort {
  readonly requests: ProviderResourceRequest[];
  readonly answer: ProviderResourceOutcome;
}

function recordingPort(
  name: PortName,
  sourceId: 'jolpica' | 'openf1' = 'jolpica',
): RecordingPort {
  const requests: ProviderResourceRequest[] = [];
  const answer: ProviderResourceOutcome = {
    outcome: 'failed',
    attempts: [{ reference: `stub-${name}`, outcome: 'failed' }],
    reason: 'provider-unavailable',
  };
  return {
    sourceId,
    requests,
    answer,
    fetchResource: async (request) => {
      requests.push(request);
      return answer;
    },
  };
}

function stubs(): Record<PortName, RecordingPort> {
  return {
    calendar: recordingPort('calendar'),
    circuits: recordingPort('circuits'),
    participants: recordingPort('participants'),
    results: recordingPort('results'),
    standings: recordingPort('standings'),
  };
}

const SEASON = 2026;

const routed: readonly [CoordinatedResource, PortName][] = [
  [{ kind: 'season-calendar', season: SEASON }, 'calendar'],
  [{ kind: 'season-circuits', season: SEASON }, 'circuits'],
  [{ kind: 'season-participants', season: SEASON }, 'participants'],
  [
    {
      kind: 'session-classification',
      season: SEASON,
      round: 7,
      sessionType: 'race',
    },
    'results',
  ],
  [{ kind: 'driver-standings', season: SEASON }, 'standings'],
  [{ kind: 'constructor-standings', season: SEASON }, 'standings'],
];

const unrouted: readonly CoordinatedResource[] = [
  { kind: 'event-schedule', season: SEASON, round: 7 },
  {
    kind: 'session-classification',
    season: SEASON,
    round: 7,
    sessionType: 'sprint',
  },
  {
    kind: 'session-classification',
    season: SEASON,
    round: 7,
    sessionType: 'qualifying',
  },
  {
    kind: 'session-classification',
    season: SEASON,
    round: 7,
    sessionType: 'sprint_qualifying',
  },
];

describe('JolpicaResourcePort', () => {
  it('is registered as source jolpica', () => {
    expect(new JolpicaResourcePort(stubs()).sourceId).toBe('jolpica');
  });

  it.each(routed)(
    'routes %o to the %s port exactly once, with the request unchanged',
    async (resource, owner) => {
      const ports = stubs();
      const dispatcher = new JolpicaResourcePort(ports);
      const signal = new AbortController().signal;
      const request: ProviderResourceRequest = {
        source: 'jolpica',
        resource,
        signal,
      };

      const outcome = await dispatcher.fetchResource(request);

      expect(outcome).toBe(ports[owner].answer);
      expect(ports[owner].requests).toEqual([request]);
      expect(ports[owner].requests[0]?.signal).toBe(signal);
      for (const [name, port] of Object.entries(ports)) {
        if (name !== owner) expect(port.requests, name).toEqual([]);
      }
    },
  );

  it('routes all six resources across the five ports', async () => {
    const ports = stubs();
    const dispatcher = new JolpicaResourcePort(ports);
    for (const [resource] of routed) {
      await dispatcher.fetchResource({ source: 'jolpica', resource });
    }
    expect(
      Object.fromEntries(
        Object.entries(ports).map(([name, port]) => [
          name,
          port.requests.map((request) => request.resource.kind),
        ]),
      ),
    ).toEqual({
      calendar: ['season-calendar'],
      circuits: ['season-circuits'],
      participants: ['season-participants'],
      results: ['session-classification'],
      standings: ['driver-standings', 'constructor-standings'],
    });
  });

  it.each(unrouted)(
    'refuses %o as resource-unsupported without reaching any port',
    async (resource) => {
      const ports = stubs();
      const outcome = await new JolpicaResourcePort(ports).fetchResource({
        source: 'jolpica',
        resource,
      });

      expect(outcome).toEqual({
        outcome: 'not-attempted',
        reason: 'resource-unsupported',
      });
      expect(outcome).not.toHaveProperty('attempts');
      for (const port of Object.values(ports)) {
        expect(port.requests).toEqual([]);
      }
    },
  );

  it('refuses a resource kind outside the closed union without reaching any port', async () => {
    const ports = stubs();
    const outcome = await new JolpicaResourcePort(ports).fetchResource({
      source: 'jolpica',
      resource: { kind: 'toString', season: SEASON } as never,
    });

    expect(outcome).toEqual({
      outcome: 'not-attempted',
      reason: 'resource-unsupported',
    });
    for (const port of Object.values(ports)) {
      expect(port.requests).toEqual([]);
    }
  });

  it('refuses to route to a port of another source', () => {
    for (const name of [
      'calendar',
      'circuits',
      'participants',
      'results',
      'standings',
    ] as const) {
      const ports = { ...stubs(), [name]: recordingPort(name, 'openf1') };
      expect(() => new JolpicaResourcePort(ports), name).toThrow(TypeError);
    }
  });
});
