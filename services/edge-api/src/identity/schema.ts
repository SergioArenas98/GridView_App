import { IdentityError } from './port';
export interface IdentityStorage {
  sql: {
    exec(
      query: string,
      ...bindings: (string | number | null)[]
    ): { toArray(): Record<string, unknown>[] };
  };
  transactionSync<T>(run: () => T): T;
}
export function initialize(
  storage: IdentityStorage,
  installation: string,
): void {
  storage.transactionSync(() => {
    storage.sql
      .exec(
        'CREATE TABLE IF NOT EXISTS identity_meta (id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL, installation TEXT NOT NULL, maintenance_cursor TEXT NOT NULL, persisted INTEGER NOT NULL, replayed INTEGER NOT NULL, dropped INTEGER NOT NULL)',
      )
      .toArray();
    const meta = storage.sql
      .exec('SELECT * FROM identity_meta WHERE id=1')
      .toArray()[0];
    if (meta && meta.version !== 1) throw new IdentityError('schema-version');
    if (meta && meta.installation !== installation)
      throw new IdentityError('installation-mismatch');
    storage.sql
      .exec(
        "INSERT OR IGNORE INTO identity_meta VALUES(1,1,?,'',0,0,0)",
        installation,
      )
      .toArray();
    storage.sql
      .exec(
        'CREATE TABLE IF NOT EXISTS identity_candidates (id TEXT PRIMARY KEY, exact_key TEXT NOT NULL UNIQUE, season INTEGER NOT NULL, source TEXT NOT NULL, version INTEGER NOT NULL, last_recorded INTEGER NOT NULL, body TEXT NOT NULL, bytes INTEGER NOT NULL)',
      )
      .toArray();
    storage.sql
      .exec(
        'CREATE INDEX IF NOT EXISTS identity_scope ON identity_candidates(season,source)',
      )
      .toArray();
    storage.sql
      .exec(
        'CREATE TABLE IF NOT EXISTS identity_evidence (id TEXT NOT NULL, candidate TEXT NOT NULL REFERENCES identity_candidates(id), body TEXT NOT NULL, protected INTEGER NOT NULL DEFAULT 0, bytes INTEGER NOT NULL, PRIMARY KEY(candidate,id))',
      )
      .toArray();
    storage.sql
      .exec(
        'CREATE TABLE IF NOT EXISTS identity_observations (id TEXT PRIMARY KEY, candidate TEXT NOT NULL REFERENCES identity_candidates(id), recorded INTEGER NOT NULL, body TEXT NOT NULL, protected INTEGER NOT NULL DEFAULT 0, bytes INTEGER NOT NULL)',
      )
      .toArray();
    storage.sql
      .exec(
        'CREATE INDEX IF NOT EXISTS identity_occurrences ON identity_observations(candidate,recorded,id)',
      )
      .toArray();
    storage.sql
      .exec(
        'CREATE TABLE IF NOT EXISTS identity_notifications (candidate TEXT NOT NULL REFERENCES identity_candidates(id), generation INTEGER NOT NULL, body TEXT NOT NULL, bytes INTEGER NOT NULL, PRIMARY KEY(candidate,generation))',
      )
      .toArray();
    storage.sql
      .exec(
        'CREATE TABLE IF NOT EXISTS identity_receipts (id TEXT PRIMARY KEY, recorded INTEGER NOT NULL, body TEXT NOT NULL, bytes INTEGER NOT NULL)',
      )
      .toArray();
    storage.sql
      .exec(
        'CREATE INDEX IF NOT EXISTS identity_receipt_age ON identity_receipts(recorded)',
      )
      .toArray();
  });
}
