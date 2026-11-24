import { canonicalJson, utf8 } from '../../ingest/canonical-json';
import { canonicalKey } from '../discovery/keys';
import { canonicalInstant } from '../../publication/canonical/instant';
import { hashIdentityProjection } from '../discovery/keys';
import type { IdentityHash } from '../discovery/model';
import { identityLimits, type Candidate } from '../port';
import { integer, isHash } from '../wire-decoders';
import type { IdentityStorage } from '../schema';
import { requireCatalog, type SeedArtifact } from './model';
import { CatalogOriginProof } from './origin-proof';
import { initializeCatalog } from './schema';
import { catalogStorageBytes } from '../storage-accounting';
import { exact, freeze } from './sources';
import {
  textBound,
  uuid,
  type CatalogAuthority,
  type CatalogPrincipal,
  type ReviewRequest,
} from './review';
import {
  decodeRevision,
  type CatalogRevision,
  type CatalogHead,
  type ProposalStatus,
} from './revision';
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const size = (a: unknown) => utf8(canonicalJson(a)).length;

/** Internal U4 storage mechanism; no external administration interface. */
export class CatalogRepository {
  constructor(
    protected readonly storage: IdentityStorage,
    readonly installation: string,
    protected readonly authority?: CatalogAuthority,
    protected readonly now: () => number = Date.now,
    private readonly originProof = new CatalogOriginProof(),
  ) {
    initializeCatalog(storage, installation);
    storage.transactionSync(() => {
      if (!this.rows('SELECT id FROM identity_catalog_head').length)
        this.rows(
          'INSERT INTO identity_catalog_head VALUES(1,?)',
          canonicalJson({
            installationId: installation,
            activeRevisionId: null,
            activationSequence: 0,
            schemaVersion: 1,
            admissionState: 'open',
            seedDigest: null,
            minimumReaderVersion: 1,
            legacyV1AdmissionEnabled: true,
            hasRuntimeOnlyActivation: false,
          } satisfies CatalogHead),
        );
    });
  }
  protected rows(q: string, ...args: (string | number | null)[]) {
    return this.storage.sql.exec(q, ...args).toArray();
  }
  protected time(): string {
    const t = canonicalInstant(new Date(this.now()).toISOString());
    requireCatalog(t, 'catalog-clock');
    return t;
  }
  protected actor(
    cap: unknown,
    role: 'reviewer' | 'activator',
  ): CatalogPrincipal {
    requireCatalog(this.authority, 'catalog-authority-unconfigured');
    const actor = this.authority.verify(cap);
    exact(actor, ['principalId', 'credentialId', 'authMethod', 'roles']);
    textBound(actor.principalId, 200);
    textBound(actor.credentialId, 200);
    requireCatalog(
      ((actor.authMethod === 'test-logical-principal' &&
        this.authority.isolatedLocalTests) ||
        actor.authMethod === 'individual-bearer') &&
        Array.isArray(actor.roles) &&
        actor.roles.every((r) =>
          ['reader', 'reviewer', 'activator'].includes(r),
        ) &&
        actor.roles.includes(role),
      'catalog-authority',
    );
    return structuredClone(actor);
  }
  head(): CatalogHead {
    const h: unknown = JSON.parse(
      String(
        this.rows('SELECT body FROM identity_catalog_head WHERE id=1')[0]?.body,
      ),
    );
    exact(h, [
      'installationId',
      'activeRevisionId',
      'activationSequence',
      'schemaVersion',
      'admissionState',
      'seedDigest',
      'minimumReaderVersion',
      'legacyV1AdmissionEnabled',
      'hasRuntimeOnlyActivation',
    ]);
    requireCatalog(
      h.installationId === this.installation &&
        h.schemaVersion === 1 &&
        h.minimumReaderVersion === 1 &&
        integer(h.activationSequence) &&
        ['open', 'paused'].includes(h.admissionState as string) &&
        typeof h.legacyV1AdmissionEnabled === 'boolean' &&
        typeof h.hasRuntimeOnlyActivation === 'boolean' &&
        (!h.hasRuntimeOnlyActivation || !h.legacyV1AdmissionEnabled) &&
        (h.seedDigest === null || isHash(h.seedDigest)),
      'catalog-head-schema',
    );
    if (h.activeRevisionId !== null) uuid(h.activeRevisionId);
    return h as unknown as CatalogHead;
  }
  protected expectHead(id: string | null, seq: number): void {
    const h = this.head();
    requireCatalog(
      h.activeRevisionId === id && h.activationSequence === seq,
      'CATALOG_HEAD_CONFLICT',
    );
  }
  protected receipt<T>(
    p: CatalogPrincipal,
    family: string,
    id: string,
    request: unknown,
  ): T | null {
    const row = this.rows(
      'SELECT request,body FROM identity_catalog_operations WHERE principal=? AND family=? AND id=?',
      p.principalId,
      family,
      id,
    )[0];
    if (!row) return null;
    requireCatalog(
      row.request === canonicalJson(request),
      'operation-content-conflict',
    );
    const receipt: unknown = JSON.parse(String(row.body));
    exact(receipt, ['format', 'requestHash', 'responseHash', 'response']);
    requireCatalog(
      receipt.format === 'gridview-identity-operation/1' &&
        isHash(receipt.requestHash) &&
        isHash(receipt.responseHash),
      'operation-integrity',
    );
    // Stored canonical response bytes are checked by readOperation, while
    // transaction replay also compares the exact immutable request.
    return receipt.response as T;
  }
  protected async replay<T>(
    p: CatalogPrincipal,
    family: string,
    id: string,
    request: unknown,
  ): Promise<T | null> {
    const result = this.receipt<T>(p, family, id, request);
    if (result !== null)
      requireCatalog(
        same(result, await this.readOperation(p.principalId, family, id)),
        'operation-response-integrity',
      );
    return result;
  }
  protected audit(
    p: CatalogPrincipal,
    family: string,
    operationId: string,
    before: unknown,
    after: unknown,
    time: string,
  ): void {
    const n =
      Number(
        this.rows(
          'SELECT COALESCE(MAX(sequence),0) n FROM identity_catalog_audit',
        )[0]!.n,
      ) + 1;
    requireCatalog(n <= identityLimits.audits, 'audit-capacity');
    this.rows(
      'INSERT INTO identity_catalog_audit VALUES(?,?)',
      n,
      canonicalJson({
        eventSequence: n,
        eventId: crypto.randomUUID(),
        createdAt: time,
        principalId: p.principalId,
        credentialId: p.credentialId,
        authMethod: p.authMethod,
        family,
        operationId,
        before,
        after,
      }),
    );
  }
  protected async commit<T>(
    p: CatalogPrincipal,
    family: string,
    id: string,
    request: unknown,
    result: T,
    responseHash: IdentityHash,
    change: () => void,
    time: string,
  ): Promise<T> {
    const requestHash = await hashIdentityProjection(request);
    return this.storage.transactionSync(() => {
      const replay = this.receipt<T>(p, family, id, request);
      if (replay) return replay;
      const before = this.head();
      change();
      this.audit(
        p,
        family,
        id,
        before,
        { head: this.head(), responseHash },
        time,
      );
      this.rows(
        'INSERT INTO identity_catalog_operations VALUES(?,?,?,?,?)',
        p.principalId,
        family,
        id,
        canonicalJson(request),
        canonicalJson({
          format: 'gridview-identity-operation/1',
          requestHash,
          responseHash,
          response: result,
        }),
      );
      this.checkCapacity();
      return structuredClone(result);
    });
  }
  protected checkCapacity(): void {
    const discovery = [
      'candidates',
      'evidence',
      'observations',
      'notifications',
      'receipts',
    ].reduce(
      (n, t) =>
        n +
        Number(
          this.rows('SELECT COALESCE(SUM(bytes),0) n FROM identity_' + t)[0]!.n,
        ),
      1024,
    );
    requireCatalog(
      discovery + catalogStorageBytes(this.storage) <=
        identityLimits.logicalBytes,
      'catalog-logical-capacity',
    );
    requireCatalog(
      Number(
        this.rows('SELECT COUNT(*) n FROM identity_catalog_revisions')[0]!.n,
      ) <= 4096 &&
        Number(
          this.rows('SELECT COUNT(*) n FROM identity_catalog_decisions')[0]!.n,
        ) <= identityLimits.audits,
      'catalog-history-capacity',
    );
  }
  protected body(
    table:
      'revisions' | 'dossiers' | 'decisions' | 'certificates' | 'corrections',
    id: string,
  ): unknown {
    const r = this.rows(
      'SELECT body FROM identity_catalog_' + table + ' WHERE id=?',
      id,
    )[0];
    requireCatalog(r && typeof r.body === 'string', 'catalog-record-missing');
    return JSON.parse(r.body);
  }
  status(id: string): ProposalStatus {
    const s = this.rows(
      'SELECT status FROM identity_catalog_statuses WHERE id=?',
      id,
    )[0]?.status;
    requireCatalog(
      ['proposed', 'validated', 'activated', 'abandoned', 'stale'].includes(
        s as string,
      ),
      'proposal-status',
    );
    return s as ProposalStatus;
  }
  protected rawRevision(id: string): CatalogRevision {
    const r = decodeRevision(this.body('revisions', id));
    const row = this.rows(
      'SELECT hash,parent FROM identity_catalog_revisions WHERE id=?',
      id,
    )[0]!;
    requireCatalog(
      r.revisionId === id &&
        row.hash === r.contentHash &&
        row.parent === r.parentRevisionId,
      'revision-row-integrity',
    );
    return r;
  }
  protected origin(): unknown {
    return JSON.parse(
      String(
        this.rows('SELECT body FROM identity_catalog_origin WHERE id=1')[0]
          ?.body,
      ),
    );
  }
  /** Reuse only the pure R0 proof for byte-identical retained input. A DO may
   * share that proof across request-local repositories. Every access rereads
   * SQLite; changed/missing bytes revalidate or fail. No mutable state cache. */
  protected validatedOrigin(): Promise<SeedArtifact> {
    const body = this.rows(
      'SELECT body FROM identity_catalog_origin WHERE id=1',
    )[0]?.body;
    requireCatalog(typeof body === 'string', 'catalog-storage-schema');
    return this.originProof.verify(body);
  }
  protected candidate(id: IdentityHash): Candidate {
    const row = this.rows(
      'SELECT body,exact_key FROM identity_candidates WHERE id=?',
      id,
    )[0];
    requireCatalog(row, 'candidate-missing');
    const c = JSON.parse(String(row.body)) as Candidate;
    requireCatalog(
      c.candidateId === id && canonicalKey(c.key) === row.exact_key,
      'candidate-integrity',
    );
    return c;
  }
  protected checkCandidate(r: ReviewRequest): Candidate | null {
    if (r.candidateId === null) return null;
    const c = this.candidate(r.candidateId);
    requireCatalog(
      c.recordVersion === r.expectedCandidateVersion &&
        c.evidenceHead === r.evidenceHead,
      'candidate-evidence-conflict',
    );
    if (r.proposedBindingKey)
      requireCatalog(
        canonicalKey(c.key) === canonicalKey(r.proposedBindingKey),
        'candidate-key-conflict',
      );
    if (r.action !== 'request-correction')
      requireCatalog(
        c.state !== 'resolved' && !this.activeBinding(c),
        'REVISION_ALREADY_ACTIVATED',
      );
    return c;
  }
  protected activeBinding(c: Candidate): boolean {
    return !!this.rows(
      'SELECT target FROM identity_catalog_keys WHERE exact_key=? AND activated=1',
      canonicalKey(c.key),
    ).length;
  }
  protected saveCandidate(c: Candidate, previous: number): void {
    requireCatalog(
      c.recordVersion < Number.MAX_SAFE_INTEGER,
      'candidate-version-capacity',
    );
    c.recordVersion++;
    const old = this.rows(
      'SELECT version,body,bytes FROM identity_candidates WHERE id=?',
      c.candidateId,
    )[0];
    requireCatalog(
      old &&
        (JSON.parse(String(old.body)) as Candidate).recordVersion === previous,
      'candidate-evidence-conflict',
    );
    this.rows(
      'UPDATE identity_candidates SET body=?,version=version+1,bytes=? WHERE id=? AND version=?',
      canonicalJson(c),
      Number(old.bytes) + size(c) - utf8(String(old.body)).length,
      c.candidateId,
      Number(old.version),
    );
  }
  protected insertRevision(r: CatalogRevision): void {
    this.rows(
      'INSERT INTO identity_catalog_revisions VALUES(?,?,?,?)',
      r.revisionId,
      r.parentRevisionId,
      r.contentHash,
      canonicalJson(r),
    );
    this.rows(
      "INSERT INTO identity_catalog_statuses VALUES(?,'proposed')",
      r.revisionId,
    );
  }
  protected insertIndexes(r: CatalogRevision): void {
    for (const d of r.snapshot.drivers)
      this.rows(
        'INSERT INTO identity_catalog_drivers VALUES(?,?,?)',
        r.revisionId,
        d.anchor.driverId,
        canonicalJson(d),
      );
    for (const b of r.snapshot.bindings)
      this.rows(
        'INSERT INTO identity_catalog_bindings VALUES(?,?,?)',
        r.revisionId,
        canonicalKey(b.key),
        canonicalJson(b),
      );
    for (const e of r.snapshot.reviewEvidence ?? [])
      this.rows(
        'INSERT INTO identity_catalog_evidence VALUES(?,?)',
        r.revisionId,
        e.evidenceId,
      );
  }
  protected checkIndexes(r: CatalogRevision): void {
    requireCatalog(
      same(
        this.rows(
          'SELECT id,body FROM identity_catalog_drivers WHERE revision=? ORDER BY id',
          r.revisionId,
        ),
        r.snapshot.drivers.map((d) => ({
          id: d.anchor.driverId,
          body: canonicalJson(d),
        })),
      ),
      'revision-driver-index',
    );
    requireCatalog(
      same(
        this.rows(
          'SELECT exact_key,body FROM identity_catalog_bindings WHERE revision=? ORDER BY exact_key',
          r.revisionId,
        ),
        r.snapshot.bindings.map((b) => ({
          exact_key: canonicalKey(b.key),
          body: canonicalJson(b),
        })),
      ),
      'revision-binding-index',
    );
    requireCatalog(
      same(
        this.rows(
          'SELECT id FROM identity_catalog_evidence WHERE revision=? ORDER BY id',
          r.revisionId,
        ),
        (r.snapshot.reviewEvidence ?? []).map((e) => ({ id: e.evidenceId })),
      ),
      'revision-evidence-index',
    );
    for (const d of r.snapshot.drivers)
      requireCatalog(
        same(
          JSON.parse(
            String(
              this.rows(
                'SELECT body FROM identity_catalog_anchors WHERE id=?',
                d.anchor.driverId,
              )[0]?.body,
            ),
          ),
          d.anchor,
        ),
        'revision-anchor-index',
      );
  }
  async readOperation(
    principalId: string,
    family: string,
    id: string,
  ): Promise<unknown> {
    const r = this.rows(
      'SELECT request,body FROM identity_catalog_operations WHERE principal=? AND family=? AND id=?',
      principalId,
      family,
      id,
    )[0];
    if (!r) return null;
    const v = JSON.parse(String(r.body));
    exact(v, ['format', 'requestHash', 'responseHash', 'response']);
    requireCatalog(
      v.format === 'gridview-identity-operation/1' &&
        v.requestHash ===
          (await hashIdentityProjection(JSON.parse(String(r.request)))) &&
        v.responseHash === (await hashIdentityProjection(v.response)),
      'operation-response-integrity',
    );
    return freeze(v.response);
  }
}
