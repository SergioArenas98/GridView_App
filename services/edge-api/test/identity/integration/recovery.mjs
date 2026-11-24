/** Local TEST-ONLY cold-copy verification. Not a remote backup, PITR or restore API.
 * Caller must stop workerd first; copied databases retain their installation and
 * receipts. Configuration/credentials are deliberately absent from the copy. */
import {
  readdir,
  readFile,
  mkdir,
  writeFile,
  lstat,
  mkdtemp,
} from 'node:fs/promises';
import { join, resolve, relative, isAbsolute, sep, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { TextEncoder } from 'node:util';
import { verifyCatalogFile } from '../../../scripts/identity/catalog-file';
import {
  catalogMigrationHash,
  catalogTables,
} from '../../../src/identity/catalog/schema';
import { canonicalJson } from '../../../src/ingest/canonical-json';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
function localRoot(root) {
  const absolute = resolve(root);
  if (
    !absolute.startsWith(resolve(tmpdir()) + sep) ||
    !basename(absolute).startsWith('gridview-u8-')
  )
    throw Error('Test-only recovery root required');
  return absolute;
}
function child(root, path) {
  if (
    typeof path !== 'string' ||
    path.includes('\\') ||
    path.split('/').some((p) => !p || p === '.' || p === '..')
  )
    throw Error('Unsafe recovery path');
  const absolute = resolve(root, path),
    rel = relative(root, absolute);
  if (isAbsolute(rel) || rel.startsWith('..'))
    throw Error('Unsafe recovery path');
  return absolute;
}
async function inventory(root) {
  const entries = [];
  async function walk(path = '') {
    for (const item of await readdir(join(root, path), {
      withFileTypes: true,
    })) {
      const name = path ? path + '/' + item.name : item.name;
      if (item.isSymbolicLink()) throw Error('Recovery symlinks forbidden');
      if (item.isDirectory()) await walk(name);
      else if (item.isFile()) {
        const bytes = await readFile(child(root, name));
        entries.push({ path: name, bytes: bytes.length, sha256: hash(bytes) });
      } else throw Error('Unsupported recovery entry');
    }
  }
  await walk();
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}
export async function coldBackup(root, wrapper, checkpoint) {
  localRoot(root);
  await verifyCatalogFile(new TextEncoder().encode(JSON.stringify(wrapper)), {
    installationId: wrapper.installationId,
    season: 2026,
  });
  return {
    format: 'gridview-u8-local-cold-copy/1',
    schemaVersion: 1,
    installationId: wrapper.installationId,
    activeRevisionId: wrapper.revision.revisionId,
    checkpoint,
    catalogExport: wrapper,
    files: await inventory(root),
  };
}
export async function restoreColdCopy(source, target, manifest, expected) {
  const from = localRoot(source),
    to = localRoot(target);
  if (from === to) throw Error('Distinct empty recovery target required');
  if ((await lstat(from)).isSymbolicLink())
    throw Error('Recovery symlinks forbidden');
  if ((await lstat(to)).isSymbolicLink() || (await readdir(to)).length)
    throw Error('Nonempty recovery target refused');
  if (
    manifest.format !== 'gridview-u8-local-cold-copy/1' ||
    manifest.schemaVersion !== 1 ||
    manifest.installationId !== expected.installationId ||
    manifest.activeRevisionId !== expected.activeRevisionId ||
    manifest.checkpoint.activationSequence !== expected.activationSequence
  )
    throw Error('Incompatible or outdated recovery checkpoint');
  const checked = await verifyCatalogFile(
    new TextEncoder().encode(JSON.stringify(manifest.catalogExport)),
    { installationId: expected.installationId, season: 2026 },
  );
  if (
    manifest.catalogExport.revision.revisionId !== expected.activeRevisionId ||
    checked.context.revisionId !== expected.activeRevisionId
  )
    throw Error('Recovery revision mismatch');
  // Compare complete inventory before creating ANY target files. Detect missing,
  // extra and corrupt databases, not just agreement with a client file list.
  if (JSON.stringify(await inventory(from)) !== JSON.stringify(manifest.files))
    throw Error('Recovery file integrity');
  // Even a read-only SQLite connection can update its WAL-index (-shm).
  // Inspect a private copy, never the immutable backup itself. Retain the
  // complete file manifest, including WAL/SHM; do not waive their hashes.
  const inspection = await mkdtemp(join(tmpdir(), 'gridview-u8-verify-'));
  const copyVerified = async (root, item) => {
    const bytes = await readFile(child(from, item.path));
    if (bytes.length !== item.bytes || hash(bytes) !== item.sha256)
      throw Error('Recovery file integrity');
    const destination = child(root, item.path);
    await mkdir(resolve(destination, '..'), { recursive: true });
    await writeFile(destination, bytes, { flag: 'wx' });
  };
  for (const item of manifest.files) await copyVerified(inspection, item);
  let catalogs = 0;
  for (const item of manifest.files) {
    const input = child(inspection, item.path);
    if (item.path.endsWith('.sqlite')) {
      const db = new DatabaseSync(input, { readOnly: true });
      try {
        const integrity = db.prepare('PRAGMA integrity_check').all();
        if (
          JSON.stringify(integrity) !==
          JSON.stringify([{ integrity_check: 'ok' }])
        )
          throw Error('SQLite integrity');
        const meta = db
          .prepare("SELECT name FROM sqlite_master WHERE name='identity_meta'")
          .all();
        if (meta.length) {
          catalogs++;
          if (
            db.prepare('SELECT installation,version FROM identity_meta').get()
              .installation !== expected.installationId
          )
            throw Error('Recovery installation');
          if (
            db.prepare('SELECT version FROM identity_meta').get().version !== 1
          )
            throw Error('Recovery schema');
          const migrations = db
            .prepare('SELECT version,hash FROM identity_catalog_migrations')
            .all();
          if (
            migrations.length !== 1 ||
            migrations[0].version !== 1 ||
            migrations[0].hash !== catalogMigrationHash
          )
            throw Error('Recovery schema');
          for (const table of catalogTables)
            db.prepare('SELECT COUNT(*) FROM identity_catalog_' + table).get();
          const head = JSON.parse(
            db.prepare('SELECT body FROM identity_catalog_head').get().body,
          );
          if (
            head.activeRevisionId !== expected.activeRevisionId ||
            head.activationSequence !== expected.activationSequence
          )
            throw Error('Recovery head');
          if (head.hasRuntimeOnlyActivation !== manifest.checkpoint.runtimeOnly)
            throw Error('Recovery compatibility flag');
          const revision = JSON.parse(
            db
              .prepare('SELECT body FROM identity_catalog_revisions WHERE id=?')
              .get(expected.activeRevisionId).body,
          );
          if (
            canonicalJson(revision) !==
            canonicalJson(manifest.catalogExport.revision)
          )
            throw Error('Recovery stored revision');
        }
      } finally {
        db.close();
      }
    }
  }
  if (catalogs !== 1) throw Error('Incomplete operational catalog backup');
  if (JSON.stringify(await inventory(from)) !== JSON.stringify(manifest.files))
    throw Error('Recovery source changed during inspection');
  for (const item of manifest.files) await copyVerified(to, item);
}
