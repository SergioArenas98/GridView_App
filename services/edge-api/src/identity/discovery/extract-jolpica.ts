/** Pure U1 extraction. Call with the actual decoder result and the same parsed body.
 * No transport, port wiring, global state, logger, clock or storage is constructed.
 */
import { canonicalJson, utf8 } from '../../ingest/canonical-json';
import { canonicalInstant } from '../../publication/canonical/instant';
import { decodeProviderMappingKey } from '../../providers/mappings/mapping-key';
import type { ProviderMappingRegistry } from '../../providers/mappings/mapping-registry';
import { own, recheckDecoded } from './boundary';
import {
  candidateIdFor,
  enumerateJolpicaKeys,
  hashIdentityProjection,
} from './keys';
import { sealObservation } from './model';
import type {
  CatalogReference,
  DecodedJolpicaResource,
  DiscoveryResult,
  EvidenceField,
  EvidenceSourceField,
  IdentityEvidenceProjection,
  IdentityKeyReference,
  IdentityObservation,
  ObservationContext,
  OmittedEvidenceField,
} from './model';

const extractorVersion = 'jolpica-identity/1' as const;
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const hash = /^sha256:[0-9a-f]{64}$/;
const fields = [
  ['givenName', 'givenName'],
  ['familyName', 'familyName'],
  ['fullName', 'fullName'],
  ['dateOfBirth', 'dateOfBirth'],
  ['nationality', 'nationality'],
  ['shortCode', 'code'],
  ['permanentNumber', 'permanentNumber'],
] as const satisfies readonly (readonly [EvidenceField, EvidenceSourceField])[];

function closed(value: unknown, names: readonly string[]): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return false;
  const keys = Reflect.ownKeys(value);
  return (
    keys.length === names.length &&
    keys.every(
      (k) =>
        typeof k === 'string' &&
        names.includes(k) &&
        Object.getOwnPropertyDescriptor(value, k)?.enumerable === true &&
        own(value, k) !== undefined,
    )
  );
}
function contextCopy(input: ObservationContext): ObservationContext | null {
  if (
    !closed(input, [
      'runId',
      'requestOrdinal',
      'observedAt',
      'catalogRef',
      'transportKind',
      'synthetic',
    ])
  )
    return null;
  const runId = own(input, 'runId'),
    requestOrdinal = own(input, 'requestOrdinal');
  const observedAt = own(input, 'observedAt'),
    transportKind = own(input, 'transportKind');
  const synthetic = own(input, 'synthetic'),
    ref = own(input, 'catalogRef');
  if (
    typeof runId !== 'string' ||
    !uuid.test(runId) ||
    typeof requestOrdinal !== 'number' ||
    !Number.isSafeInteger(requestOrdinal) ||
    requestOrdinal < 1 ||
    typeof observedAt !== 'string' ||
    observedAt.length > 40 ||
    !observedAt.endsWith('Z') ||
    canonicalInstant(observedAt) === null ||
    typeof transportKind !== 'string' ||
    !['direct', 'proxy', 'controlled', 'offline-replay'].includes(
      transportKind,
    ) ||
    typeof synthetic !== 'boolean' ||
    (transportKind === 'controlled' && !synthetic)
  )
    return null;
  const mode = own(ref, 'mode'),
    catalogHash = own(ref, 'catalogHash'),
    revisionId = own(ref, 'revisionId');
  if (typeof catalogHash !== 'string' || !hash.test(catalogHash)) return null;
  let catalogRef: CatalogReference;
  if (mode === 'bundled' && closed(ref, ['mode', 'catalogHash'])) {
    catalogRef = {
      mode,
      catalogHash: catalogHash as CatalogReference['catalogHash'],
    };
  } else if (
    mode === 'runtime' &&
    typeof revisionId === 'string' &&
    uuid.test(revisionId) &&
    closed(ref, ['mode', 'catalogHash', 'revisionId'])
  ) {
    catalogRef = {
      mode,
      revisionId,
      catalogHash: catalogHash as CatalogReference['catalogHash'],
    };
  } else return null;
  return {
    runId,
    requestOrdinal,
    observedAt: canonicalInstant(observedAt)!,
    catalogRef,
    transportKind: transportKind as ObservationContext['transportKind'],
    synthetic,
  };
}
function extractClaims(
  body: unknown,
  ref: IdentityKeyReference,
): {
  evidence: IdentityEvidenceProjection;
  omittedFields: OmittedEvidenceField[];
} {
  const evidence: Partial<
    Record<EvidenceField, { value: string; sourceField: EvidenceSourceField }>
  > = {};
  const omittedFields: OmittedEvidenceField[] = [];
  if (ref.driverPath === null) return { evidence: {}, omittedFields };
  let row: unknown = body;
  for (const segment of ref.driverPath) row = own(row, segment);
  if (
    typeof row !== 'object' ||
    row === null ||
    Array.isArray(row) ||
    own(row, 'driverId') !== ref.key.providerValue
  )
    throw new Error('Mismatched driver evidence.');
  for (const [field, sourceField] of fields) {
    let reason: OmittedEvidenceField['reason'] | null = null;
    try {
      const descriptor = Object.getOwnPropertyDescriptor(row, sourceField);
      if (descriptor === undefined) continue;
      if (!('value' in descriptor) || !descriptor.enumerable)
        reason = 'unsafe-property';
      else {
        const value: unknown = descriptor.value;
        if (typeof value !== 'string') reason = 'invalid-type';
        // UTF-16 length bounds work before code-point traversal (at most 400 units).
        else if (value.length > 400 || [...value].length > 200)
          reason = 'too-long';
        else if (value.length === 0 || /\p{Cc}/u.test(value))
          reason = 'invalid-value';
        else if (field === 'fullName')
          reason = 'unsupported-field'; // Not a documented Jolpica Driver field; never concatenate.
        else if (
          field === 'dateOfBirth' &&
          (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
            canonicalInstant(value + 'T00:00:00Z') === null)
        )
          reason = 'invalid-value';
        else if (
          field === 'permanentNumber' &&
          (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)))
        )
          reason = 'invalid-value';
        else evidence[field] = { value, sourceField };
      }
    } catch {
      reason = 'unsafe-property';
    }
    if (reason !== null) omittedFields.push({ field, reason });
  }
  // Field-to-source pairing is constructed by the closed table, never provider input.
  return { evidence: evidence as IdentityEvidenceProjection, omittedFields };
}
const skip = (
  reason: Extract<DiscoveryResult, { status: 'skipped' }>['reason'],
): DiscoveryResult => ({ status: 'skipped', reason, observations: [] });

export async function extractJolpicaObservations(
  input: DecodedJolpicaResource,
  body: unknown,
  context: ObservationContext,
  registry: Pick<ProviderMappingRegistry, 'resolve'>,
): Promise<DiscoveryResult> {
  try {
    if (!input.decoded.ok) return skip('decode-failed');
    const copiedContext = contextCopy(context);
    if (
      copiedContext === null ||
      !Number.isSafeInteger(input.season) ||
      input.season < 1950 ||
      input.season > 2100 ||
      !Number.isSafeInteger(input.requestedLimit) ||
      input.requestedLimit < 1 ||
      input.requestedLimit > 100 ||
      (input.endpointKind === 'race-results' &&
        (!Number.isSafeInteger(input.round) || input.round < 1))
    )
      return skip('invalid-context');
    const checked = recheckDecoded(input, body);
    if (
      !checked.decoded.ok ||
      canonicalJson(checked.decoded) !== canonicalJson(input.decoded)
    )
      return skip('decode-mismatch');
    const endpointKind = checked.endpointKind;
    const refs = enumerateJolpicaKeys(checked);
    if (refs.length > 2000) return skip('capacity');
    const pending: {
      ref: IdentityKeyReference;
      evidence: IdentityEvidenceProjection;
      omittedFields: OmittedEvidenceField[];
    }[] = [];
    // Complete safe projections and all resolution decisions precede the first await.
    for (const ref of refs) {
      const key = decodeProviderMappingKey(ref.key);
      if (!key.ok) return skip('resolution-fault');
      const resolution = registry.resolve(key.key);
      if (resolution.outcome === 'resolved') continue;
      if (resolution.failure.reason !== 'unmapped')
        return skip('resolution-fault');
      pending.push({
        ref: { ...ref, key: key.key },
        ...extractClaims(body, ref),
      });
    }
    const observations: IdentityObservation[] = [];
    const seen = new Set<string>();
    let bytes = 0;
    for (const { ref, evidence, omittedFields } of pending) {
      const evidenceDigest = await hashIdentityProjection({
        extractorVersion,
        key: ref.key,
        resource: ref.resource,
        round: ref.round,
        sessionType: ref.sessionType,
        evidence,
        provenanceKind: 'provider-observation',
      });
      const candidateId = await candidateIdFor(ref.key);
      const observationId = await hashIdentityProjection({
        format: 'gv-identity-observation/1',
        candidateId,
        runId: copiedContext.runId,
        requestOrdinal: copiedContext.requestOrdinal,
        evidenceDigest,
      });
      if (seen.has(observationId)) continue;
      const observation = sealObservation({
        schemaVersion: 1,
        observationId,
        candidateId,
        key: ref.key,
        runId: copiedContext.runId,
        requestOrdinal: copiedContext.requestOrdinal,
        resource: ref.resource,
        endpointKind,
        round: ref.round,
        sessionType: ref.sessionType,
        observedAt: copiedContext.observedAt,
        recordedAt: null,
        catalogRef: copiedContext.catalogRef,
        evidence,
        evidenceDigest,
        provenance: {
          kind: 'provider-observation',
          decoderVersion: 'jolpica-strict/1',
          extractorVersion,
          decoderSucceeded: true,
          provider: 'jolpica',
          transportKind: copiedContext.transportKind,
          synthetic: copiedContext.synthetic,
        },
        omittedFields,
      });
      const length = utf8(canonicalJson(observation)).byteLength;
      bytes += length;
      if (length > 8192 || bytes > 2 * 1024 * 1024) return skip('capacity');
      seen.add(observationId);
      observations.push(observation);
    }
    return { status: 'collected', observations: Object.freeze(observations) };
  } catch {
    return skip('unsafe-input'); // Never return raw exceptions or provider values.
  }
}
