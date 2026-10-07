/**
 * The season-batch generator's bundle entry: the only surface the CLI loads.
 * Nothing here is part of the Worker bundle (`src/index.ts` never reaches it).
 */

export { decodeCaptureManifest } from './capture';
export { generateSeasonBatch } from './generate';
