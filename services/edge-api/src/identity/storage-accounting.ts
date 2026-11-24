import type { IdentityStorage } from './schema';
import { IdentityError } from './port';
export const catalogTables = [
  'head',
  'origin',
  'decisions',
  'dossiers',
  'revisions',
  'statuses',
  'certificates',
  'operations',
  'audit',
  'anchors',
  'keys',
  'labels',
  'seasons',
  'drivers',
  'bindings',
  'evidence',
  'corrections',
  'correction_events',
] as const;
/** Conservative logical accounting includes text, numeric columns and index
 * payload allowance. Used by discovery as well as reviewed writes. */
export function catalogStorageBytes(storage: IdentityStorage): number {
  const exists = storage.sql
    .exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='identity_catalog_migrations'",
    )
    .toArray();
  if (!exists.length) return 0;
  let n = 1024;
  for (const table of catalogTables) {
    const name = 'identity_catalog_' + table;
    const columns = storage.sql
      .exec('PRAGMA table_info(' + name + ')')
      .toArray();
    const expression = columns
      .map((c) => {
        const field = String(c.name);
        if (!/^[a-z_]+$/.test(field)) throw new IdentityError('schema-version');
        return (
          'CASE WHEN typeof(' +
          field +
          ")='text' THEN length(CAST(" +
          field +
          ' AS BLOB))*2+32 ELSE 40 END'
        );
      })
      .join('+');
    n += Number(
      storage.sql
        .exec('SELECT COALESCE(SUM(' + expression + '),0) n FROM ' + name)
        .toArray()[0]!.n,
    );
  }
  for (const name of [
    'identity_batch_receipts',
    'identity_run_pins',
    'identity_admin_receipts',
    'identity_admin_rates',
    'identity_admin_navigation',
    'identity_admin_imports',
  ]) {
    if (
      !storage.sql
        .exec(
          "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
          name,
        )
        .toArray().length
    )
      continue;
    const columns = storage.sql
      .exec('PRAGMA table_info(' + name + ')')
      .toArray();
    const expression = columns
      .map((c) => {
        const field = String(c.name);
        if (!/^[a-z_]+$/.test(field)) throw new IdentityError('schema-version');
        return (
          'CASE WHEN typeof(' +
          field +
          ")='text' THEN length(CAST(" +
          field +
          ' AS BLOB))*2+32 ELSE 40 END'
        );
      })
      .join('+');
    n += Number(
      storage.sql
        .exec('SELECT COALESCE(SUM(' + expression + '),0) n FROM ' + name)
        .toArray()[0]!.n,
    );
  }
  return n;
}
