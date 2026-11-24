import { canonicalJson, utf8 } from '../ingest/canonical-json';
import { canonicalInstant } from '../publication/canonical/instant';
import {
  discoveryKey,
  candidateIdFor,
  hashIdentityProjection,
} from './discovery/keys';
import type { IdentityObservationDraft, IdentityHash } from './discovery/model';
import { IdentityError, identityLimits, type MaterialProjection } from './port';
export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const isHash = (v: unknown): v is IdentityHash =>
  typeof v === 'string' && /^sha256:[0-9a-f]{64}$/.test(v);
export const integer = (
  v: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
export function exact(
  v: unknown,
  keys: readonly string[],
): v is Record<string, unknown> {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    Object.keys(v).length === keys.length &&
    keys.every((k) => Object.hasOwn(v, k))
  );
}
export function requireValid(ok: unknown): asserts ok {
  if (!ok) throw new IdentityError('invalid-request');
}
/** Detach bounded JSON data before any validator reads it. Never invokes accessors. */
export function safeCopy(input: unknown): unknown {
  let nodes = 0;
  const visit = (v: unknown, depth: number): unknown => {
    if (++nodes > 30000 || depth > 16)
      throw new IdentityError('invalid-request');
    if (v === null || typeof v === 'boolean') return v;
    if (typeof v === 'number') {
      requireValid(Number.isFinite(v));
      return v;
    }
    if (typeof v === 'string') {
      requireValid(v.length <= identityLimits.batchBytes);
      return v;
    }
    requireValid(typeof v === 'object' && v !== null);
    if (Array.isArray(v)) {
      const length = Object.getOwnPropertyDescriptor(v, 'length')
        ?.value as unknown;
      requireValid(integer(length, 0, 2000));
      const out: unknown[] = [];
      for (let i = 0; i < length; i++) {
        const d = Object.getOwnPropertyDescriptor(v, String(i));
        requireValid(d && 'value' in d);
        out.push(visit(d.value, depth + 1));
      }
      return out;
    }
    const keys = Reflect.ownKeys(v);
    requireValid(keys.length <= 64);
    const out: Record<string, unknown> = Object.create(null);
    for (const k of keys) {
      requireValid(typeof k === 'string');
      const d = Object.getOwnPropertyDescriptor(v, k);
      requireValid(d && 'value' in d && d.enumerable);
      out[k] = visit(d.value, depth + 1);
    }
    return out;
  };
  const result = visit(input, 0);
  requireValid(
    utf8(canonicalJson(result)).byteLength <= identityLimits.batchBytes,
  );
  return result;
}
export function material(o: IdentityObservationDraft): MaterialProjection {
  return {
    extractorVersion: o.provenance.extractorVersion,
    key: o.key,
    resource: o.resource,
    round: o.round,
    sessionType: o.sessionType,
    evidence: o.evidence,
    provenanceKind: 'provider-observation',
    evidenceDigest: o.evidenceDigest,
  };
}
export async function decodeObservation(
  v: unknown,
): Promise<IdentityObservationDraft> {
  requireValid(
    exact(v, [
      'schemaVersion',
      'observationId',
      'candidateId',
      'key',
      'runId',
      'requestOrdinal',
      'resource',
      'endpointKind',
      'round',
      'sessionType',
      'observedAt',
      'recordedAt',
      'catalogRef',
      'evidence',
      'evidenceDigest',
      'provenance',
      'omittedFields',
    ]),
  );
  requireValid(
    v.schemaVersion === 1 &&
      isHash(v.observationId) &&
      isHash(v.candidateId) &&
      isHash(v.evidenceDigest) &&
      v.recordedAt === null,
  );
  const key = discoveryKey(v.key);
  requireValid(key !== null && key.source === 'jolpica');
  requireValid(
    typeof v.runId === 'string' &&
      uuidPattern.test(v.runId) &&
      integer(v.requestOrdinal, 1),
  );
  requireValid(
    typeof v.observedAt === 'string' &&
      canonicalInstant(v.observedAt) === v.observedAt,
  );
  requireValid(v.round === null || integer(v.round, 1));
  requireValid(v.sessionType === null || v.sessionType === 'race');
  const endpoints = [
    'season-drivers',
    'season-constructors',
    'race-results',
    'driver-standings',
    'constructor-standings',
    'season-calendar',
    'season-circuits',
  ];
  requireValid(
    typeof v.endpointKind === 'string' && endpoints.includes(v.endpointKind),
  );
  const resource = v.resource;
  const race = v.endpointKind === 'race-results';
  requireValid(
    exact(
      resource,
      race ? ['kind', 'season', 'round', 'sessionType'] : ['kind', 'season'],
    ),
  );
  requireValid(
    resource.season === key.season &&
      resource.kind ===
        (race
          ? 'session-classification'
          : v.endpointKind === 'season-drivers' ||
              v.endpointKind === 'season-constructors'
            ? 'season-participants'
            : v.endpointKind),
  );
  requireValid(
    race
      ? resource.round === v.round &&
          v.round !== null &&
          resource.sessionType === 'race' &&
          v.sessionType === 'race'
      : v.sessionType === null,
  );
  if (
    ['season-drivers', 'season-constructors', 'season-circuits'].includes(
      v.endpointKind,
    )
  )
    requireValid(v.round === null);
  if (v.endpointKind === 'season-calendar') requireValid(v.round !== null);
  const entities: Record<string, string[]> = {
    'season-drivers': ['driver'],
    'season-constructors': ['constructor'],
    'race-results': ['event', 'driver', 'constructor'],
    'driver-standings': ['driver', 'constructor'],
    'constructor-standings': ['constructor'],
    'season-calendar': ['event', 'circuit'],
    'season-circuits': ['circuit'],
  };
  requireValid(entities[v.endpointKind]!.includes(key.entity));
  if (key.entity === 'event') requireValid(key.providerValue.round === v.round);
  const ref = v.catalogRef;
  requireValid(
    exact(ref, ['mode', 'catalogHash']) ||
      exact(ref, ['mode', 'catalogHash', 'revisionId']),
  );
  requireValid(
    isHash(ref.catalogHash) &&
      ((ref.mode === 'bundled' && Object.keys(ref).length === 2) ||
        (ref.mode === 'runtime' &&
          typeof ref.revisionId === 'string' &&
          uuidPattern.test(ref.revisionId))),
  );
  const p = v.provenance;
  requireValid(
    exact(p, [
      'kind',
      'decoderVersion',
      'extractorVersion',
      'decoderSucceeded',
      'provider',
      'transportKind',
      'synthetic',
    ]),
  );
  requireValid(
    p.kind === 'provider-observation' &&
      p.provider === 'jolpica' &&
      p.decoderSucceeded === true &&
      p.decoderVersion === 'jolpica-strict/1' &&
      p.extractorVersion === 'jolpica-identity/1' &&
      typeof p.synthetic === 'boolean' &&
      ['direct', 'proxy', 'controlled', 'offline-replay'].includes(
        p.transportKind as string,
      ) &&
      (p.transportKind !== 'controlled' || p.synthetic === true),
  );
  const e = v.evidence;
  requireValid(typeof e === 'object' && e !== null && !Array.isArray(e));
  const sources: Record<string, string> = {
    givenName: 'givenName',
    familyName: 'familyName',
    dateOfBirth: 'dateOfBirth',
    nationality: 'nationality',
    shortCode: 'code',
    permanentNumber: 'permanentNumber',
  };
  for (const [field, claim] of Object.entries(e)) {
    requireValid(
      key.entity === 'driver' &&
        Object.hasOwn(sources, field) &&
        exact(claim, ['value', 'sourceField']),
    );
    requireValid(
      claim.sourceField === sources[field] &&
        typeof claim.value === 'string' &&
        claim.value.length > 0 &&
        [...claim.value].length <= 200 &&
        !/\p{Cc}/u.test(claim.value),
    );
    if (field === 'dateOfBirth')
      requireValid(
        /^\d{4}-\d{2}-\d{2}$/.test(claim.value) &&
          canonicalInstant(claim.value + 'T00:00:00Z') !== null,
      );
    if (field === 'permanentNumber')
      requireValid(
        /^\d+$/.test(claim.value) && Number.isSafeInteger(Number(claim.value)),
      );
  }
  requireValid(Array.isArray(v.omittedFields) && v.omittedFields.length <= 7);
  const omitted = new Set<string>();
  for (const f of v.omittedFields) {
    requireValid(
      exact(f, ['field', 'reason']) &&
        typeof f.field === 'string' &&
        (f.field === 'fullName' || Object.hasOwn(sources, f.field)) &&
        !omitted.has(f.field) &&
        !Object.hasOwn(e, f.field) &&
        [
          'invalid-type',
          'invalid-value',
          'too-long',
          'unsafe-property',
          'unsupported-field',
        ].includes(f.reason as string),
    );
    omitted.add(f.field);
  }
  requireValid(key.entity === 'driver' || v.omittedFields.length === 0);
  const o = v as unknown as IdentityObservationDraft;
  requireValid(utf8(canonicalJson(o)).byteLength <= 8192);
  requireValid((await candidateIdFor(key)) === o.candidateId);
  const { evidenceDigest, ...projection } = material(o);
  requireValid((await hashIdentityProjection(projection)) === evidenceDigest);
  requireValid(
    (await hashIdentityProjection({
      format: 'gv-identity-observation/1',
      candidateId: o.candidateId,
      runId: o.runId,
      requestOrdinal: o.requestOrdinal,
      evidenceDigest,
    })) === o.observationId,
  );
  return o;
}
export async function decodeBatch(
  input: unknown,
): Promise<IdentityObservationDraft[]> {
  const v = safeCopy(input);
  requireValid(
    exact(v, ['observations']) &&
      Array.isArray(v.observations) &&
      v.observations.length > 0 &&
      v.observations.length <= 100,
  );
  const result: IdentityObservationDraft[] = [];
  for (const o of v.observations) result.push(await decodeObservation(o));
  return result;
}
export async function readBounded(
  request: Request | Response,
): Promise<unknown> {
  requireValid(request.body !== null);
  const reader = request.body.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > identityLimits.batchBytes) {
        await reader.cancel();
        throw new IdentityError('invalid-request');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  return safeCopy(
    JSON.parse(
      new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes),
    ),
  );
}
