import type { IdentityStorage } from '../schema';
import { initialize } from '../schema';
import { requireCatalog } from './model';

export { catalogTables } from '../storage-accounting';
/** Additive storage schema. U2 tables and installation metadata are never rebuilt. */
export const catalogMigration = [
  'CREATE TABLE identity_catalog_head (id INTEGER PRIMARY KEY CHECK(id=1), body TEXT NOT NULL)',
  'CREATE TABLE identity_catalog_origin (id INTEGER PRIMARY KEY CHECK(id=1), body TEXT NOT NULL)',
  'CREATE TABLE identity_catalog_decisions (id TEXT PRIMARY KEY, body TEXT NOT NULL)',
  'CREATE TABLE identity_catalog_dossiers (id TEXT PRIMARY KEY, body TEXT NOT NULL)',
  'CREATE TABLE identity_catalog_revisions (id TEXT PRIMARY KEY, parent TEXT REFERENCES identity_catalog_revisions(id), hash TEXT NOT NULL, body TEXT NOT NULL)',
  "CREATE TABLE identity_catalog_statuses (id TEXT PRIMARY KEY REFERENCES identity_catalog_revisions(id), status TEXT NOT NULL CHECK(status IN ('proposed','validated','activated','abandoned','stale')))",
  'CREATE TABLE identity_catalog_certificates (id TEXT PRIMARY KEY, revision TEXT NOT NULL REFERENCES identity_catalog_revisions(id), body TEXT NOT NULL)',
  'CREATE TABLE identity_catalog_operations (principal TEXT NOT NULL, family TEXT NOT NULL, id TEXT NOT NULL, request TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(principal,family,id))',
  'CREATE TABLE identity_catalog_audit (sequence INTEGER PRIMARY KEY, body TEXT NOT NULL)',
  'CREATE TABLE identity_catalog_anchors (id TEXT PRIMARY KEY, decision TEXT NOT NULL, body TEXT NOT NULL)',
  'CREATE TABLE identity_catalog_keys (exact_key TEXT PRIMARY KEY, target TEXT NOT NULL, revision TEXT NOT NULL REFERENCES identity_catalog_revisions(id), activated INTEGER NOT NULL CHECK(activated IN (0,1)))',
  'CREATE TABLE identity_catalog_labels (season INTEGER NOT NULL, label TEXT NOT NULL, projection TEXT NOT NULL, revision TEXT NOT NULL REFERENCES identity_catalog_revisions(id), date TEXT NOT NULL, suffix INTEGER NOT NULL, PRIMARY KEY(season,label), UNIQUE(season,date,suffix))',
  'CREATE TABLE identity_catalog_seasons (season INTEGER NOT NULL, label TEXT NOT NULL, projection TEXT NOT NULL, base TEXT NOT NULL, revision TEXT NOT NULL REFERENCES identity_catalog_revisions(id), PRIMARY KEY(season,label,revision))',
  'CREATE TABLE identity_catalog_drivers (revision TEXT NOT NULL REFERENCES identity_catalog_revisions(id), id TEXT NOT NULL REFERENCES identity_catalog_anchors(id), body TEXT NOT NULL, PRIMARY KEY(revision,id))',
  'CREATE TABLE identity_catalog_bindings (revision TEXT NOT NULL REFERENCES identity_catalog_revisions(id), exact_key TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(revision,exact_key))',
  'CREATE TABLE identity_catalog_evidence (revision TEXT NOT NULL REFERENCES identity_catalog_revisions(id), id TEXT NOT NULL REFERENCES identity_catalog_dossiers(id), PRIMARY KEY(revision,id))',
  'CREATE TABLE identity_catalog_corrections (id TEXT PRIMARY KEY, body TEXT NOT NULL)',
  'CREATE TABLE identity_catalog_correction_events (id TEXT PRIMARY KEY, correction TEXT NOT NULL REFERENCES identity_catalog_corrections(id), body TEXT NOT NULL)',
] as const;
// Exact SHA-256 of canonicalJson(catalogMigration), checked by migration tests.
export const catalogMigrationHash =
  'sha256:60be003373ecca8f2d92bf29aa089b29f177f8e2d295e8de41c62edfc7424e07';
export function initializeCatalog(
  storage: IdentityStorage,
  installation: string,
): void {
  initialize(storage, installation);
  storage.transactionSync(() => {
    const rows = (q: string, ...a: (string | number | null)[]) =>
      storage.sql.exec(q, ...a).toArray();
    rows(
      'CREATE TABLE IF NOT EXISTS identity_catalog_migrations (version INTEGER PRIMARY KEY, hash TEXT NOT NULL)',
    );
    const existing = rows(
      'SELECT * FROM identity_catalog_migrations ORDER BY version',
    );
    requireCatalog(
      existing.length <= 1 &&
        existing.every(
          (r) => r.version === 1 && r.hash === catalogMigrationHash,
        ),
      'catalog-storage-schema',
    );
    if (!existing.length) {
      for (const sql of catalogMigration) rows(sql);
      rows(
        'INSERT INTO identity_catalog_migrations VALUES(1,?)',
        catalogMigrationHash,
      );
    }
  });
}
