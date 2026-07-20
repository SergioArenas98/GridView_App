import { describe, expect, it } from 'vitest';

import { parseRaceResultEntry } from '../../src/contract/parse';
import { MockFormulaOneProvider } from '../../src/providers/mock/mock-provider';
import { FixedClock } from '../../src/runtime/clock';
import { generateSnapshotSet } from '../../src/snapshots/generator';
import { runtimeSnapshotValidator } from '../../src/validation/snapshot-validator';

describe('generated public snapshots', () => {
  it('validates every generated document and includes sourceUpdatedAt', async () => {
    const set = await generatedSet();

    expect(set.documents.length).toBeGreaterThan(20);
    for (const document of set.documents) {
      expect(runtimeSnapshotValidator.validate(document)).toEqual([]);
      expect(document.meta.sourceUpdatedAt).toBe('2026-07-18T11:55:00.000Z');
    }
  });

  it('does not expose provider IDs and preserves nulls and fractional points', async () => {
    const set = await generatedSet();
    const serialized = JSON.stringify(set.documents);
    const results = set.documents.find(
      (document) => document.documentName === 'grand-prix:12:results',
    );
    const standings = set.documents.find(
      (document) => document.documentName === 'standings:drivers',
    );

    expect(serialized).not.toContain('providerId');
    expect(serialized).not.toContain('mock-drv-');
    expect(serialized).not.toContain('mock-con-');
    expect(results).toBeDefined();
    const firstEntry = parseRaceResultEntry(
      (results?.data as { entries: unknown[] }).entries[2],
    );
    expect(firstEntry.points).toBe(15.5);
    expect(firstEntry.gapToLeaderMillis).toBe(6789);
    const unranked = (standings?.data as Array<{ position: number | null }>).at(
      -1,
    );
    expect(unranked?.position).toBeNull();
  });

  it('rejects injected invalid mock data before publication', async () => {
    const clock = new FixedClock(new Date('2026-07-20T12:00:00.000Z'));
    const provider = new MockFormulaOneProvider({ clock, invalidData: true });
    const source = await provider.fetchSeasonSource(2026, ['season-calendar']);
    const set = generateSnapshotSet(source, clock.now().toISOString(), 'bad');

    expect(
      set.documents.some(
        (document) => runtimeSnapshotValidator.validate(document).length > 0,
      ),
    ).toBe(true);
  });
});

async function generatedSet() {
  const clock = new FixedClock(new Date('2026-07-20T12:00:00.000Z'));
  const provider = new MockFormulaOneProvider({
    clock,
    sourceUpdatedAt: '2026-07-18T11:55:00.000Z',
  });
  const source = await provider.fetchSeasonSource(2026, [
    'season-calendar',
    'event-schedule',
    'profiles',
    'standings',
    'results',
    'home-rebuild',
  ]);
  return generateSnapshotSet(source, clock.now().toISOString(), 'test-version');
}
