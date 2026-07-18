import { describe, expect, it } from 'vitest';

import { parseGrandPrix, parseRaceResultEntry } from '../../src/contract/parse';

import sprint from '../fixtures/api/v1/grand-prix/sprint-weekend.json';
import unknownEnum from '../fixtures/api/v1/grand-prix/unknown-enum-status.json';
import additive from '../fixtures/api/v1/grand-prix/unknown-additive.json';
import postponed from '../fixtures/api/v1/grand-prix/postponed.json';
import raceTiming from '../fixtures/api/v1/results/race-timing.json';

describe('parseGrandPrix', () => {
  it('parses a sprint weekend with the same model as a standard weekend', () => {
    const gp = parseGrandPrix(sprint.data);
    expect(gp.format).toBe('sprint');
    expect(gp.status).toBe('in_progress');
    expect(gp.sessions.map((s) => s.type)).toEqual([
      'practice_1',
      'sprint_qualifying',
      'sprint',
      'qualifying',
      'race',
    ]);
  });

  it('maps unknown enum values to unknown', () => {
    const gp = parseGrandPrix(unknownEnum.data);
    expect(gp.status).toBe('unknown');
    expect(gp.sessions[0]?.type).toBe('unknown');
  });

  it('ignores unknown additive fields', () => {
    const gp = parseGrandPrix(additive.data);
    expect(gp.status).toBe('completed');
    expect(gp).not.toHaveProperty('experimentalRanking');
    expect(gp.sessions).toHaveLength(1);
  });

  it('preserves null values instead of substituting zero or empty string', () => {
    const gp = parseGrandPrix(postponed.data);
    expect(gp.startDate).toBeNull();
    expect(gp.endDate).toBeNull();
    expect(gp.sessions[0]?.startTime).toBeNull();
    expect(gp.sessions[0]?.status).toBe('postponed');
  });
});

describe('parseRaceResultEntry', () => {
  it('preserves structured timing and fractional points', () => {
    const winner = parseRaceResultEntry(raceTiming.data.entries[0]);
    expect(winner.elapsedTimeMillis).toBe(4512345);
    expect(winner.gapToLeaderMillis).toBeNull();
    expect(winner.points).toBe(12.5);

    const gapped = parseRaceResultEntry(raceTiming.data.entries[1]);
    expect(gapped.gapToLeaderMillis).toBe(3456);
    expect(gapped.fastestLap).toBe(true);

    const lapped = parseRaceResultEntry(raceTiming.data.entries[3]);
    expect(lapped.status).toBe('lapped');
    expect(lapped.lapsBehind).toBe(1);
    expect(lapped.points).toBeNull();

    const dnf = parseRaceResultEntry(raceTiming.data.entries[4]);
    expect(dnf.status).toBe('dnf');
    expect(dnf.position).toBeNull();
    expect(dnf.points).toBeNull();
    expect(dnf.dnfReason).toBe('Power unit (mock)');
  });
});
