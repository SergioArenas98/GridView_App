/**
 * The identifiers of the season-batch file formats, shared by the offline
 * generator that writes them (`scripts/season-batch/`) and the guarded staging
 * ingest that reads them. One definition, so the two can never disagree about
 * what a batch is.
 */

/** `artifact.json`: the assembled source plus every generated document. */
export const artifactKind = 'gridview-season-batch';

/** `manifest.json`: the reviewable provenance, digests and summary. */
export const manifestKind = 'gridview-season-batch-manifest';

/** The one request body the guarded staging ingest accepts. */
export const submissionKind = 'gridview-season-batch-submission';

export const seasonBatchSchemaVersion = 1;

export const artifactFile = 'artifact.json';
export const manifestFile = 'manifest.json';

/** A release label that names its capture instant and its origin. */
export function batchVersion(observedAt: string): string {
  return `${observedAt.replace(/[-:.TZ]/g, '')}-batch`;
}
