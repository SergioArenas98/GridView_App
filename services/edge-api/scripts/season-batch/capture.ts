/**
 * The recorded provider responses one season batch is generated from, and the
 * strict decoding of their manifest.
 *
 * A capture is **data the generator replays, never a request it makes**. It is
 * a directory holding `capture.json` plus one body file per recorded response.
 * Nothing in this module, or anywhere in the season-batch generator, can send a
 * request: the only transport it builds answers from these recordings.
 *
 * Producing a capture from the real provider is a separate, separately
 * authorized step that this module neither performs nor implies.
 */

import { MAXIMUM_ROUND } from '../../src/sync/coordinated/ledger/model';
import { providerMaxResponseBytes } from '../../src/providers/http/provider-http-client';

export const captureManifestKind = 'gridview-jolpica-capture';
export const captureManifestSchemaVersion = 1;
export const captureManifestFile = 'capture.json';

/** Six season-level responses plus at most one race classification per round. */
export const maximumCapturedResponses = 6 + MAXIMUM_ROUND;

/** The only origin and path prefix a recorded URL may name. */
export const captureUrlPrefix = 'https://api.jolpi.ca/ergast/f1/';

const isoInstantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const sha256Pattern = /^[0-9a-f]{64}$/;
/** A plain body file name: no directory, no traversal, no hidden file. */
const bodyFilePattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}\.json$/;

export interface CapturedResponseEntry {
  readonly url: string;
  readonly status: number;
  readonly contentType: string;
  readonly file: string;
  readonly byteLength: number;
  readonly sha256: string;
}

export interface CaptureManifest {
  readonly season: number;
  /**
   * The instant the capture was complete: after its last response arrived.
   * The generator runs every clock-dependent rule at exactly this instant.
   */
  readonly observedAt: string;
  /**
   * The race classifications the capture claims to hold, ascending. The
   * generator refuses a capture whose rounds are not exactly the rounds the
   * runtime eligibility rule admits at `observedAt`.
   */
  readonly classificationRounds: readonly number[];
  readonly responses: readonly CapturedResponseEntry[];
}

export type CaptureDecoding =
  | { readonly ok: true; readonly manifest: CaptureManifest }
  | { readonly ok: false; readonly reason: CaptureManifestProblem };

/** Closed and bounded: never a URL, a file name or a value from the capture. */
export const captureManifestProblems = [
  'not-an-object',
  'unexpected-field',
  'wrong-kind',
  'wrong-schema-version',
  'invalid-season',
  'invalid-observed-at',
  'invalid-classification-rounds',
  'invalid-responses',
  'too-many-responses',
  'invalid-response-entry',
  'url-outside-season',
  'duplicate-url',
  'duplicate-file',
] as const;

export type CaptureManifestProblem = (typeof captureManifestProblems)[number];

const manifestFields = [
  'kind',
  'schemaVersion',
  'season',
  'observedAt',
  'classificationRounds',
  'responses',
] as const;

const entryFields = [
  'url',
  'status',
  'contentType',
  'file',
  'byteLength',
  'sha256',
] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactly(
  value: Record<string, unknown>,
  fields: readonly string[],
): boolean {
  const keys = Object.keys(value);
  return (
    keys.length === fields.length && keys.every((key) => fields.includes(key))
  );
}

function isInstant(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    isoInstantPattern.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(Date.parse(value)).toISOString() === value
  );
}

function isRound(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value <= MAXIMUM_ROUND
  );
}

function decodeEntry(value: unknown): CapturedResponseEntry | null {
  if (!isObject(value) || !hasExactly(value, entryFields)) return null;
  const { url, status, contentType, file, byteLength, sha256 } = value;
  if (typeof url !== 'string' || url.length === 0 || url.length > 2048) {
    return null;
  }
  if (
    typeof status !== 'number' ||
    !Number.isSafeInteger(status) ||
    status < 100 ||
    status > 599
  ) {
    return null;
  }
  if (
    typeof contentType !== 'string' ||
    contentType.length === 0 ||
    contentType.length > 200
  ) {
    return null;
  }
  if (typeof file !== 'string' || !bodyFilePattern.test(file)) return null;
  if (
    typeof byteLength !== 'number' ||
    !Number.isSafeInteger(byteLength) ||
    byteLength < 0 ||
    byteLength > providerMaxResponseBytes
  ) {
    return null;
  }
  if (typeof sha256 !== 'string' || !sha256Pattern.test(sha256)) return null;
  return { url, status, contentType, file, byteLength, sha256 };
}

/**
 * Decodes `capture.json`. Every field is required, no other field is allowed,
 * and the first problem found is reported as a closed reason.
 */
export function decodeCaptureManifest(value: unknown): CaptureDecoding {
  const refuse = (reason: CaptureManifestProblem): CaptureDecoding => ({
    ok: false,
    reason,
  });
  if (!isObject(value)) return refuse('not-an-object');
  if (!hasExactly(value, manifestFields)) return refuse('unexpected-field');
  if (value.kind !== captureManifestKind) return refuse('wrong-kind');
  if (value.schemaVersion !== captureManifestSchemaVersion) {
    return refuse('wrong-schema-version');
  }
  const season = value.season;
  if (
    typeof season !== 'number' ||
    !Number.isSafeInteger(season) ||
    season < 1950 ||
    season > 2100
  ) {
    return refuse('invalid-season');
  }
  if (!isInstant(value.observedAt)) return refuse('invalid-observed-at');

  const rounds = value.classificationRounds;
  if (
    !Array.isArray(rounds) ||
    rounds.length > MAXIMUM_ROUND ||
    !rounds.every(isRound) ||
    !rounds.every((round, index) => index === 0 || round > rounds[index - 1]!)
  ) {
    return refuse('invalid-classification-rounds');
  }

  const responses = value.responses;
  if (!Array.isArray(responses) || responses.length === 0) {
    return refuse('invalid-responses');
  }
  if (responses.length > maximumCapturedResponses) {
    return refuse('too-many-responses');
  }
  const entries: CapturedResponseEntry[] = [];
  const urls = new Set<string>();
  const files = new Set<string>();
  const seasonPrefix = `${captureUrlPrefix}${season}/`;
  for (const raw of responses) {
    const entry = decodeEntry(raw);
    if (entry === null) return refuse('invalid-response-entry');
    if (!entry.url.startsWith(seasonPrefix))
      return refuse('url-outside-season');
    if (urls.has(entry.url)) return refuse('duplicate-url');
    if (files.has(entry.file)) return refuse('duplicate-file');
    urls.add(entry.url);
    files.add(entry.file);
    entries.push(entry);
  }

  return {
    ok: true,
    manifest: {
      season,
      observedAt: value.observedAt,
      classificationRounds: [...(rounds as number[])],
      responses: entries,
    },
  };
}
