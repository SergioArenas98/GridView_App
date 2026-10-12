/**
 * The submission builder's bundle entry: the only surface its CLI loads.
 * Nothing here is part of the Worker bundle (`src/index.ts` never reaches it).
 */

export { buildSubmission } from './submission';
export { maximumSubmissionBytes } from '../../src/ingest/submission';
export { maximumManifestBytes } from './fixtures';
