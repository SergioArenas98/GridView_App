import { canonicalJson, utf8 } from '../ingest/canonical-json';
import { canonicalKey } from '../providers/mappings/mapping-key';
import { canonicalInstant } from '../publication/canonical/instant';
import { hashIdentityProjection } from './discovery/keys';
import type { IdentityObservationDraft, IdentityHash } from './discovery/model';
import { initialize, type IdentityStorage } from './schema';
import { catalogStorageBytes } from './storage-accounting';
import {
  decodeBatch,
  exact,
  integer,
  isHash,
  material,
  requireValid,
  safeCopy,
  uuidPattern,
} from './wire-decoders';
import {
  IdentityError,
  identityLimits,
  type Candidate,
  type CandidateSummary,
  type ObserveResult,
  type InspectResult,
  type ListResult,
  type Notification,
  type HealthResult,
  type ReaderPrincipal,
} from './port';
const day = 86400000;
const inc = (n: number) => Math.min(Number.MAX_SAFE_INTEGER, n + 1);
const text = (v: unknown) => canonicalJson(v);
const bytes = (v: string) => utf8(v).byteLength;
/** Logical payload bytes: UTF-8 text columns and eight bytes per integer,
 * including the row's accounting integer. SQLite pages/indexes are separate. */
const rowBytes = (body: string, ...columns: (string | number)[]) =>
  bytes(body) +
  8 +
  columns.reduce<number>(
    (sum, value) => sum + (typeof value === 'string' ? bytes(value) : 8),
    0,
  );
interface Pending {
  candidate: Candidate;
  version: number | null;
  observations: IdentityObservationDraft[];
  evidence: Map<string, string>;
  dropped: number;
  replayed: number;
}
export class IdentityStore {
  constructor(
    private readonly storage: IdentityStorage,
    readonly installation: string,
    private readonly now: () => number = Date.now,
  ) {
    requireValid(uuidPattern.test(installation));
    initialize(storage, installation);
  }
  private rows(q: string, ...args: (string | number | null)[]) {
    return this.storage.sql.exec(q, ...args).toArray();
  }
  private candidate(id: string): Candidate | null {
    const r = this.rows(
      'SELECT body FROM identity_candidates WHERE id=?',
      id,
    )[0];
    return r ? (JSON.parse(r.body as string) as Candidate) : null;
  }
  private logicalBytes(): number {
    // Reserve bounded metadata/counter growth even when admission is saturated.
    const meta = 1024;
    return [
      'candidates',
      'evidence',
      'observations',
      'notifications',
      'receipts',
    ].reduce(
      (sum, table) =>
        sum +
        Number(
          this.rows(
            'SELECT COALESCE(SUM(bytes),0) n FROM identity_' + table,
          )[0]!.n,
        ),
      meta + catalogStorageBytes(this.storage),
    );
  }
  private writeCandidate(c: Candidate): void {
    const body = text(c),
      key = canonicalKey(c.key);
    this.rows(
      'INSERT INTO identity_candidates(id,exact_key,season,source,version,last_recorded,body,bytes) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET version=identity_candidates.version+1,last_recorded=excluded.last_recorded,body=excluded.body,bytes=excluded.bytes',
      c.candidateId,
      key,
      c.key.season,
      c.key.source,
      1,
      Date.parse(c.lastRecordedAt),
      body,
      rowBytes(
        body,
        c.candidateId,
        key,
        c.key.season,
        c.key.source,
        1,
        Date.parse(c.lastRecordedAt),
      ),
    );
  }
  async observe(input: unknown): Promise<ObserveResult> {
    const observations = await decodeBatch(input);
    // Delivery order is not part of batch identity, including after occurrence
    // detail has been pruned to its per-candidate retention limit.
    const receipt = await hashIdentityProjection(
      [...observations].sort((a, b) =>
        a.observationId < b.observationId
          ? -1
          : a.observationId > b.observationId
            ? 1
            : 0,
      ),
    );
    for (let retry = 0; retry < 3; retry++) {
      const previous = this.rows(
        'SELECT body FROM identity_receipts WHERE id=?',
        receipt,
      )[0];
      if (previous) {
        const old = JSON.parse(previous.body as string) as ObserveResult;
        return this.storage.transactionSync(() => {
          this.rows(
            'UPDATE identity_meta SET replayed=MIN(9007199254740991,replayed+?) WHERE id=1',
            observations.length,
          );
          return {
            persisted: 0,
            created: 0,
            replayed: observations.length - old.dropped,
            dropped: old.dropped,
          };
        });
      }
      const recorded = canonicalInstant(new Date(this.now()).toISOString())!;
      const pending = new Map<string, Pending>();
      for (const o of observations) {
        let p = pending.get(o.candidateId);
        if (!p) {
          const existing = this.candidate(o.candidateId);
          if (existing && canonicalKey(existing.key) !== canonicalKey(o.key))
            throw new IdentityError('conflict');
          const c = existing ?? {
            candidateId: o.candidateId,
            key: o.key,
            state: 'unresolved',
            archivedState: null,
            recordVersion: 0,
            evidenceHead: o.evidenceDigest,
            firstSeenAt: o.observedAt,
            lastSeenAt: o.observedAt,
            lastRecordedAt: recorded,
            observationCount: 0,
            distinctEvidenceCount: 0,
            contexts: [],
            overflowed: false,
            conflict: false,
            newEvidence: false,
            urgent: false,
            reviewGeneration: 1,
            notificationGeneration: 1,
            acknowledgedNotificationGeneration: 0,
            latestDecisionId: null,
            proposedRevisionId: null,
            resolvedRevisionId: null,
          };
          p = {
            candidate: c,
            version: existing
              ? Number(
                  this.rows(
                    'SELECT version FROM identity_candidates WHERE id=?',
                    o.candidateId,
                  )[0]!.version,
                )
              : null,
            observations: [],
            evidence: new Map(
              this.rows(
                'SELECT id,body FROM identity_evidence WHERE candidate=?',
                o.candidateId,
              ).map((r) => [r.id as string, r.body as string]),
            ),
            dropped: 0,
            replayed: 0,
          };
          pending.set(o.candidateId, p);
        }
        const stored = this.rows(
          'SELECT body FROM identity_observations WHERE id=?',
          o.observationId,
        )[0];
        const duplicate = p.observations.find(
          (v) => v.observationId === o.observationId,
        );
        if (stored || duplicate) {
          const original = stored
            ? { ...JSON.parse(stored.body as string), recordedAt: null }
            : duplicate;
          if (text(original) !== text(o)) throw new IdentityError('conflict');
          p.replayed++;
          continue;
        }
        const c = p.candidate,
          projection = material(o);
        const evidenceBody = text({
          projection,
          source: {
            observationId: o.observationId,
            candidateId: o.candidateId,
            runId: o.runId,
            requestOrdinal: o.requestOrdinal,
            endpointKind: o.endpointKind,
            observedAt: o.observedAt,
            recordedAt: recorded,
            catalogRef: o.catalogRef,
            provenance: o.provenance,
            omittedFields: o.omittedFields,
          },
        });
        const existingEvidence = p.evidence.get(o.evidenceDigest);
        if (
          existingEvidence !== undefined &&
          text(JSON.parse(existingEvidence).projection) !== text(projection)
        )
          throw new IdentityError('conflict');
        const protectedCount = Number(
          this.rows(
            'SELECT COUNT(*) n FROM identity_observations WHERE candidate=? AND protected=1',
            o.candidateId,
          )[0]!.n,
        );
        if (
          (existingEvidence === undefined &&
            (p.evidence.size >= identityLimits.projections ||
              bytes(evidenceBody) > identityLimits.recordBytes)) ||
          protectedCount >= identityLimits.occurrences
        ) {
          c.overflowed = true;
          if (c.state === 'unresolved') c.state = 'quarantined';
          c.recordVersion = inc(c.recordVersion);
          c.lastRecordedAt = recorded;
          p.dropped++;
          continue;
        }
        if (existingEvidence === undefined) {
          p.evidence.set(o.evidenceDigest, evidenceBody);
          if (c.distinctEvidenceCount > 0) c.newEvidence = true;
          c.distinctEvidenceCount = p.evidence.size;
          c.recordVersion = inc(c.recordVersion);
        }
        const context = {
          resource: o.resource,
          round: o.round,
          sessionType: o.sessionType,
        };
        if (!c.contexts.some((v) => text(v) === text(context))) {
          if (c.contexts.length < identityLimits.contexts)
            c.contexts.push(context);
          else c.overflowed = true;
        }
        c.urgent ||= [
          'race-results',
          'driver-standings',
          'constructor-standings',
        ].includes(o.endpointKind);
        c.firstSeenAt =
          c.firstSeenAt < o.observedAt ? c.firstSeenAt : o.observedAt;
        c.lastSeenAt =
          c.lastSeenAt > o.observedAt ? c.lastSeenAt : o.observedAt;
        c.lastRecordedAt = recorded;
        c.observationCount = inc(c.observationCount);
        p.observations.push(o);
      }
      for (const p of pending.values()) {
        // SQL mutation versions serialize sightings; review versions change only
        // for material evidence/lifecycle, never merely for a repeated sighting.
        p.candidate.evidenceHead = await hashIdentityProjection({
          digests: [...p.evidence.keys()].sort(),
          overflowed: p.candidate.overflowed,
          conflict: p.candidate.conflict,
        });
      }
      try {
        return this.storage.transactionSync(() => {
          if (
            this.rows('SELECT id FROM identity_receipts WHERE id=?', receipt)
              .length
          )
            throw new IdentityError('conflict');
          for (const [id, p] of pending) {
            const row = this.rows(
              'SELECT version FROM identity_candidates WHERE id=?',
              id,
            )[0];
            if ((row ? Number(row.version) : null) !== p.version)
              throw new IdentityError('conflict');
          }
          const result: ObserveResult = {
            persisted: 0,
            replayed: 0,
            created: 0,
            dropped: 0,
          };
          for (const [id, p] of pending) {
            const c = p.candidate;
            if (p.version === null) {
              const count = Number(
                this.rows('SELECT COUNT(*) n FROM identity_candidates')[0]!.n,
              );
              const scoped = Number(
                this.rows(
                  'SELECT COUNT(*) n FROM identity_candidates WHERE season=? AND source=?',
                  c.key.season,
                  c.key.source,
                )[0]!.n,
              );
              if (
                count >= identityLimits.candidates ||
                scoped >= identityLimits.candidatesPerScope
              )
                throw new IdentityError('capacity');
              result.created++;
            }
            this.writeCandidate(c);
            if (p.version === null) {
              const n: Notification = {
                candidateId: c.candidateId,
                generation: 1,
                acknowledgedBy: null,
                acknowledgedCredentialId: null,
                acknowledgedAt: null,
              };
              const body = text(n);
              this.rows(
                'INSERT INTO identity_notifications VALUES(?,?,?,?)',
                id,
                1,
                body,
                rowBytes(body, id, 1),
              );
            }
            for (const [digest, body] of p.evidence)
              this.rows(
                'INSERT OR IGNORE INTO identity_evidence(id,candidate,body,bytes) VALUES(?,?,?,?)',
                digest,
                id,
                body,
                rowBytes(body, digest, id, 0),
              );
            for (const o of p.observations) {
              const body = text({ ...o, recordedAt: recorded });
              this.rows(
                'INSERT INTO identity_observations(id,candidate,recorded,body,bytes) VALUES(?,?,?,?,?)',
                o.observationId,
                id,
                Date.parse(recorded),
                body,
                rowBytes(body, o.observationId, id, Date.parse(recorded), 0),
              );
              result.persisted++;
            }
            const count = Number(
              this.rows(
                'SELECT COUNT(*) n FROM identity_observations WHERE candidate=?',
                id,
              )[0]!.n,
            );
            if (count > identityLimits.occurrences)
              this.rows(
                'DELETE FROM identity_observations WHERE id IN (SELECT id FROM identity_observations WHERE candidate=? AND protected=0 ORDER BY recorded,id LIMIT ?)',
                id,
                count - identityLimits.occurrences,
              );
            result.replayed += p.replayed;
            result.dropped += p.dropped;
          }
          const body = text(result);
          this.rows(
            'INSERT INTO identity_receipts VALUES(?,?,?,?)',
            receipt,
            Date.parse(recorded),
            body,
            rowBytes(body, receipt, Date.parse(recorded)),
          );
          if (this.logicalBytes() > identityLimits.logicalBytes)
            throw new IdentityError('capacity');
          this.rows(
            'UPDATE identity_meta SET persisted=MIN(9007199254740991,persisted+?),replayed=MIN(9007199254740991,replayed+?),dropped=MIN(9007199254740991,dropped+?) WHERE id=1',
            result.persisted,
            result.replayed,
            result.dropped,
          );
          return result;
        });
      } catch (error) {
        if (
          error instanceof IdentityError &&
          error.code === 'conflict' &&
          retry < 2
        )
          continue;
        throw error;
      }
    }
    throw new IdentityError('conflict');
  }
  list(input: unknown): ListResult {
    const r = safeCopy(input);
    requireValid(
      exact(r, ['cursor', 'limit', 'unread']) &&
        (r.cursor === null || isHash(r.cursor)) &&
        integer(r.limit, 1, 100) &&
        typeof r.unread === 'boolean',
    );
    const rows = this.rows(
      "SELECT body FROM identity_candidates WHERE id>? AND (?=0 OR json_extract(body,'$.acknowledgedNotificationGeneration')<json_extract(body,'$.notificationGeneration')) ORDER BY id LIMIT ?",
      r.cursor ?? '',
      r.unread ? 1 : 0,
      r.limit + 1,
    );
    const items: CandidateSummary[] = rows.slice(0, r.limit).map((row) => {
      const c = JSON.parse(row.body as string) as Candidate;
      return {
        candidateId: c.candidateId,
        key: c.key,
        state: c.state,
        recordVersion: c.recordVersion,
        lastSeenAt: c.lastSeenAt,
        observationCount: c.observationCount,
        distinctEvidenceCount: c.distinctEvidenceCount,
        overflowed: c.overflowed,
        conflict: c.conflict,
        newEvidence: c.newEvidence,
        urgent: c.urgent,
        notificationGeneration: c.notificationGeneration,
        acknowledgedNotificationGeneration:
          c.acknowledgedNotificationGeneration,
      };
    });
    return {
      items,
      cursor: rows.length > r.limit ? items.at(-1)!.candidateId : null,
    };
  }
  inspect(input: unknown): InspectResult {
    const r = safeCopy(input);
    requireValid(
      exact(r, ['candidateId', 'section', 'cursor', 'limit']) &&
        isHash(r.candidateId) &&
        ['candidate', 'evidence', 'observations'].includes(
          r.section as string,
        ) &&
        (r.cursor === null || isHash(r.cursor)) &&
        integer(r.limit, 1, 16),
    );
    const candidate = this.candidate(r.candidateId);
    if (!candidate) throw new IdentityError('not-found');
    const notification = JSON.parse(
      this.rows(
        'SELECT body FROM identity_notifications WHERE candidate=? AND generation=?',
        r.candidateId,
        candidate.notificationGeneration,
      )[0]!.body as string,
    ) as Notification;
    const rows =
      r.section === 'candidate'
        ? []
        : this.rows(
            'SELECT id,body FROM identity_' +
              (r.section === 'evidence' ? 'evidence' : 'observations') +
              ' WHERE candidate=? AND id>? ORDER BY id LIMIT ?',
            r.candidateId,
            r.cursor ?? '',
            r.limit + 1,
          );
    return {
      candidate,
      notification,
      items: rows
        .slice(0, r.limit)
        .map((row) => JSON.parse(row.body as string)),
      cursor:
        rows.length > r.limit ? (rows[r.limit - 1]!.id as IdentityHash) : null,
    };
  }
  acknowledge(
    input: unknown,
    principal: ReaderPrincipal,
  ): { acknowledgedGeneration: number } {
    const r = safeCopy(input),
      actor = safeCopy(principal);
    requireValid(
      exact(r, ['candidateId', 'notificationGeneration']) &&
        isHash(r.candidateId) &&
        integer(r.notificationGeneration, 1),
    );
    requireValid(
      exact(actor, ['principalId', 'credentialId', 'role']) &&
        actor.role === 'reader',
    );
    requireValid(
      [actor.principalId, actor.credentialId].every(
        (v) => typeof v === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(v),
      ),
    );
    return this.storage.transactionSync(() => {
      const c = this.candidate(r.candidateId as string);
      if (!c) throw new IdentityError('not-found');
      if (c.notificationGeneration !== r.notificationGeneration)
        throw new IdentityError('conflict');
      if (c.acknowledgedNotificationGeneration === r.notificationGeneration)
        return { acknowledgedGeneration: r.notificationGeneration as number };
      const n: Notification = {
        candidateId: c.candidateId,
        generation: c.notificationGeneration,
        acknowledgedBy: actor.principalId as string,
        acknowledgedCredentialId: actor.credentialId as string,
        acknowledgedAt: canonicalInstant(new Date(this.now()).toISOString())!,
      };
      const body = text(n);
      this.rows(
        'UPDATE identity_notifications SET body=?,bytes=? WHERE candidate=? AND generation=?',
        body,
        rowBytes(body, c.candidateId, c.notificationGeneration),
        c.candidateId,
        c.notificationGeneration,
      );
      c.acknowledgedNotificationGeneration = c.notificationGeneration;
      c.recordVersion = inc(c.recordVersion);
      this.writeCandidate(c);
      if (this.logicalBytes() > identityLimits.logicalBytes)
        throw new IdentityError('capacity');
      return { acknowledgedGeneration: c.notificationGeneration };
    });
  }
  /** Small restartable retention transaction; no history-protected row is deleted. */
  maintain(): { processed: number; cursor: string; more: boolean } {
    return this.storage.transactionSync(() => {
      const meta = this.rows(
        'SELECT maintenance_cursor FROM identity_meta WHERE id=1',
      )[0]!;
      const rows = this.rows(
        'SELECT id,body FROM identity_candidates WHERE id>? ORDER BY id LIMIT 50',
        meta.maintenance_cursor as string,
      );
      const cutoff = this.now() - 90 * day,
        inactive = this.now() - 365 * day;
      for (const r of rows) {
        this.rows(
          'DELETE FROM identity_observations WHERE candidate=? AND protected=0 AND recorded<?',
          r.id as string,
          cutoff,
        );
        const c = JSON.parse(r.body as string) as Candidate;
        if (
          ['unresolved', 'rejected', 'quarantined'].includes(c.state) &&
          Date.parse(c.lastRecordedAt) < inactive
        ) {
          c.archivedState = c.state;
          c.state = 'archived';
          c.recordVersion = inc(c.recordVersion);
          this.writeCandidate(c);
        }
      }
      this.rows(
        'DELETE FROM identity_receipts WHERE id IN (SELECT id FROM identity_receipts WHERE recorded<? ORDER BY recorded LIMIT 100)',
        cutoff,
      );
      const cursor = rows.length === 50 ? (rows.at(-1)!.id as string) : '';
      this.rows(
        'UPDATE identity_meta SET maintenance_cursor=? WHERE id=1',
        cursor,
      );
      const expiredReceipts =
        this.rows(
          'SELECT id FROM identity_receipts WHERE recorded<? LIMIT 1',
          cutoff,
        ).length > 0;
      return {
        processed: rows.length,
        cursor,
        more: cursor !== '' || expiredReceipts,
      };
    });
  }
  health(): HealthResult {
    const count = (table: string) =>
      Number(this.rows('SELECT COUNT(*) n FROM identity_' + table)[0]!.n);
    const meta = this.rows('SELECT * FROM identity_meta WHERE id=1')[0]!;
    const logicalBytes = this.logicalBytes(),
      candidates = count('candidates');
    const scope = Number(
      this.rows(
        'SELECT COALESCE(MAX(n),0) n FROM (SELECT COUNT(*) n FROM identity_candidates GROUP BY season,source)',
      )[0]!.n,
    );
    const capacityRatio = Math.max(
      candidates / identityLimits.candidates,
      scope / identityLimits.candidatesPerScope,
      logicalBytes / identityLimits.logicalBytes,
    );
    const stateCount = (s: string) =>
      Number(
        this.rows(
          "SELECT COUNT(*) n FROM identity_candidates WHERE json_extract(body,'$.state')=?",
          s,
        )[0]!.n,
      );
    return {
      schemaVersion: 1,
      installationId: this.installation,
      candidates,
      observations: count('observations'),
      evidence: count('evidence'),
      unread: Number(
        this.rows(
          "SELECT COUNT(*) n FROM identity_candidates WHERE json_extract(body,'$.notificationGeneration')>json_extract(body,'$.acknowledgedNotificationGeneration')",
        )[0]!.n,
      ),
      unresolved: stateCount('unresolved'),
      quarantined: stateCount('quarantined'),
      oldestUnresolvedAt: this.rows(
        "SELECT MIN(json_extract(body,'$.firstSeenAt')) n FROM identity_candidates WHERE json_extract(body,'$.state')='unresolved'",
      )[0]!.n as string | null,
      logicalBytes,
      capacityRatio,
      warning: capacityRatio >= 0.8,
      maintenanceCursor: meta.maintenance_cursor as string,
      persisted: Number(meta.persisted),
      replayed: Number(meta.replayed),
      dropped: Number(meta.dropped),
    };
  }
}
