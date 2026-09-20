/**
 * The curated 2026 Grand Prix event dataset.
 *
 * Pins the 23 `eventSlug` identities and Jolpica event locators a curator
 * approved on 2026-09-19 (GridView_Provider_Evaluation.md §8.8, ADR 0022
 * amendment A1-A4). `APPROVED` below is that curator decision row for row, so
 * changing any identity or locator means changing it here in the same
 * reviewed commit.
 *
 * Runs from a clean checkout. The raw Jolpica capture is held outside the
 * repository and is never read here: §8.8 is the repository-owned record of
 * it, and this test reconstructs that record from the committed content.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  buildProviderMappingRegistry,
  canonicalKey,
  type ProviderEventLocator,
  type ProviderMappingRegistry,
} from '../../../src/providers/mappings';

import { canonical, documentOf, key, realRegistry, SEASON } from './support';

const repoRoot = join(__dirname, '..', '..', '..', '..', '..');

function readRepoFile(...segments: string[]): string {
  return readFileSync(join(repoRoot, ...segments), 'utf8');
}

interface CuratedEvent {
  readonly round: number;
  readonly raceName: string;
  readonly circuitId: string;
  readonly eventSlug: string;
}

/** The curator decision of 2026-09-19: round, raceName, circuitId, slug. */
const APPROVED: readonly CuratedEvent[] = (
  [
    [1, 'Australian Grand Prix', 'albert_park', 'australian-grand-prix'],
    [2, 'Chinese Grand Prix', 'shanghai', 'chinese-grand-prix'],
    [3, 'Japanese Grand Prix', 'suzuka', 'japanese-grand-prix'],
    [4, 'Miami Grand Prix', 'miami', 'miami-grand-prix'],
    [5, 'Canadian Grand Prix', 'villeneuve', 'canadian-grand-prix'],
    [6, 'Monaco Grand Prix', 'monaco', 'monaco-grand-prix'],
    [7, 'Barcelona Grand Prix', 'catalunya', 'barcelona-grand-prix'],
    [8, 'Austrian Grand Prix', 'red_bull_ring', 'austrian-grand-prix'],
    [9, 'British Grand Prix', 'silverstone', 'british-grand-prix'],
    [10, 'Belgian Grand Prix', 'spa', 'belgian-grand-prix'],
    [11, 'Hungarian Grand Prix', 'hungaroring', 'hungarian-grand-prix'],
    [12, 'Dutch Grand Prix', 'zandvoort', 'dutch-grand-prix'],
    [13, 'Italian Grand Prix', 'monza', 'italian-grand-prix'],
    [14, 'Spanish Grand Prix', 'madring', 'spanish-grand-prix'],
    [15, 'Azerbaijan Grand Prix', 'baku', 'azerbaijan-grand-prix'],
    [16, 'Bahrain Grand Prix in Malaysia', 'sepang', 'bahrain-grand-prix'],
    [17, 'Singapore Grand Prix', 'marina_bay', 'singapore-grand-prix'],
    [18, 'United States Grand Prix', 'americas', 'united-states-grand-prix'],
    [19, 'Mexico City Grand Prix', 'rodriguez', 'mexico-city-grand-prix'],
    [20, 'Brazilian Grand Prix', 'interlagos', 'sao-paulo-grand-prix'],
    [21, 'Las Vegas Grand Prix', 'vegas', 'las-vegas-grand-prix'],
    [22, 'Qatar Grand Prix', 'losail', 'qatar-grand-prix'],
    [23, 'Abu Dhabi Grand Prix', 'yas_marina', 'abu-dhabi-grand-prix'],
  ] as const
).map(([round, raceName, circuitId, eventSlug]) => ({
  round,
  raceName,
  circuitId,
  eventSlug,
}));

interface CuratedRecord {
  readonly source: string;
  readonly entity: string;
  readonly providerField: string;
  readonly providerValue: unknown;
  readonly gridviewId?: string;
  readonly evidence?: string;
}

const registryEvents = (
  JSON.parse(
    readRepoFile('content', 'registries', 'events.development.json'),
  ) as { events: Record<string, unknown>[] }
).events;

const mappingDocument = JSON.parse(
  readRepoFile(
    'content',
    'seasons',
    '2026',
    'provider-mappings.development.json',
  ),
) as { season: number; mappings: CuratedRecord[] };

const evidenceCorpus = JSON.parse(
  readRepoFile(
    'content',
    'seasons',
    '2026',
    'provider-evidence.development.json',
  ),
) as {
  season: number;
  identities: CuratedRecord[];
  acknowledgedUnmapped: CuratedRecord[];
};

const isEvent = (record: CuratedRecord): boolean => record.entity === 'event';
const eventMappings = mappingDocument.mappings.filter(isEvent);

function locatorOf(record: CuratedRecord): ProviderEventLocator {
  return record.providerValue as ProviderEventLocator;
}

/** A committed record as a curator row, for exact comparison. */
function asCurated(record: CuratedRecord): CuratedEvent {
  const { round, raceName, circuitId } = locatorOf(record);
  return { round, raceName, circuitId, eventSlug: String(record.gridviewId) };
}

const byRound = (a: CuratedEvent, b: CuratedEvent): number => a.round - b.round;

function eventKey(value: ProviderEventLocator, season: number = SEASON) {
  return key<'event'>({
    season,
    source: 'jolpica',
    entity: 'event',
    providerField: 'eventLocator',
    providerValue: value,
  });
}

function locatorOfRow({
  round,
  raceName,
  circuitId,
}: CuratedEvent): ProviderEventLocator {
  return { round, raceName, circuitId };
}

function resolvedSlug(
  registry: ProviderMappingRegistry,
  value: ProviderEventLocator,
  season: number = SEASON,
): string | null {
  const result = registry.resolve(eventKey(value, season));
  return result.outcome === 'resolved' ? result.gridviewId : null;
}

// ---------------------------------------------------------------------------

describe('the curated event registry', () => {
  it('holds exactly the 23 approved identities, each once', () => {
    const ids = registryEvents.map((entry) => entry.id);

    expect(ids).toHaveLength(23);
    expect(new Set(ids).size).toBe(23);
    expect([...ids].sort()).toEqual(
      APPROVED.map((row) => row.eventSlug).sort(),
    );
  });

  it('carries no synthetic test identity', () => {
    const ids = registryEvents.map((entry) => entry.id);

    for (const synthetic of [
      'french-grand-prix',
      'mystery-grand-prix',
      'test-grand-prix',
    ]) {
      expect(ids).not.toContain(synthetic);
    }
  });

  it('stores only an id and a reviewer name - no round, circuit or provider value', () => {
    for (const entry of registryEvents) {
      expect(Object.keys(entry).sort(), String(entry.id)).toEqual([
        'id',
        'name',
      ]);
    }
  });
});

describe('the 2026 Jolpica event mappings', () => {
  it('are exactly 23 Jolpica eventLocator records in a 2026 file', () => {
    expect(mappingDocument.season).toBe(2026);
    expect(eventMappings).toHaveLength(23);
    for (const record of eventMappings) {
      expect(record.source).toBe('jolpica');
      expect(record.providerField).toBe('eventLocator');
    }
  });

  it('reproduce the curator decision exactly, row for row', () => {
    expect(eventMappings.map(asCurated).sort(byRound)).toEqual(APPROVED);
  });

  it('use exactly the integer rounds 1 through 23', () => {
    const rounds = eventMappings.map((record) => locatorOf(record).round);

    for (const round of rounds) expect(Number.isInteger(round)).toBe(true);
    expect([...rounds].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 23 }, (_, index) => index + 1),
    );
  });

  it('never carry a season inside a locator', () => {
    for (const record of eventMappings) {
      expect(Object.keys(locatorOf(record)).sort()).toEqual([
        'circuitId',
        'raceName',
        'round',
      ]);
    }
  });

  it('target every approved slug exactly once, and only existing ones', () => {
    const targets = eventMappings.map((record) => String(record.gridviewId));

    expect(new Set(targets).size).toBe(23);
    for (const target of targets) {
      expect(canonical.event.has(target), target).toBe(true);
    }
  });

  it('have 23 distinct complete keys, so no two locators collide', () => {
    const keys = eventMappings.map((record) =>
      canonicalKey(eventKey(locatorOf(record))),
    );

    expect(new Set(keys).size).toBe(23);
  });

  it('point every record at the §8.8 evidence and its raw-response hash', () => {
    for (const record of eventMappings) {
      const { round } = locatorOf(record);
      expect(record.evidence).toContain(
        `GridView_Provider_Evaluation.md 8.8 round ${round} -`,
      );
      expect(record.evidence).toContain(
        '87dd8cad5d33eb67f97aa46de7d024715135b9429707de99f8966c498c8e0bed',
      );
    }
  });
});

describe('the 2026 evidence corpus', () => {
  it('records exactly the mapped locators, and acknowledges none of them', () => {
    const corpusEvents = evidenceCorpus.identities.filter(isEvent);
    const keysOf = (records: readonly CuratedRecord[]): string[] =>
      records.map((record) => canonicalKey(eventKey(locatorOf(record)))).sort();

    expect(evidenceCorpus.season).toBe(2026);
    expect(corpusEvents).toHaveLength(23);
    expect(keysOf(corpusEvents)).toEqual(keysOf(eventMappings));
    expect(evidenceCorpus.acknowledgedUnmapped.filter(isEvent)).toEqual([]);
  });
});

describe('the repository-owned evidence record (Provider Evaluation §8.8)', () => {
  const evaluation = readRepoFile(
    'docs',
    'technical',
    'GridView_Provider_Evaluation.md',
  );
  const start = evaluation.indexOf('### 8.8 ');
  // Stops at §8.8.1, which is the *circuit* evidence record and carries its
  // own tables in the same shape. Reading to the next `---` would swallow it
  // and mix circuit rows into the event reconstruction below.
  const section = evaluation.slice(
    start,
    evaluation.indexOf('#### 8.8.1 ', start),
  );

  it('records the observation the mappings cite', () => {
    expect(start).toBeGreaterThan(0);
    for (const fact of [
      '`https://api.jolpi.ca/ergast/f1/2026/races/?limit=100`',
      '2026-09-19T19:38:15Z',
      'HTTP 200',
      '`total` 23; 23 race objects returned',
      '87dd8cad5d33eb67f97aa46de7d024715135b9429707de99f8966c498c8e0bed',
      'CC BY-NC-SA 4.0',
      '`https://www.formula1.com/en/racing/2026`, **accessed 2026-09-19**',
    ]) {
      expect(section, fact).toContain(fact);
    }
  });

  it('is reconstructed exactly by the committed locators and slugs', () => {
    const rows = [
      ...section.matchAll(
        /^\| (\d+) \| `([^`]+)` \| `([^`]+)` \| `([^`]+)` \|/gm,
      ),
    ].map(([, round, raceName, circuitId, eventSlug]) => ({
      round: Number(round),
      raceName: String(raceName),
      circuitId: String(circuitId),
      eventSlug: String(eventSlug),
    }));

    expect(rows).toEqual(APPROVED);
    expect(eventMappings.map(asCurated).sort(byRound)).toEqual(rows);
  });
});

describe('resolution through the real registry', () => {
  const real = realRegistry();

  it('resolves every approved locator to its approved slug', () => {
    expect(real.isValid).toBe(true);
    for (const row of APPROVED) {
      expect(resolvedSlug(real, locatorOfRow(row)), row.raceName).toBe(
        row.eventSlug,
      );
    }
  });

  it('is independent of the order of the JSON records', () => {
    const records = mappingDocument.mappings;
    const orders: readonly (readonly CuratedRecord[])[] = [
      [...records].reverse(),
      [...records].sort((a, b) =>
        JSON.stringify(a.providerValue).localeCompare(
          JSON.stringify(b.providerValue),
        ),
      ),
    ];

    for (const order of orders) {
      const permuted = buildProviderMappingRegistry(
        [documentOf(order)],
        canonical,
      );
      expect(permuted.problems).toEqual([]);
      expect(permuted.size).toBe(real.size);
      for (const row of APPROVED) {
        expect(resolvedSlug(permuted, locatorOfRow(row))).toBe(row.eventSlug);
      }
    }
  });

  it('selects no event through a partial, shifted or normalized locator', () => {
    const near: ProviderEventLocator[] = [];
    APPROVED.forEach((row, index) => {
      const exact = locatorOfRow(row);
      const next = APPROVED[(index + 1) % APPROVED.length] as CuratedEvent;
      near.push(
        { ...exact, round: row.round === 23 ? 22 : row.round + 1 },
        { ...exact, raceName: row.raceName.toLowerCase() },
        { ...exact, raceName: row.raceName.toUpperCase() },
        { ...exact, circuitId: row.circuitId.toUpperCase() },
        { ...exact, circuitId: row.circuitId.replaceAll('_', '-') + '-x' },
        { ...exact, raceName: next.raceName },
        { ...exact, circuitId: next.circuitId },
      );
    });
    // The deliberate curation decisions: the identity's own name, or the
    // other Spanish venue, never stands in for the observed locator.
    near.push(
      { round: 7, raceName: 'Barcelona Grand Prix', circuitId: 'madring' },
      { round: 14, raceName: 'Spanish Grand Prix', circuitId: 'catalunya' },
      { round: 16, raceName: 'Bahrain Grand Prix', circuitId: 'sepang' },
      { round: 16, raceName: 'Bahrain Grand Prix', circuitId: 'bahrain' },
      { round: 20, raceName: 'São Paulo Grand Prix', circuitId: 'interlagos' },
      { round: 20, raceName: 'Sao Paulo Grand Prix', circuitId: 'interlagos' },
    );

    for (const value of near) {
      expect(resolvedSlug(real, value), JSON.stringify(value)).toBeNull();
    }
  });

  it('matches no approved locator in another season', () => {
    for (const row of APPROVED) {
      expect(resolvedSlug(real, locatorOfRow(row), 2027)).toBeNull();
    }
  });
});
