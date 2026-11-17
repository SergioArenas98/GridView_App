/** U5 typed transport adapter. All proposals, certificates and activation still
 * pass through CatalogWorkflow; HTTP recovery commits in that same transaction. */
import { canonicalJson, utf8 } from '../../ingest/canonical-json';
import { hashIdentityProjection } from '../discovery/keys';
import type { IdentityHash } from '../discovery/model';
import { IdentityStore } from '../store';
import type { Candidate } from '../port';
import type { IdentityStorage } from '../schema';
import { CatalogWorkflow } from './workflow';
import type { CatalogOriginProof } from './origin-proof';
import type {
  CatalogAuthority,
  CatalogPrincipal,
  DossierInput,
  ReviewEvidence,
  ReviewRequest,
  ReviewDecision,
} from './review';
import { validateSeed } from './validate';
import { requireCatalog } from './model';
import { applyReviewedBase, type BaseImportDecision } from './base-import';
import { reserveDatasetVersions } from './dataset-version';
import { canonicalKey } from '../discovery/keys';
import type { CatalogRevision } from './revision';
import {
  AdminError,
  ordinaryLimit,
  artifactLimit,
} from '../../admin/identity/responses';
import type { Mutation } from '../../admin/identity/guards.mjs';

export interface AdminReceipt {
  requestHash: IdentityHash;
  status: number;
  data: unknown;
  auditEventSequence: number;
}
export interface AdminCommit {
  request: Mutation;
  family: string;
  operation: string;
  path: string;
  hash: IdentityHash;
  decorate: (result: unknown) => {
    data: Record<string, unknown>;
    status: number;
  };
  effect?: (result: unknown) => void;
  prepare?: (result: unknown) => Promise<void>;
  committedHere?: boolean;
}
export class IdentityAdminWorkflow extends CatalogWorkflow {
  context: AdminCommit | null = null;
  private commitTime = '';
  private pendingCorrection: ReviewDecision | null = null;
  private auditKind: string | null = null;
  private proposalSubject: string | null = null;
  constructor(
    storage: IdentityStorage,
    installation: string,
    authority: CatalogAuthority,
    now: () => number = Date.now,
    originProof?: CatalogOriginProof,
  ) {
    super(storage, installation, authority, now, originProof);
    storage.transactionSync(() => {
      this.rows(
        'CREATE TABLE IF NOT EXISTS identity_admin_receipts (principal TEXT NOT NULL,family TEXT NOT NULL,id TEXT NOT NULL,hash TEXT NOT NULL,path TEXT NOT NULL,body TEXT NOT NULL,PRIMARY KEY(principal,family,id))',
      );
      this.rows(
        'CREATE TABLE IF NOT EXISTS identity_admin_rates (credential TEXT NOT NULL,window INTEGER NOT NULL,reads INTEGER NOT NULL,writes INTEGER NOT NULL,PRIMARY KEY(credential,window))',
      );
      this.rows(
        'CREATE TABLE IF NOT EXISTS identity_admin_navigation (sequence INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT NOT NULL,id TEXT NOT NULL,UNIQUE(kind,id))',
      );
      this.rows(
        'CREATE TABLE IF NOT EXISTS identity_admin_imports (revision TEXT PRIMARY KEY REFERENCES identity_catalog_revisions(id),body TEXT NOT NULL)',
      );
    });
  }
  discoveryHealth() {
    return new IdentityStore(
      this.storage,
      this.installation,
      this.now,
    ).health();
  }
  protected override audit(
    p: CatalogPrincipal,
    family: string,
    operationId: string,
    before: unknown,
    after: unknown,
    time: string,
  ): void {
    super.audit(p, family, operationId, before, after, time);
    const row = this.rows(
      'SELECT sequence,body FROM identity_catalog_audit ORDER BY sequence DESC LIMIT 1',
    )[0]!;
    const context = this.context;
    const payload = context?.request.payload;
    const ref = payload?.candidate as { candidateId?: string } | undefined;
    const parts = context?.path.split('/') ?? [];
    const candidateId =
      ref?.candidateId ?? (parts[4] === 'candidates' ? parts[5] : null);
    const revisionId =
      parts[4] === 'revisions' ? parts[5] : this.proposalSubject;
    const eventNames: Record<string, string> = {
      'approve-existing': 'identity.review.approved',
      'approve-new': 'identity.review.approved',
      'approve-profile': 'identity.review.approved',
      validate: 'identity.catalog.validated',
      activate: 'identity.catalog.activated',
      seed: 'identity.catalog.seeded',
      abandon: 'identity.catalog.abandoned',
      admission: 'identity.catalog.admission_changed',
      correction: 'identity.correction.reported',
    };
    const eventType =
      family === 'identity.request.rejected'
        ? family
        : (this.auditKind ??
          eventNames[context?.operation ?? family] ??
          (family.startsWith('identity.') ? family : 'identity.' + family));
    const event = {
      ...JSON.parse(String(row.body)),
      eventType,
      subject: { candidateId, revisionId },
      reason: context?.request.reason ?? null,
      requestHash: context?.hash ?? null,
    };
    const decision = this.rows(
      "SELECT body FROM identity_catalog_decisions WHERE json_extract(body,'$.operationId')=? AND json_extract(body,'$.principalId')=? LIMIT 1",
      operationId,
      p.principalId,
    )[0];
    if (
      utf8(
        canonicalJson({
          ...event,
          decision: decision ? JSON.parse(String(decision.body)) : null,
        }),
      ).length >
      ordinaryLimit - 2048
    )
      throw new AdminError(503, 'CATALOG_CAPACITY');
    this.rows(
      'UPDATE identity_catalog_audit SET body=? WHERE sequence=?',
      canonicalJson(event),
      Number(row.sequence),
    );
  }
  async auditExport(
    p: CatalogPrincipal,
    revisionId: string,
    exportHash: IdentityHash,
  ): Promise<void> {
    const time = this.time();
    this.storage.transactionSync(() => {
      this.audit(
        p,
        'identity.catalog.exported',
        crypto.randomUUID(),
        null,
        { revisionId, exportHash },
        time,
      );
      this.checkCapacity();
    });
  }
  query(sql: string, ...args: (string | number | null)[]) {
    return this.rows(sql, ...args);
  }
  indexNavigation(sql: string, ...args: (string | number | null)[]): void {
    this.storage.transactionSync(() => {
      this.rows(sql, ...args);
      this.checkCapacity();
    });
  }
  receiptFor(
    principal: string,
    family: string,
    id: string,
  ): AdminReceipt | null {
    const row = this.rows(
      'SELECT body FROM identity_admin_receipts WHERE principal=? AND family=? AND id=?',
      principal,
      family,
      id,
    )[0];
    return row ? (JSON.parse(String(row.body)) as AdminReceipt) : null;
  }
  rate(principal: CatalogPrincipal, write: boolean): void {
    const window = Math.floor(this.now() / 60000);
    this.storage.transactionSync(() => {
      this.rows('DELETE FROM identity_admin_rates WHERE window<?', window - 1);
      for (const [id, readLimit, writeLimit] of [
        [principal.credentialId, 60, 10],
        ['*installation', 300, 60],
      ] as const) {
        const row = this.rows(
          'SELECT reads,writes FROM identity_admin_rates WHERE credential=? AND window=?',
          id,
          window,
        )[0];
        if (
          Number(row?.[write ? 'writes' : 'reads'] ?? 0) >=
          (write ? writeLimit : readLimit)
        )
          throw new AdminError(
            429,
            'ADMIN_RATE_LIMITED',
            Math.max(1, 60 - (Math.floor(this.now() / 1000) % 60)),
          );
      }
      for (const id of [principal.credentialId, '*installation'])
        this.rows(
          'INSERT INTO identity_admin_rates VALUES(?,?,?,?) ON CONFLICT(credential,window) DO UPDATE SET reads=reads+excluded.reads,writes=writes+excluded.writes',
          id,
          window,
          write ? 0 : 1,
          write ? 1 : 0,
        );
      // Credential rotation cannot grow counters without bound within a window.
      if (
        Number(this.rows('SELECT COUNT(*) n FROM identity_admin_rates')[0]!.n) >
        202
      )
        throw new AdminError(429, 'ADMIN_RATE_LIMITED', 60);
    });
  }
  private saveHttpReceipt(
    p: CatalogPrincipal,
    context: AdminCommit,
    data: unknown,
    status: number,
    sequence: number,
  ): void {
    const receipt: AdminReceipt = {
      requestHash: context.hash,
      status,
      data,
      auditEventSequence: sequence,
    };
    if (utf8(canonicalJson(receipt)).length > artifactLimit)
      throw new AdminError(503, 'RESPONSE_TOO_LARGE');
    this.rows(
      'INSERT INTO identity_admin_receipts VALUES(?,?,?,?,?,?)',
      p.principalId,
      context.family,
      context.request.operationId,
      context.hash,
      context.path,
      canonicalJson(receipt),
    );
  }
  protected override async commit<T>(
    p: CatalogPrincipal,
    family: string,
    id: string,
    request: unknown,
    result: T,
    responseHash: IdentityHash,
    change: () => void,
    time: string,
  ): Promise<T> {
    const context = this.context;
    this.commitTime = time;
    const value = result as {
      valid?: boolean;
      outcome?: string;
      revisionId?: string;
      revision?: CatalogRevision | null;
    };
    this.proposalSubject =
      value.revision?.revisionId ?? value.revisionId ?? null;
    this.auditKind =
      context?.family === 'validate'
        ? value.valid
          ? 'identity.catalog.validated'
          : 'identity.catalog.validation_failed'
        : context?.family === 'activate'
          ? value.outcome === 'activated'
            ? 'identity.catalog.activated'
            : 'identity.catalog.activation_conflict'
          : context?.family === 'disposition'
            ? 'identity.review.' +
              (
                {
                  reject: 'rejected',
                  quarantine: 'quarantined',
                  reopen: 'reopened',
                } as Record<string, string>
              )[String(context.request.payload.action)]
            : context?.family === 'import-base'
              ? 'identity.catalog.proposed'
              : null;
    await context?.prepare?.(result);
    return super.commit(
      p,
      family,
      id,
      request,
      result,
      responseHash,
      () => {
        if (context && this.receiptFor(p.principalId, context.family, id))
          throw new AdminError(409, 'IDEMPOTENCY_CONFLICT');
        if (
          context?.operation === 'approve-new' &&
          this.rows(
            'SELECT id FROM identity_catalog_anchors WHERE id=?',
            String(context.request.payload.driverId),
          ).length
        )
          throw new AdminError(409, 'CANONICAL_ID_RESERVED');
        change();
        if (context) {
          context.effect?.(result);
          const sequence =
            Number(
              this.rows(
                'SELECT COALESCE(MAX(sequence),0) n FROM identity_catalog_audit',
              )[0]!.n,
            ) + 1;
          const response = context.decorate(result);
          const data = {
            schemaVersion: 1,
            installationId: this.installation,
            ...response.data,
            operationId: id,
            auditEventSequence: sequence,
          };
          if (
            utf8(
              canonicalJson({
                data,
                requestId: '0'.repeat(128),
                replayed: false,
              }),
            ).length > ordinaryLimit
          )
            throw new AdminError(503, 'RESPONSE_TOO_LARGE');
          this.saveHttpReceipt(p, context, data, response.status, sequence);
          context.committedHere = true;
        }
      },
      time,
    );
  }
  activationTime(): string {
    return this.commitTime;
  }
  async prepareImportDossier(
    dossier: DossierInput,
    input: unknown,
    p: CatalogPrincipal,
  ): Promise<ReviewEvidence> {
    const seed = await validateSeed(input);
    const closure: ReviewEvidence['closure'] = [];
    for (const ref of dossier.references) {
      if (ref.kind === 'observation')
        throw new AdminError(422, 'EVIDENCE_INSUFFICIENT');
      if (ref.kind === 'citation')
        closure.push({ reference: ref, body: { citationOnly: true } });
      else {
        const source = seed.sources.find(
          (s) => s.path === ref.path && s.fileHash === ref.fileSha256,
        );
        if (!source) throw new AdminError(422, 'EVIDENCE_INSUFFICIENT');
        let value: unknown = JSON.parse(source.text);
        for (const part of ref.recordPointer.slice(1).split('/')) {
          if (
            value === null ||
            typeof value !== 'object' ||
            !Object.hasOwn(value, part)
          )
            throw new AdminError(422, 'EVIDENCE_INSUFFICIENT');
          value = (value as Record<string, unknown>)[part];
        }
        closure.push({
          reference: ref,
          body: { fileHash: source.fileHash, value },
        });
      }
    }
    const content = {
      ...dossier,
      kind: 'review-dossier' as const,
      createdAt: this.time(),
      createdBy: p,
      projectionDigest: await hashIdentityProjection(dossier),
      closure,
    };
    return { ...content, evidenceId: await hashIdentityProjection(content) };
  }
  attachImportDossier(evidence: ReviewEvidence, revisionId: string): void {
    this.rows(
      'INSERT INTO identity_catalog_dossiers VALUES(?,?)',
      evidence.evidenceId,
      canonicalJson(evidence),
    );
    this.rows(
      'INSERT INTO identity_admin_imports VALUES(?,?)',
      revisionId,
      canonicalJson({ revisionId, evidenceId: evidence.evidenceId }),
    );
  }
  protected override correctionDecision(id: string): ReviewDecision {
    return this.pendingCorrection?.decisionId === id
      ? this.pendingCorrection
      : super.correctionDecision(id);
  }
  async reportCandidateCorrection(
    request: Mutation,
    review: ReviewRequest,
    p: CatalogPrincipal,
    cap: unknown,
  ): Promise<void> {
    this.assertHead(request);
    this.checkCandidate(review);
    const decision: ReviewDecision = {
      ...review,
      decisionId: crypto.randomUUID(),
      baseRevisionId: review.expectedActiveRevisionId,
      principalId: p.principalId,
      credentialId: p.credentialId,
      authMethod: p.authMethod,
      decidedAt: this.time(),
      profileHash: null,
    };
    this.pendingCorrection = decision;
    this.context!.effect = () => {
      this.assertHead(request);
      const c = this.checkCandidate(review)!;
      this.rows(
        'INSERT INTO identity_catalog_decisions VALUES(?,?)',
        decision.decisionId,
        canonicalJson(decision),
      );
      c.latestDecisionId = decision.decisionId;
      this.saveCandidate(c, review.expectedCandidateVersion!);
    };
    const claims = Object.fromEntries(
      Object.entries(request.payload).filter(([key]) => key !== 'candidate'),
    );
    try {
      await this.reportCorrection(
        {
          schemaVersion: 1,
          operationId: request.operationId,
          decisionId: decision.decisionId,
          ...claims,
          rationale: request.reason,
        } as Parameters<CatalogWorkflow['reportCorrection']>[0],
        cap,
      );
    } finally {
      this.pendingCorrection = null;
    }
  }
  async proposeBaseImport(
    request: Mutation,
    input: unknown,
    artifactHash: IdentityHash,
    evidenceIds: IdentityHash[],
    cap: unknown,
  ): Promise<CatalogRevision> {
    const p = this.actor(cap, 'activator');
    this.assertHead(request);
    const parent = await this.readRevision(request.expectedActiveRevisionId!);
    const support = await this.evidence(evidenceIds),
      artifact = await validateSeed(input),
      time = this.time();
    const decision: BaseImportDecision = {
      decisionId: crypto.randomUUID(),
      action: 'import-base',
      operationId: request.operationId,
      baseRevisionId: parent.revisionId,
      principalId: p.principalId,
      credentialId: p.credentialId,
      authMethod: p.authMethod,
      decidedAt: time,
      artifactSources: artifact.sources,
      artifactHash,
      evidenceIds,
      rationale: request.reason,
      candidateId: null,
      expectedCandidateVersion: null,
      evidenceHead: await hashIdentityProjection(support),
    };
    const snapshot = await applyReviewedBase(
        parent.snapshot,
        decision,
        support,
      ),
      revisionId = crypto.randomUUID();
    const before = canonicalJson(
      this.rows('SELECT * FROM identity_catalog_labels ORDER BY season,label'),
    );
    const planning: IdentityStorage = {
      sql: {
        exec: (q, ...args) =>
          q.startsWith('INSERT')
            ? { toArray: () => [] }
            : this.storage.sql.exec(q, ...args),
      },
      transactionSync: (run) => run(),
    };
    reserveDatasetVersions(
      planning,
      snapshot,
      parent.snapshot,
      revisionId,
      time,
    );
    const revision: CatalogRevision = {
      revisionId,
      sequence: parent.sequence + 1,
      parentRevisionId: parent.revisionId,
      parentContentHash: parent.contentHash,
      catalogSchemaVersion: 1,
      contentHash: await hashIdentityProjection(snapshot),
      createdAt: time,
      createdByPrincipal: p.principalId,
      decisionIds: [decision.decisionId],
      baseContentDigest: snapshot.seasonContent[0]!.baseContentDigest,
      snapshotByteLength: utf8(canonicalJson(snapshot)).length,
      snapshot,
      candidateHeads: [],
    };
    this.checkExportCapacity(revision);
    return this.commit(
      p,
      'import-base',
      request.operationId,
      request,
      revision,
      await hashIdentityProjection(revision),
      () => {
        this.assertHead(request);
        requireCatalog(
          before ===
            canonicalJson(
              this.rows(
                'SELECT * FROM identity_catalog_labels ORDER BY season,label',
              ),
            ),
          'dataset-reservation-conflict',
        );
        this.rows(
          'INSERT INTO identity_catalog_decisions VALUES(?,?)',
          decision.decisionId,
          canonicalJson(decision),
        );
        this.insertRevision(revision);
        const actual = structuredClone(snapshot);
        reserveDatasetVersions(
          this.storage,
          actual,
          parent.snapshot,
          revisionId,
          time,
        );
        requireCatalog(
          canonicalJson(actual) === canonicalJson(snapshot),
          'dataset-reservation-conflict',
        );
        const old = new Set(
          parent.snapshot.bindings.map((b) => canonicalKey(b.key)),
        );
        for (const b of snapshot.bindings)
          if (!old.has(canonicalKey(b.key))) {
            requireCatalog(
              !this.rows(
                'SELECT target FROM identity_catalog_keys WHERE exact_key=?',
                canonicalKey(b.key),
              ).length,
              'binding-reservation-conflict',
            );
            this.rows(
              'INSERT INTO identity_catalog_keys VALUES(?,?,?,0)',
              canonicalKey(b.key),
              b.targetId,
              revisionId,
            );
          }
        this.insertIndexes(revision);
        this.protect(support);
      },
      time,
    );
  }
  /** Bounded deterministic rejections also have a durable recovery record.
   * Authentication, parsing and availability failures never enter this ledger. */
  async reject(
    p: CatalogPrincipal,
    context: AdminCommit,
    error: AdminError,
  ): Promise<void> {
    if (
      ![400, 403, 404, 409, 422].includes(error.status) ||
      error.code === 'IDEMPOTENCY_CONFLICT'
    )
      return;
    const responseHash = await hashIdentityProjection({ code: error.code });
    this.storage.transactionSync(() => {
      if (
        this.receiptFor(
          p.principalId,
          context.family,
          context.request.operationId,
        )
      )
        return;
      this.audit(
        p,
        'identity.request.rejected',
        context.request.operationId,
        this.head(),
        { code: error.code, responseHash },
        this.time(),
      );
      const seq = Number(
        this.rows('SELECT MAX(sequence) n FROM identity_catalog_audit')[0]!.n,
      );
      this.saveHttpReceipt(
        p,
        context,
        {
          code: error.code,
          operationId: context.request.operationId,
          auditEventSequence: seq,
        },
        error.status,
        seq,
      );
      this.checkCapacity();
    });
  }
  candidateFor(id: IdentityHash): Candidate {
    return this.candidate(id);
  }
  assertCandidate(
    id: IdentityHash,
    version: number,
    head: IdentityHash,
  ): Candidate {
    const c = this.candidate(id);
    if (c.recordVersion !== version)
      throw new AdminError(409, 'CANDIDATE_STALE');
    if (c.evidenceHead !== head) throw new AdminError(409, 'EVIDENCE_CHANGED');
    return c;
  }
  assertHead(request: Mutation): void {
    this.expectHead(
      request.expectedActiveRevisionId,
      request.expectedActivationSequence,
    );
  }
  async checkedSupport(ids: IdentityHash[]) {
    return this.evidence(ids);
  }
  attachDossier(
    id: IdentityHash,
    version: number,
    head: IdentityHash,
    evidenceId: IdentityHash,
    nextHead: IdentityHash,
  ): void {
    const c = this.assertCandidate(id, version, head);
    if (c.state === 'resolved' || this.activeBinding(c))
      throw new AdminError(409, 'REVISION_ALREADY_ACTIVATED');
    // This is an explicit operator evidence write, never an automatic reopen.
    c.evidenceHead = nextHead;
    c.newEvidence = true;
    this.saveCandidate(c, version);
    this.rows(
      'INSERT INTO identity_admin_navigation(kind,id) VALUES(?,?) ON CONFLICT(kind,id) DO NOTHING',
      'dossier:' + id,
      evidenceId,
    );
  }
  async simple(
    request: Mutation,
    p: CatalogPrincipal,
    family: string,
    change: () => Record<string, unknown>,
  ): Promise<void> {
    // The extra effect runs inside the established U4 commit transaction.
    let data: Record<string, unknown> = {};
    const context = this.context!;
    const decorate = context.decorate;
    context.decorate = () => ({ data, status: 200 });
    try {
      await this.commit(
        p,
        family,
        request.operationId,
        request,
        {},
        await hashIdentityProjection(request),
        () => {
          this.assertHead(request);
          data = change();
        },
        this.time(),
      );
    } finally {
      context.decorate = decorate;
    }
  }
  acknowledge(
    id: IdentityHash,
    generation: number,
    p: CatalogPrincipal,
  ): Record<string, unknown> {
    const c = this.candidate(id);
    if (c.notificationGeneration !== generation)
      throw new AdminError(409, 'CANDIDATE_STALE');
    // Reuse U2's typed acknowledgement in this enclosing SQLite transaction.
    new IdentityStore(
      { sql: this.storage.sql, transactionSync: (run) => run() },
      this.installation,
      this.now,
    ).acknowledge(
      { candidateId: id, notificationGeneration: generation },
      {
        principalId: p.principalId,
        credentialId: p.credentialId,
        role: 'reader',
      },
    );
    return { acknowledgedGeneration: generation };
  }
  admission(
    expected: string,
    state: 'open' | 'paused',
  ): Record<string, unknown> {
    const head = this.head();
    if (head.admissionState !== expected)
      throw new AdminError(409, 'CATALOG_HEAD_CONFLICT');
    this.rows(
      'UPDATE identity_catalog_head SET body=? WHERE id=1',
      canonicalJson({ ...head, admissionState: state }),
    );
    return { admissionState: state };
  }
  certificates(id: string) {
    return (
      this.rows(
        'SELECT body FROM identity_catalog_certificates WHERE revision=? ORDER BY rowid DESC LIMIT 1',
        id,
      ).map((r) => JSON.parse(String(r.body)) as Record<string, unknown>)[0] ??
      null
    );
  }
  decisionSummaries(id: IdentityHash) {
    return this.rows(
      "SELECT json_object('decisionId',id,'action',json_extract(body,'$.action'),'principalId',json_extract(body,'$.principalId'),'decidedAt',json_extract(body,'$.decidedAt')) body FROM identity_catalog_decisions WHERE json_extract(body,'$.candidateId')=? ORDER BY rowid DESC LIMIT 100",
      id,
    ).map((r) => JSON.parse(String(r.body)) as Record<string, unknown>);
  }
  dossier(id: IdentityHash): unknown {
    return this.body('dossiers', id);
  }
  async abandonAuthorized(
    request: Parameters<CatalogWorkflow['abandon']>[0],
    p: CatalogPrincipal,
    cap: unknown,
  ) {
    const r = await this.readRevision(request.revisionId);
    if (
      !p.roles.includes('activator') &&
      r.createdByPrincipal !== p.principalId
    )
      throw new AdminError(403, 'ROLE_REQUIRED');
    // U4 requires reviewer; an activator may abandon without assuming reviewer
    // authority for any other workflow operation.
    return this.abandon(request, cap);
  }
  async revisionInfo(id: string) {
    const revision = await this.readRevision(id);
    const parent = revision.parentRevisionId
      ? this.rawRevision(revision.parentRevisionId)
      : null;
    return {
      revision,
      validation: this.certificates(id),
      activationEvents: this.rows(
        "SELECT body FROM identity_catalog_audit WHERE json_extract(body,'$.family')='activate' AND json_extract(body,'$.after.head.activeRevisionId')=? ORDER BY sequence LIMIT 100",
        id,
      ).map((r) => JSON.parse(String(r.body)) as unknown),
      deltaFromParent: revisionDelta(revision, parent),
    };
  }
}
export function revisionDelta(
  revision: CatalogRevision,
  parent: CatalogRevision | null,
) {
  const oldBindings = new Set(
    parent?.snapshot.bindings.map((b) => b.bindingId) ?? [],
  );
  const profiles = new Map(
    parent?.snapshot.drivers.map((d) => [d.anchor.driverId, d.profileHash]) ??
      [],
  );
  return {
    bindingsAdded: revision.snapshot.bindings.filter(
      (b) => !oldBindings.has(b.bindingId),
    ),
    profilesChanged: revision.snapshot.drivers
      .filter((d) => profiles.get(d.anchor.driverId) !== d.profileHash)
      .map((d) => ({
        driverId: d.anchor.driverId,
        profile: d.profile,
        profileHash: d.profileHash,
      })),
    seasons: revision.snapshot.seasonContent.map((s) => ({
      season: s.season,
      previousDatasetVersion:
        parent?.snapshot.seasonContent.find((x) => x.season === s.season)
          ?.datasetVersion ?? null,
      datasetVersion: s.datasetVersion,
      changed:
        parent?.snapshot.seasonContent.find((x) => x.season === s.season)
          ?.seasonProjectionHash !== s.seasonProjectionHash,
    })),
  };
}
