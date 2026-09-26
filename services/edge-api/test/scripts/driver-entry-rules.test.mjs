/**
 * The content-validation rules for curated driver season entries (ADR 0026
 * D7): each id is the identity derived from the entry's own start boundary,
 * ids are unique across the complete document, and one driver's spans never
 * invert or overlap. They run inside `npm run validate:content`.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { canonicalDriverSeasonEntryId } from '../../src/contract/identity';
import {
  driverSeasonEntryId,
  validateDriverSeasonEntries,
} from '../../scripts/lib/driver-entry-rules.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..', '..');
const curated = JSON.parse(
  readFileSync(
    join(repoRoot, 'content', 'seasons', '2026', 'driver-entries.mock.json'),
    'utf8',
  ),
);

function entry(driverId, startRound, endRound, id) {
  return {
    id: id ?? driverSeasonEntryId(2026, driverId, startRound),
    season: 2026,
    driverId,
    constructorId: 'red-bull',
    startRound,
    endRound,
  };
}

const documentOf = (...entries) => ({ season: 2026, entries });

describe('driver season entry content rules', () => {
  it('accepts the curated document', () => {
    expect(validateDriverSeasonEntries(curated)).toEqual([]);
  });

  it('gives the curated round-1 alpine seat the null start D6 requires', () => {
    const doohan = curated.entries.find(
      (candidate) => candidate.driverId === 'jack-doohan',
    );

    expect(doohan).toMatchObject({
      id: '2026-jack-doohan',
      startRound: null,
      endRound: 9,
    });
  });

  it('matches the runtime D7 constructor on every shape', () => {
    for (const [driverId, start] of [
      ['max-verstappen', null],
      ['liam-lawson', 12],
      ['franco-colapinto', 7],
      ['foo-7', null],
      ['foo', 7],
    ]) {
      expect(driverSeasonEntryId(2026, driverId, start)).toBe(
        canonicalDriverSeasonEntryId(2026, driverId, start),
      );
    }
  });

  it('accepts a split with the D7 identity on each span', () => {
    expect(
      validateDriverSeasonEntries(
        documentOf(
          entry('liam-lawson', null, 11),
          entry('liam-lawson', 12, null),
        ),
      ),
    ).toEqual([]);
  });

  it('refuses an explicit round-1 start under the base id', () => {
    expect(
      validateDriverSeasonEntries(
        documentOf(entry('jack-doohan', 1, 9, '2026-jack-doohan')),
      ),
    ).toEqual([
      'entries[0]: id "2026-jack-doohan" is not the ADR 0026 D7 identity "2026-jack-doohan-1"',
    ]);
  });

  it('refuses a base id rebuilt for every span', () => {
    const problems = validateDriverSeasonEntries(
      documentOf(
        entry('liam-lawson', null, 11),
        entry('liam-lawson', 12, null, '2026-liam-lawson'),
      ),
    );

    expect(problems).toContain(
      'entries[1]: id "2026-liam-lawson" is not the ADR 0026 D7 identity "2026-liam-lawson-12"',
    );
    expect(problems).toContain(
      'entries[1]: id "2026-liam-lawson" duplicates entries[0]',
    );
  });

  it('refuses a cross-driver collision without renaming either entry', () => {
    expect(
      validateDriverSeasonEntries(
        documentOf(entry('foo-7', null, null), entry('foo', 7, null)),
      ),
    ).toEqual(['entries[1]: id "2026-foo-7" duplicates entries[0]']);
  });

  it.each([
    ['an inverted span', [entry('a', 9, 3)], 'startRound is after endRound'],
    [
      'touching spans',
      [entry('a', null, 9), entry('a', 9, null)],
      'overlaps entries[0]',
    ],
    [
      'two open spans',
      [entry('a', null, null), entry('a', 5, null)],
      'overlaps entries[0]',
    ],
  ])('refuses %s', (_label, entries, fragment) => {
    expect(
      validateDriverSeasonEntries(documentOf(...entries)).join('\n'),
    ).toContain(fragment);
  });

  it('refuses an entry from another season', () => {
    expect(
      validateDriverSeasonEntries({
        season: 2025,
        entries: [entry('a', null, null)],
      }),
    ).toEqual([
      'entries[0]: season 2026 differs from the document season 2025',
    ]);
  });
});
