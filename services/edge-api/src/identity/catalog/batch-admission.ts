import { CatalogRunPins } from './pin';
import { canonicalJson } from '../../ingest/canonical-json';
import { hashIdentityProjection } from '../discovery/keys';
import { isHash } from '../wire-decoders';
import { requireCatalog } from './model';
import { exact, boundedJson } from './sources';
import { uuid } from './review';
import type { PinnedCatalog } from './pin-contract';
import { administrativeExport } from './admin-export';

/** Exact corrected, reviewed U3 R0, not a current-head inference. */
export const approvedR0Hash =
  'sha256:8a2a62d8412fdfd71cfd5138b4f87682f33a690d21c3d5eec46153bfbda39851';
/**
 * Schema 1 is every strict admission, unchanged. Schema 2 (U10) records the
 * installation's explicit optional-driver inventory policy, so the durable
 * receipt identity and the run pin both carry it: the same operation ID under
 * another policy is a `batch-operation-conflict`.
 */
export interface BatchAdmissionRequest {
  schemaVersion: 1 | 2;
  inventoryPolicy?: 'optional-driver-inventory-v1';
  operationId: string;
  installationId: string;
  season: number;
  submissionHash: string;
  leaseFence: number;
  legacy: boolean;
  compatibilityInstallation: string | null;
}
export interface BatchAdmissionReceipt {
  state: 'admitted' | 'publishing' | 'complete';
  admittedAt: string;
  result: unknown;
  legacyAllowed: boolean;
  exportSha256: string;
}
/** Receipts only. This object cannot publish, lease a season, or choose versions. */
export class CatalogBatchAdmissions extends CatalogRunPins {
  private initializeBatch(): void {
    this.storage.transactionSync(() => {
      this.rows(
        'CREATE TABLE IF NOT EXISTS identity_batch_migrations (version INTEGER PRIMARY KEY, format TEXT NOT NULL)',
      );
      const migrations = this.rows('SELECT * FROM identity_batch_migrations');
      requireCatalog(
        migrations.length <= 1 &&
          migrations.every(
            (r) =>
              r.version === 1 &&
              r.format === 'gridview-identity-batch-admission/1',
          ),
        'batch-storage-version',
      );
      if (!migrations.length) {
        this.rows(
          'CREATE TABLE identity_batch_receipts (operation TEXT PRIMARY KEY, request TEXT NOT NULL, body TEXT NOT NULL, hash TEXT NOT NULL)',
        );
        this.rows(
          "INSERT INTO identity_batch_migrations VALUES(1,'gridview-identity-batch-admission/1')",
        );
      }
    });
  }
  private decode(input: unknown): BatchAdmissionRequest {
    const v = boundedJson(input);
    const keys = [
      'schemaVersion',
      'operationId',
      'installationId',
      'season',
      'submissionHash',
      'leaseFence',
      'legacy',
      'compatibilityInstallation',
    ];
    const schema =
      v !== null && typeof v === 'object' && !Array.isArray(v)
        ? (v as { schemaVersion?: unknown }).schemaVersion
        : undefined;
    exact(v, schema === 2 ? [...keys, 'inventoryPolicy'] : keys);
    uuid(v.operationId);
    uuid(v.installationId);
    requireCatalog(
      (v.schemaVersion === 1 ||
        (v.schemaVersion === 2 &&
          v.inventoryPolicy === 'optional-driver-inventory-v1' &&
          // New v1 (legacy) ingestion never gains an optional-policy path.
          v.legacy === false)) &&
        v.installationId === this.installation &&
        isHash(v.submissionHash) &&
        Number.isSafeInteger(v.season) &&
        Number(v.season) >= 1950 &&
        Number(v.season) <= 2200 &&
        Number.isSafeInteger(v.leaseFence) &&
        Number(v.leaseFence) >= 1 &&
        typeof v.legacy === 'boolean' &&
        (v.compatibilityInstallation === null ||
          v.compatibilityInstallation === this.installation),
      'batch-admission-request',
    );
    return v as unknown as BatchAdmissionRequest;
  }
  private identity(request: BatchAdmissionRequest): string {
    const { leaseFence, compatibilityInstallation, ...identity } = request;
    void leaseFence;
    void compatibilityInstallation;
    return canonicalJson(identity);
  }
  private async storedBatch(
    request: BatchAdmissionRequest,
  ): Promise<BatchAdmissionReceipt | null> {
    const r = this.rows(
      'SELECT * FROM identity_batch_receipts WHERE operation=?',
      request.operationId,
    )[0];
    if (!r) return null;
    requireCatalog(
      r.request === this.identity(request),
      'batch-operation-conflict',
    );
    const receipt = JSON.parse(String(r.body)) as BatchAdmissionReceipt;
    requireCatalog(
      r.hash === (await hashIdentityProjection(receipt)),
      'batch-receipt-integrity',
    );
    exact(receipt, [
      'state',
      'admittedAt',
      'result',
      'legacyAllowed',
      'exportSha256',
    ]);
    requireCatalog(
      ['admitted', 'publishing', 'complete'].includes(receipt.state) &&
        typeof receipt.legacyAllowed === 'boolean' &&
        isHash(receipt.exportSha256) &&
        Number.isFinite(Date.parse(receipt.admittedAt)),
      'batch-receipt-schema',
    );
    return receipt;
  }
  async admitBatch(input: unknown): Promise<{
    receipt: BatchAdmissionReceipt;
    catalog: PinnedCatalog | null;
  }> {
    const request = this.decode(input);
    this.initializeBatch();
    const replay = await this.storedBatch(request);
    if (replay?.state === 'complete') return { receipt: replay, catalog: null };
    const base = {
      runId: request.operationId,
      installationId: request.installationId,
      season: request.season,
      purpose: 'season-batch' as const,
      leaseFence: request.leaseFence,
    };
    const pinRequest =
      request.schemaVersion === 2
        ? {
            schemaVersion: 2 as const,
            ...base,
            inventoryPolicy: 'optional-driver-inventory-v1' as const,
          }
        : { schemaVersion: 1 as const, ...base };
    const catalog = await this.pinRun(pinRequest);
    if (replay) return { receipt: replay, catalog };
    const head = this.head();
    requireCatalog(
      head.activeRevisionId === catalog.pin.revisionId &&
        head.admissionState === 'open',
      'batch-stale-catalog',
    );
    const revision = await this.readRevision(catalog.pin.revisionId);
    const legacyAllowed =
      head.legacyV1AdmissionEnabled &&
      !head.hasRuntimeOnlyActivation &&
      head.seedDigest === approvedR0Hash &&
      revision.contentHash === approvedR0Hash &&
      revision.sequence === 1 &&
      head.activationSequence === 1 &&
      this.rows(
        "SELECT id FROM identity_catalog_statuses WHERE status='activated'",
      ).length === 1 &&
      request.compatibilityInstallation === this.installation;
    requireCatalog(
      !request.legacy || legacyAllowed,
      'runtime-batch-requires-u7',
    );
    const imports = this.rows(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='identity_admin_imports'",
    ).length
      ? this.rows(
          "SELECT i.revision,d.body FROM identity_admin_imports i JOIN identity_catalog_dossiers d ON d.id=json_extract(i.body,'$.evidenceId')",
        ).map((r) => ({
          revision: String(r.revision),
          evidence: JSON.parse(String(r.body)) as unknown,
        }))
      : [];
    const exported = await administrativeExport(
      this.installation,
      JSON.parse(catalog.lineage) as Record<string, unknown>,
      imports,
    );
    const receipt: BatchAdmissionReceipt = {
      state: 'admitted',
      admittedAt: this.time(),
      result: null,
      legacyAllowed,
      exportSha256: exported.exportHash,
    };
    const hash = await hashIdentityProjection(receipt);
    this.storage.transactionSync(() => {
      requireCatalog(
        canonicalJson(this.head()) === canonicalJson(head),
        'batch-head-conflict',
      );
      const existing = this.rows(
        'SELECT request FROM identity_batch_receipts WHERE operation=?',
        request.operationId,
      )[0];
      if (existing) {
        requireCatalog(
          existing.request === this.identity(request),
          'batch-operation-conflict',
        );
        return;
      }
      this.rows(
        'INSERT INTO identity_batch_receipts VALUES(?,?,?,?)',
        request.operationId,
        this.identity(request),
        canonicalJson(receipt),
        hash,
      );
      this.checkCapacity();
    });
    return { receipt: (await this.storedBatch(request))!, catalog };
  }
  async transitionBatch(input: unknown): Promise<BatchAdmissionReceipt> {
    const v = boundedJson(input);
    exact(v, ['request', 'state', 'result']);
    const request = this.decode(v.request);
    this.initializeBatch();
    const previous = await this.storedBatch(request);
    requireCatalog(previous, 'batch-not-admitted');
    if (previous.state === 'complete') return previous;
    requireCatalog(
      (previous.state === 'admitted' &&
        ['publishing', 'complete'].includes(String(v.state))) ||
        (previous.state === 'publishing' &&
          ['publishing', 'complete'].includes(String(v.state))),
      'batch-transition',
    );
    if (
      previous.state === 'publishing' &&
      v.state === 'publishing' &&
      previous.result !== null
    )
      requireCatalog(
        canonicalJson(previous.result) === canonicalJson(v.result),
        'batch-intent-conflict',
      );
    const next: BatchAdmissionReceipt = {
      ...previous,
      state: v.state as 'publishing' | 'complete',
      result: v.result,
    };
    const hash = await hashIdentityProjection(next);
    this.storage.transactionSync(() => {
      const row = this.rows(
        'SELECT body FROM identity_batch_receipts WHERE operation=?',
        request.operationId,
      )[0];
      requireCatalog(
        row?.body === canonicalJson(previous),
        'batch-transition-conflict',
      );
      this.rows(
        'UPDATE identity_batch_receipts SET body=?,hash=? WHERE operation=?',
        canonicalJson(next),
        hash,
        request.operationId,
      );
      this.checkCapacity();
    });
    return next;
  }
}
