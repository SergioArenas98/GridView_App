/**
 * The publication metadata of a provider-backed season snapshot (runtime
 * activation decision O-14), read from curated repository content only.
 *
 * - `contentVersion` is the curated dataset version of the season's
 *   `season-metadata` record;
 * - `attributionVersion` is the `version` of the data-source attribution
 *   record (`data-sources-v…`);
 * - `mediaVersion` is `null`: provider-backed snapshots publish no media;
 * - `seasonLabel` is the season record's curated label.
 *
 * Nothing here reads, or could read, a provider response: neither adopted
 * source publishes a version, a label or an update time. `sourceUpdatedAt` is
 * not part of it either; it is the run's reserved ordering input (O-13).
 *
 * Both records are bundled content, decoded again here so a malformed or
 * missing record makes the season unpublishable (`null`) instead of
 * publishing a guessed value. `validate:content` checks the same records
 * against their schemas before anything is merged.
 */

import dataSources from '../../../../../../content/attribution/data-sources.json';
import season2026 from '../../../../../../content/seasons/2026/season-metadata.development.json';

export interface CuratedSeasonMetadata {
  readonly contentVersion: string;
  readonly mediaVersion: null;
  readonly attributionVersion: string;
  readonly seasonLabel: string | null;
}

const datasetVersionPattern = /^\d{4}\.\d{2}\.\d{2}\.[1-9]\d*$/;
const attributionVersionPattern = /^data-sources-v[1-9]\d*$/;
const MAXIMUM_LABEL_LENGTH = 120;

/** Every curated season record the Worker bundles. */
const curatedSeasonRecords: readonly unknown[] = [season2026];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function attributionVersion(record: unknown): string | null {
  if (!isObject(record) || record.kind !== 'data-source-attribution') {
    return null;
  }
  const version = record.version;
  return typeof version === 'string' && attributionVersionPattern.test(version)
    ? version
    : null;
}

function isLabel(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === 'string' &&
      value.length > 0 &&
      value.length <= MAXIMUM_LABEL_LENGTH)
  );
}

/**
 * The curated metadata for `season`, or `null` when either record is missing
 * or malformed. A season with no curated record is never published.
 */
export function curatedSeasonMetadata(
  season: number,
  records: readonly unknown[] = curatedSeasonRecords,
  attribution: unknown = dataSources,
): CuratedSeasonMetadata | null {
  const version = attributionVersion(attribution);
  if (version === null) return null;
  const matching = records.filter(
    (record) =>
      isObject(record) &&
      record.kind === 'season-metadata' &&
      record.season === season,
  );
  // Exactly one: two records for a season is a curation defect, not a choice.
  if (matching.length !== 1) return null;
  const record = matching[0] as Record<string, unknown>;
  if (
    typeof record.datasetVersion !== 'string' ||
    !datasetVersionPattern.test(record.datasetVersion) ||
    !isLabel(record.seasonLabel)
  ) {
    return null;
  }
  return {
    contentVersion: record.datasetVersion,
    mediaVersion: null,
    attributionVersion: version,
    seasonLabel: record.seasonLabel,
  };
}
