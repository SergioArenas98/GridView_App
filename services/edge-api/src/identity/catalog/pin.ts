import { canonicalJson } from '../../ingest/canonical-json';
import { hashIdentityProjection } from '../discovery/keys';
import { isHash } from '../wire-decoders';
import type { IdentityStorage } from '../schema';
import { requireCatalog } from './model';
import { freeze } from './sources';
import {
  decodePinRequest,
  decodeRunPin,
  samePinExecution,
  type PinRequest,
  type RunPin,
  type PinnedCatalog,
} from './pin-contract';
export type { PinRequest, RunPin, PinnedCatalog } from './pin-contract';
import { CatalogRevisionStore } from './revision-store';
import { reviewedRegistry } from './indexes';

/** Separate additive migration; U2/U4 migration bytes and ledger v1 stay intact. */
export function initializePins(storage: IdentityStorage): void {
  storage.transactionSync(() => {
    storage.sql
      .exec(
        'CREATE TABLE IF NOT EXISTS identity_run_pin_migrations (version INTEGER PRIMARY KEY CHECK(version=1), format TEXT NOT NULL)',
      )
      .toArray();
    const rows = storage.sql
      .exec('SELECT * FROM identity_run_pin_migrations')
      .toArray();
    requireCatalog(
      rows.length <= 1 &&
        rows.every(
          (r) => r.version === 1 && r.format === 'gridview-identity-run-pin/1',
        ),
      'pin-storage-schema',
    );
    if (!rows.length) {
      storage.sql
        .exec(
          'CREATE TABLE identity_run_pins (run_id TEXT PRIMARY KEY, revision TEXT NOT NULL REFERENCES identity_catalog_revisions(id), request TEXT NOT NULL, body TEXT NOT NULL, hash TEXT NOT NULL)',
        )
        .toArray();
      storage.sql
        .exec(
          "INSERT INTO identity_run_pin_migrations VALUES(1,'gridview-identity-run-pin/1')",
        )
        .toArray();
    }
  });
}

/** Namespace-only admission. Catalog pins have no synchronization/publication port. */
export class CatalogRunPins extends CatalogRevisionStore {
  private stored(request: PinRequest): RunPin | null {
    const row = this.rows(
      'SELECT * FROM identity_run_pins WHERE run_id=?',
      request.runId,
    )[0];
    if (!row) return null;
    const original = decodePinRequest(JSON.parse(String(row.request)));
    requireCatalog(samePinExecution(original, request), 'pin-run-conflict');
    const pin = decodeRunPin(JSON.parse(String(row.body)));
    requireCatalog(
      canonicalJson(pin.request) === row.request &&
        row.revision === pin.revisionId &&
        isHash(row.hash),
      'pin-integrity',
    );
    return pin;
  }
  async pinRun(input: unknown): Promise<PinnedCatalog> {
    const request = decodePinRequest(input);
    requireCatalog(
      request.installationId === this.installation,
      'pin-installation-mismatch',
    );
    initializePins(this.storage);
    const replay = this.stored(request);
    if (replay) return this.load(replay);
    const head = this.head();
    requireCatalog(head.admissionState === 'open', 'pin-admission-paused');
    requireCatalog(head.activeRevisionId !== null, 'pin-no-active-head');
    const revision = await this.readRevision(head.activeRevisionId);
    requireCatalog(
      this.status(revision.revisionId) === 'activated' &&
        revision.sequence === head.activationSequence &&
        reviewedRegistry(revision.snapshot).isValid,
      'pin-invalid-revision',
    );
    const seasons = revision.snapshot.seasonContent.filter(
      (s) => s.season === request.season,
    );
    requireCatalog(seasons.length === 1, 'pin-season-missing');
    const season = seasons[0]!;
    const pin: RunPin = {
      format: 'gridview-identity-run-pin/1',
      request,
      revisionId: revision.revisionId,
      catalogHash: revision.contentHash,
      seasonProjectionHash: season.seasonProjectionHash,
      datasetVersion: season.datasetVersion,
      baseContentDigest: season.baseContentDigest,
      pinnedAt: this.time(),
      snapshotIdentity: revision.revisionId + ':' + revision.contentHash,
    };
    const hash = await hashIdentityProjection(pin);
    const admitted = this.storage.transactionSync(() => {
      const existing = this.stored(request);
      if (existing) return existing;
      requireCatalog(
        canonicalJson(this.head()) === canonicalJson(head),
        'pin-head-conflict',
      );
      requireCatalog(
        canonicalJson(this.rawRevision(revision.revisionId)) ===
          canonicalJson(revision),
        'pin-revision-changed',
      );
      this.checkIndexes(revision);
      this.checkSeason(pin);
      this.rows(
        'INSERT INTO identity_run_pins VALUES(?,?,?,?,?)',
        request.runId,
        revision.revisionId,
        canonicalJson(request),
        canonicalJson(pin),
        hash,
      );
      this.checkCapacity();
      return pin;
    });
    return this.load(admitted);
  }
  private async load(pin: RunPin): Promise<PinnedCatalog> {
    const row = this.rows(
      'SELECT hash FROM identity_run_pins WHERE run_id=?',
      pin.request.runId,
    )[0];
    requireCatalog(
      row?.hash === (await hashIdentityProjection(pin)),
      'pin-integrity',
    );
    const r = await this.readRevision(pin.revisionId);
    const s = r.snapshot.seasonContent.find(
      (s) => s.season === pin.request.season,
    );
    requireCatalog(
      this.status(r.revisionId) === 'activated' &&
        s &&
        r.contentHash === pin.catalogHash &&
        s.seasonProjectionHash === pin.seasonProjectionHash &&
        s.datasetVersion === pin.datasetVersion &&
        s.baseContentDigest === pin.baseContentDigest,
      'pin-snapshot-integrity',
    );
    this.checkSeason(pin);
    return freeze({
      pin,
      receiptHash: String(row!.hash),
      lineage: canonicalJson(this.revisionExport(r)),
    });
  }
  private checkSeason(pin: RunPin): void {
    requireCatalog(
      this.rows(
        'SELECT projection,base FROM identity_catalog_seasons WHERE season=? AND label=? AND revision=?',
        pin.request.season,
        pin.datasetVersion,
        pin.revisionId,
      ).some(
        (row) =>
          row.projection === pin.seasonProjectionHash &&
          row.base === pin.baseContentDigest,
      ),
      'pin-season-integrity',
    );
  }
}
