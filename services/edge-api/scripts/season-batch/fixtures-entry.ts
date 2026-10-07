/**
 * The frozen-fixture converter's bundle entry: the only surface its CLI loads.
 * Nothing here is part of the Worker bundle (`src/index.ts` never reaches it).
 */

export {
  convertSeasonBatch,
  decodeReviewedManifest,
  descriptorFile,
  maximumManifestBytes,
} from './fixtures';
