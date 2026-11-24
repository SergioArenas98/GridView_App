import {
  exact,
  integer,
  isHash,
  requireValid,
  uuidPattern,
  decodeObservation,
} from './wire-decoders';
import { discoveryKey, candidateIdFor } from './discovery/keys';
import { canonicalInstant } from '../publication/canonical/instant';
import type { IdentityCommand } from './port';
const summary = [
  'candidateId',
  'key',
  'state',
  'recordVersion',
  'lastSeenAt',
  'observationCount',
  'distinctEvidenceCount',
  'overflowed',
  'conflict',
  'newEvidence',
  'urgent',
  'notificationGeneration',
  'acknowledgedNotificationGeneration',
];
const full = [
  ...summary,
  'archivedState',
  'evidenceHead',
  'firstSeenAt',
  'lastRecordedAt',
  'contexts',
  'reviewGeneration',
  'latestDecisionId',
  'proposedRevisionId',
  'resolvedRevisionId',
];
const states = [
  'unresolved',
  'quarantined',
  'rejected',
  'approved-pending',
  'resolved',
  'archived',
];
const instant = (v: unknown) =>
  typeof v === 'string' && canonicalInstant(v) === v;
async function candidate(v: unknown, complete: boolean): Promise<void> {
  requireValid(
    exact(v, complete ? full : summary) &&
      isHash(v.candidateId) &&
      discoveryKey(v.key) !== null &&
      states.includes(v.state as string) &&
      instant(v.lastSeenAt),
  );
  const key = discoveryKey(v.key)!;
  requireValid((await candidateIdFor(key)) === v.candidateId);
  for (const k of [
    'recordVersion',
    'observationCount',
    'distinctEvidenceCount',
    'notificationGeneration',
    'acknowledgedNotificationGeneration',
  ])
    requireValid(integer(v[k]));
  for (const k of ['overflowed', 'conflict', 'newEvidence', 'urgent'])
    requireValid(typeof v[k] === 'boolean');
  requireValid(integer(v.distinctEvidenceCount, 0, 32));
  requireValid(
    (v.acknowledgedNotificationGeneration as number) <=
      (v.notificationGeneration as number),
  );
  if (complete) {
    requireValid(
      (v.archivedState === null ||
        states.includes(v.archivedState as string)) &&
        isHash(v.evidenceHead) &&
        instant(v.firstSeenAt) &&
        instant(v.lastRecordedAt) &&
        integer(v.reviewGeneration),
    );
    requireValid(
      v.latestDecisionId === null ||
        isHash(v.latestDecisionId) ||
        (typeof v.latestDecisionId === 'string' &&
          uuidPattern.test(v.latestDecisionId)),
    );
    for (const k of ['proposedRevisionId', 'resolvedRevisionId'])
      requireValid(
        v[k] === null || (typeof v[k] === 'string' && uuidPattern.test(v[k])),
      );
    requireValid(Array.isArray(v.contexts) && v.contexts.length <= 64);
    for (const c of v.contexts) {
      requireValid(
        exact(c, ['resource', 'round', 'sessionType']) &&
          (c.round === null || integer(c.round, 1)) &&
          (c.sessionType === null || c.sessionType === 'race'),
      );
      requireValid(
        exact(c.resource, ['kind', 'season']) ||
          exact(c.resource, ['kind', 'season', 'round', 'sessionType']),
      );
      requireValid(
        [
          'season-calendar',
          'season-circuits',
          'season-participants',
          'session-classification',
          'driver-standings',
          'constructor-standings',
        ].includes(c.resource.kind as string) &&
          integer(c.resource.season, 1950, 2100),
      );
      requireValid(c.resource.season === key.season);
      if (c.resource.kind === 'session-classification')
        requireValid(
          exact(c.resource, ['kind', 'season', 'round', 'sessionType']) &&
            c.resource.round === c.round &&
            integer(c.round, 1) &&
            c.resource.sessionType === 'race' &&
            c.sessionType === 'race',
        );
      else
        requireValid(
          exact(c.resource, ['kind', 'season']) && c.sessionType === null,
        );
    }
  }
}
export async function decodeIdentityResponse(
  command: IdentityCommand,
  v: unknown,
): Promise<unknown> {
  switch (command) {
    case 'observe-batch':
      requireValid(exact(v, ['persisted', 'replayed', 'created', 'dropped']));
      for (const n of Object.values(v)) requireValid(integer(n, 0, 100));
      break;
    case 'acknowledge':
      requireValid(
        exact(v, ['acknowledgedGeneration']) &&
          integer(v.acknowledgedGeneration, 1),
      );
      break;
    case 'list':
      requireValid(
        exact(v, ['items', 'cursor']) &&
          Array.isArray(v.items) &&
          v.items.length <= 100 &&
          (v.cursor === null || isHash(v.cursor)),
      );
      for (const c of v.items) await candidate(c, false);
      break;
    case 'inspect': {
      requireValid(
        exact(v, ['candidate', 'notification', 'items', 'cursor']) &&
          Array.isArray(v.items) &&
          v.items.length <= 16 &&
          (v.cursor === null || isHash(v.cursor)),
      );
      await candidate(v.candidate, true);
      const candidateRecord = v.candidate as Record<string, unknown>;
      const n = v.notification;
      requireValid(
        exact(n, [
          'candidateId',
          'generation',
          'acknowledgedBy',
          'acknowledgedCredentialId',
          'acknowledgedAt',
        ]) &&
          isHash(n.candidateId) &&
          integer(n.generation, 1),
      );
      requireValid(
        n.candidateId === candidateRecord.candidateId &&
          n.generation === candidateRecord.notificationGeneration,
      );
      for (const k of ['acknowledgedBy', 'acknowledgedCredentialId'])
        requireValid(
          n[k] === null ||
            (typeof n[k] === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(n[k])),
        );
      requireValid(n.acknowledgedAt === null || instant(n.acknowledgedAt));
      requireValid(
        (n.acknowledgedAt === null) === (n.acknowledgedBy === null) &&
          (n.acknowledgedAt === null) === (n.acknowledgedCredentialId === null),
      );
      for (const item of v.items) {
        if (exact(item, ['projection', 'source'])) {
          const p = item.projection,
            source = item.source;
          requireValid(
            exact(p, [
              'extractorVersion',
              'key',
              'resource',
              'round',
              'sessionType',
              'evidence',
              'provenanceKind',
              'evidenceDigest',
            ]),
          );
          requireValid(
            exact(source, [
              'observationId',
              'candidateId',
              'runId',
              'requestOrdinal',
              'endpointKind',
              'observedAt',
              'recordedAt',
              'catalogRef',
              'provenance',
              'omittedFields',
            ]) && instant(source.recordedAt),
          );
          requireValid(source.candidateId === candidateRecord.candidateId);
          const { extractorVersion, provenanceKind, ...projection } = p;
          requireValid(
            extractorVersion === 'jolpica-identity/1' &&
              provenanceKind === 'provider-observation',
          );
          await decodeObservation({
            schemaVersion: 1,
            ...source,
            ...projection,
            recordedAt: null,
          });
        } else {
          requireValid(
            typeof item === 'object' &&
              item !== null &&
              instant((item as Record<string, unknown>).recordedAt),
          );
          requireValid(
            (item as Record<string, unknown>).candidateId ===
              candidateRecord.candidateId,
          );
          await decodeObservation({ ...item, recordedAt: null });
        }
      }
      break;
    }
    case 'health':
      requireValid(
        exact(v, [
          'schemaVersion',
          'installationId',
          'candidates',
          'observations',
          'evidence',
          'unread',
          'unresolved',
          'quarantined',
          'oldestUnresolvedAt',
          'logicalBytes',
          'capacityRatio',
          'warning',
          'maintenanceCursor',
          'persisted',
          'replayed',
          'dropped',
        ]) &&
          v.schemaVersion === 1 &&
          typeof v.installationId === 'string' &&
          uuidPattern.test(v.installationId),
      );
      for (const k of [
        'candidates',
        'observations',
        'evidence',
        'unread',
        'unresolved',
        'quarantined',
        'logicalBytes',
        'persisted',
        'replayed',
        'dropped',
      ])
        requireValid(integer(v[k]));
      requireValid(
        (v.oldestUnresolvedAt === null || instant(v.oldestUnresolvedAt)) &&
          typeof v.capacityRatio === 'number' &&
          Number.isFinite(v.capacityRatio) &&
          v.capacityRatio >= 0 &&
          typeof v.warning === 'boolean' &&
          (v.maintenanceCursor === '' || isHash(v.maintenanceCursor)),
      );
      break;
  }
  return v;
}
