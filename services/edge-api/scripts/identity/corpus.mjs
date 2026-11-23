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
 */
export const R0_REVIEWED_BASE_COMMIT =
  '027da5da59bf6b8c75a3fc432ef4fdc691772528';
/**
 * The commit holding R0's provider evidence byte for byte: the reviewed base
 * plus the four pending November driver keys (R0 manifest `exactCommit: null`
 * for that one source). Every R0 source is read from git at these commits, so
 * R0 stays reproducible after the working tree moves on (P0, U11 P4).
 */
export const R0_EVIDENCE_COMMIT = '6d39d4821a96269a257b708bc56a922d53c8f4cd';
/**
 * The commit that adds the reviewed Rafael Câmara identity (staging catalog
 * R1, U11 Addendum O) to the repository identity sources: P0, the corpus of
 * the initial production catalog seed (U11 P4).
 */
export const P0_REVIEWED_COMMIT = '685b57e25ca84db14a7bf91a3a816a007c9d35a8';
/** Exactly what P0 adds to R0; anything else is an unreviewed change. */
export const P0_DELTA = Object.freeze({
  driver: Object.freeze({ id: 'rafael-camara', fullName: 'Rafael Câmara' }),
  providerKey: 'rafael_camara',
  datasetVersion: '2026.11.22.1',
});

const sha = (bytes) =>
  'sha256:' + createHash('sha256').update(bytes).digest('hex');
const git = (...args) =>
  execFileSync('git', args, { cwd: root, maxBuffer: 4 * 1024 * 1024 });
const show = (commit, path) => git('show', commit + ':' + path);
function decode(bytes) {
  if (bytes.length > 2 * 1024 * 1024) throw Error('Oversized source document');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (!Buffer.from(text).equals(bytes))
    throw Error('Source is not lossless UTF-8');
  return text;
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isPending = (row) =>
  row.source === 'jolpica' &&
  row.entity === 'driver' &&
  row.providerField === 'driverId' &&
  pendingNovember.has(row.providerValue);

function r0Document(path, kind) {
  const base = JSON.parse(show(R0_REVIEWED_BASE_COMMIT, path));
  if (kind !== 'provider-evidence') return { commit: R0_REVIEWED_BASE_COMMIT };
  // Existing verified evidence must be historical repository content; the
  // explicitly pending investigation evidence is retained separately.
  const document = JSON.parse(show(R0_EVIDENCE_COMMIT, path));
  for (const section of ['identities', 'acknowledgedUnmapped']) {
    if (
      !same(
        document[section].filter((r) => !isPending(r)),
        base[section],
      )
    )
      throw Error('Historical evidence changed without review: ' + section);
    if (document[section].filter(isPending).length !== 4)
      throw Error('Incomplete pending November evidence');
  }
  return { commit: R0_EVIDENCE_COMMIT, exactCommit: null };
}

function p0Check(path, kind, document) {
  const r0Commit =
    kind === 'provider-evidence' ? R0_EVIDENCE_COMMIT : R0_REVIEWED_BASE_COMMIT;
  const r0 = JSON.parse(show(r0Commit, path));
  const expected = structuredClone(r0);
  const key = P0_DELTA.providerKey;
  if (kind === 'driver-registry') expected.drivers.push({ ...P0_DELTA.driver });
  if (kind === 'season-metadata')
    expected.datasetVersion = P0_DELTA.datasetVersion;
  if (kind === 'provider-mappings') {
    const added = document.mappings.at(-1);
    if (
      !same(Object.keys(added), [
        'source',
        'entity',
        'providerField',
        'providerValue',
        'gridviewId',
        'evidence',
      ]) ||
      added.source !== 'jolpica' ||
      added.entity !== 'driver' ||
      added.providerField !== 'driverId' ||
      added.providerValue !== key ||
      added.gridviewId !== P0_DELTA.driver.id
    )
      throw Error('P0 mapping is not exactly the reviewed R1 binding');
    expected.mappings.push(added);
  }
  if (kind === 'provider-evidence') {
    const row = expected.identities.find((r) => r.providerValue === key);
    row.evidence = document.identities.find(
      (r) => r.providerValue === key,
    )?.evidence;
    if (!/8723d5ec-f779-4ac4-ae11-8b0cc8a41d54/.test(row.evidence ?? ''))
      throw Error('P0 evidence must cite the activated staging R1 revision');
    expected.acknowledgedUnmapped = expected.acknowledgedUnmapped.filter(
      (r) => !(isPending(r) && r.providerValue === key),
    );
  }
  if (!same(document, expected)) throw Error('Unreviewed P0 change: ' + path);
}

/**
 * The reviewed identity corpus, read from git at its pinned commits (never the
 * working tree). `r0` (default) is the historical R0 seed corpus;
 * `p0`, the current repository corpus, is R0 plus exactly the
 * reviewed Rafael Câmara identity, binding and
 * dataset version.
 */
export function loadCorpus(profile = 'r0') {
  if (profile !== 'r0' && profile !== 'p0') throw Error('Unknown corpus');
  if (profile === 'p0' && !/^[0-9a-f]{40}$/.test(P0_REVIEWED_COMMIT))
    throw Error('P0 commit is not pinned');
  // Refuses a checkout that does not descend from the pinned commits,
  // including a shallow clone that lacks them.
  for (const commit of profile === 'r0'
    ? [R0_REVIEWED_BASE_COMMIT, R0_EVIDENCE_COMMIT]
    : [R0_REVIEWED_BASE_COMMIT, R0_EVIDENCE_COMMIT, P0_REVIEWED_COMMIT])
    git('merge-base', '--is-ancestor', commit, 'HEAD');
  return Object.entries(spec)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([path, kind]) => {
      let commit = P0_REVIEWED_COMMIT;
      let exactCommit = P0_REVIEWED_COMMIT;
      let baseCommit = P0_REVIEWED_COMMIT;
      if (profile === 'r0') {
        const r0 = r0Document(path, kind);
        commit = r0.commit;
        baseCommit = R0_REVIEWED_BASE_COMMIT;
        exactCommit = 'exactCommit' in r0 ? r0.exactCommit : commit;
      }
      const bytes = show(commit, path);
      const text = decode(bytes);
      const document = JSON.parse(text);
      if (document.kind !== kind)
        throw Error('Unexpected source kind: ' + path);
      if (profile === 'p0') p0Check(path, kind, document);
      return {
        path,
        text,
        fileHash: sha(bytes),
        documentVersion:
          document.schemaVersion ?? document.datasetVersion ?? null,
        sourceStatus: document.status,
        exactCommit,
        baseCommit,
      };
    });
}
