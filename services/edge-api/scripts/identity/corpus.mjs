import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import spec from '../../src/identity/catalog/source-spec.json' with { type: 'json' };
const pendingNovember = new Set([
  'rafael_camara',
  'gabriele_mini',
  'freddie_slater',
  'nikola_tsolov',
]);

const root = resolve(import.meta.dirname, '../../../..');
/**
 * The repository commit the R0 corpus was reviewed against (U3 correction;
 * every `baseCommit` in `docs/operations/identity-seed-r0/manifest.json`).
 * Sources are compared with this exact commit, never a floating `HEAD`: once
 * the reviewed work is itself committed, `HEAD` contains the pending November
 * evidence and would no longer be the historical baseline, and the manifest's
 * provenance would silently change.
 */
export const R0_REVIEWED_BASE_COMMIT =
  '027da5da59bf6b8c75a3fc432ef4fdc691772528';
const sha = (bytes) =>
  'sha256:' + createHash('sha256').update(bytes).digest('hex');
export function loadCorpus() {
  const head = R0_REVIEWED_BASE_COMMIT;
  // Refuses a checkout that does not descend from the reviewed baseline,
  // including a shallow clone that lacks it.
  execFileSync('git', ['merge-base', '--is-ancestor', head, 'HEAD'], {
    cwd: root,
    stdio: 'ignore',
  });
  return Object.entries(spec)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([path]) => {
      const bytes = readFileSync(resolve(root, path));
      if (bytes.length > 2 * 1024 * 1024)
        throw Error('Oversized source document');
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (!Buffer.from(text).equals(bytes))
        throw Error('Source is not lossless UTF-8');
      const document = JSON.parse(text);
      const committed = execFileSync('git', ['show', head + ':' + path], {
        cwd: root,
        maxBuffer: 4 * 1024 * 1024,
      });
      // Existing verified content must be historical repository content. The
      // explicitly pending investigation evidence is retained separately.
      if (
        document.kind !== 'provider-evidence' &&
        JSON.stringify(JSON.parse(committed)) !== JSON.stringify(document)
      )
        throw Error('Unreviewed source change: ' + path);
      if (document.kind === 'provider-evidence') {
        const historical = JSON.parse(committed);
        const pending = (row) =>
          row.source === 'jolpica' &&
          row.entity === 'driver' &&
          row.providerField === 'driverId' &&
          pendingNovember.has(row.providerValue);
        for (const section of ['identities', 'acknowledgedUnmapped']) {
          if (
            JSON.stringify(document[section].filter((row) => !pending(row))) !==
            JSON.stringify(historical[section])
          )
            throw Error(
              'Historical evidence changed without review: ' + section,
            );
          if (document[section].filter(pending).length !== 4)
            throw Error('Incomplete pending November evidence');
        }
      }
      return {
        path,
        text,
        fileHash: sha(bytes),
        documentVersion:
          document.schemaVersion ?? document.datasetVersion ?? null,
        sourceStatus: document.status,
        exactCommit: bytes.equals(committed) ? head : null,
        baseCommit: head,
      };
    });
}
