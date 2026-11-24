// Semantic rules for a curated `driver-season-entries` document.
//
// JSON Schema proves each entry's shape; it cannot prove that an entry's `id`
// is the identity ADR 0026 D7 derives from the entry's own fields, that ids are
// unique across the whole season collection, or that one driver's spans never
// invert or overlap. Those rules are stated here once so the content validator
// and its tests share them. They mirror `canonicalDriverSeasonEntryId`
// (`src/contract/identity.ts`) and the `driver-entry-span` and
// `duplicate-identity` relations (`season-integrity.ts`), which guard the same
// facts on the publication path.

/**
 * The ADR 0026 D7 identity: `{season}-{driverId}` when `startRound` is null,
 * otherwise `{season}-{driverId}-{startRound}`.
 */
export function driverSeasonEntryId(season, driverId, startRound) {
  return startRound === null || startRound === undefined
    ? `${season}-${driverId}`
    : `${season}-${driverId}-${startRound}`;
}

/**
 * Every problem with one document's entries, as human-readable strings. An
 * empty list means the document satisfies every rule. Nothing is repaired or
 * renamed.
 */
export function validateDriverSeasonEntries(document) {
  const problems = [];
  const entries = document.entries;
  const seen = new Map();

  entries.forEach((entry, index) => {
    const where = `entries[${index}]`;
    if (entry.season !== document.season) {
      problems.push(
        `${where}: season ${entry.season} differs from the document season ${document.season}`,
      );
    }
    const expected = driverSeasonEntryId(
      entry.season,
      entry.driverId,
      entry.startRound ?? null,
    );
    if (entry.id !== expected) {
      problems.push(
        `${where}: id "${entry.id}" is not the ADR 0026 D7 identity "${expected}"`,
      );
    }
    if (seen.has(entry.id)) {
      problems.push(
        `${where}: id "${entry.id}" duplicates entries[${seen.get(entry.id)}]`,
      );
    } else {
      seen.set(entry.id, index);
    }
  });

  const byDriver = new Map();
  entries.forEach((entry, index) => {
    const start = entry.startRound ?? Number.NEGATIVE_INFINITY;
    const end = entry.endRound ?? Number.POSITIVE_INFINITY;
    if (start > end) {
      problems.push(`entries[${index}]: startRound is after endRound`);
    }
    const spans = byDriver.get(entry.driverId) ?? [];
    spans.push({ start, end, index });
    byDriver.set(entry.driverId, spans);
  });
  for (const [driverId, spans] of byDriver) {
    const ordered = [...spans].sort((left, right) => left.start - right.start);
    for (let i = 1; i < ordered.length; i += 1) {
      // Touching spans overlap: the shared round would belong to both.
      if (ordered[i].start <= ordered[i - 1].end) {
        problems.push(
          `entries[${ordered[i].index}]: overlaps entries[${ordered[i - 1].index}] for driver "${driverId}"`,
        );
      }
    }
  }
  return problems;
}
