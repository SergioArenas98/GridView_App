// Workers KV snapshot and restore (U11 G5 recovery). Workers KV has no
// point-in-time recovery, so its recovery path is an exported snapshot.
//
//   node scripts/recovery/kv-snapshot.mjs snapshot --namespace <id> --out <new file>
//   node scripts/recovery/kv-snapshot.mjs restore  --snapshot <file> --namespace <id> --confirm-target <id>
//   node scripts/recovery/kv-snapshot.mjs verify   --snapshot <file> --namespace <id>
//
// `snapshot` and `verify` only read (key listing plus bulk value reads).
// `restore` writes, and refuses: the snapshot's own source namespace, every
// namespace committed in wrangler.toml (staging, production, E2E), and a
// target not repeated in --confirm-target. Restoring a committed namespace
// therefore needs a reviewed change to this tool, never a flag. Any other
// target must carry the title prefix "gridview-recovery-drill".
// The Cloudflare OAuth token comes from `wrangler auth token` in memory and is
// never printed or written. Values are stored as text with per-key SHA-256.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ACCOUNT = '786e24f1c137661ce01035393acee6bf';
const API = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/storage/kv/namespaces`;
const here = dirname(fileURLToPath(import.meta.url));
const idPattern = /^[0-9a-f]{32}$/;

export const sha256 = (text) => createHash('sha256').update(text).digest('hex');

/** Namespace IDs committed in wrangler.toml: never a restore target. */
export function protectedNamespaces(toml) {
  return [...toml.matchAll(/^id = "([0-9a-f]{32})"/gm)].map((m) => m[1]);
}

/** Canonical per-entry digest, and the snapshot digest over sorted entries. */
export function entryDigest(e) {
  return sha256(
    JSON.stringify([e.key, e.value, e.metadata ?? null, e.expiration ?? null]),
  );
}
export function snapshotDigest(entries) {
  return sha256(
    [...entries]
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
      .map((e) => e.key + '\n' + entryDigest(e))
      .join('\n'),
  );
}

/** Differences between a snapshot and a re-read namespace (keys only). */
export function compareEntries(expected, actual) {
  const a = new Map(actual.map((e) => [e.key, entryDigest(e)]));
  const missing = [],
    changed = [];
  for (const e of expected) {
    if (!a.has(e.key)) missing.push(e.key);
    else if (a.get(e.key) !== entryDigest(e)) changed.push(e.key);
  }
  const known = new Set(expected.map((e) => e.key));
  const extra = actual.map((e) => e.key).filter((k) => !known.has(k));
  return { missing, changed, extra };
}

/** Only namespaces titled for recovery drills may be restored into. */
export const restorableTitlePrefix = 'gridview-recovery-drill';

export function restoreRefusal({
  snapshot,
  target,
  confirm,
  protectedIds,
  targetTitle,
}) {
  if (!idPattern.test(target ?? '')) return 'invalid-target';
  if (confirm !== target) return 'target-not-confirmed';
  if (target === snapshot.namespaceId) return 'target-is-snapshot-source';
  if (protectedIds.includes(target)) return 'target-is-committed-namespace';
  // Allowlist, not only a denylist: an uncommitted namespace holding real
  // data is refused unless its Cloudflare title marks it as a drill target.
  if (
    typeof targetTitle !== 'string' ||
    !targetTitle.startsWith(restorableTitlePrefix)
  )
    return 'target-not-a-drill-namespace';
  return null;
}

/** Refuses values that did not survive text decoding (binary content). */
export function assertLosslessText(value) {
  if (typeof value !== 'string' || value.includes('\uFFFD'))
    throw new Error(
      'value is not lossless UTF-8 text; a binary-safe snapshot is required',
    );
  return value;
}

function token() {
  const raw = execFileSync('npx.cmd wrangler auth token --json', {
    cwd: join(here, '..', '..'),
    encoding: 'utf8',
    shell: true,
    stdio: ['ignore', 'pipe', 'ignore'],
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  });
  const t = JSON.parse(raw.slice(raw.indexOf('{'))).token;
  if (!t) throw new Error('no OAuth token');
  return t;
}

async function api(auth, method, path, body) {
  const r = await fetch(API + path, {
    method,
    headers: {
      Authorization: `Bearer ${auth}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.success)
    throw new Error(`KV API ${method} ${path.split('?')[0]} -> ${r.status}`);
  return j;
}

async function readAll(auth, namespace) {
  const keys = [];
  let cursor = '';
  do {
    const j = await api(
      auth,
      'GET',
      `/${namespace}/keys?limit=1000${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
    );
    keys.push(...j.result);
    cursor = j.result_info?.cursor ?? '';
  } while (cursor);
  const entries = [];
  for (let i = 0; i < keys.length; i += 100) {
    const batch = keys.slice(i, i + 100);
    const j = await api(auth, 'POST', `/${namespace}/bulk/get`, {
      keys: batch.map((k) => k.name),
      type: 'text',
      withMetadata: true,
    });
    for (const k of batch) {
      const v = j.result.values[k.name];
      if (v === undefined || v === null)
        throw new Error('value missing for a listed key');
      const value = assertLosslessText(
        typeof v === 'object' && 'value' in v ? v.value : v,
      );
      const metadata =
        typeof v === 'object' && 'metadata' in v
          ? (v.metadata ?? null)
          : (k.metadata ?? null);
      entries.push({
        key: k.name,
        value,
        metadata,
        expiration: k.expiration ?? null,
      });
    }
  }
  return entries;
}

function argument(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

async function main() {
  const [mode, ...argv] = process.argv.slice(2);
  const namespace = argument(argv, '--namespace');
  if (!idPattern.test(namespace ?? ''))
    throw new Error('--namespace <32-hex id> is required');
  const auth = token();
  if (mode === 'snapshot') {
    const out = argument(argv, '--out');
    if (!out) throw new Error('--out is required');
    const entries = (await readAll(auth, namespace)).map((e) => ({
      ...e,
      sha256: entryDigest(e),
    }));
    const snapshot = {
      format: 'gridview-kv-snapshot/1',
      namespaceId: namespace,
      takenAt: new Date().toISOString(),
      keyCount: entries.length,
      digest: snapshotDigest(entries),
      entries,
    };
    writeFileSync(out, JSON.stringify(snapshot), { flag: 'wx' });
    console.log(
      JSON.stringify({
        mode,
        keyCount: entries.length,
        digest: snapshot.digest,
      }),
    );
    return;
  }
  const snapshot = JSON.parse(
    readFileSync(argument(argv, '--snapshot'), 'utf8'),
  );
  if (snapshot.format !== 'gridview-kv-snapshot/1')
    throw new Error('not a gridview KV snapshot');
  if (snapshotDigest(snapshot.entries) !== snapshot.digest)
    throw new Error('snapshot digest mismatch');
  if (mode === 'restore') {
    const info = await api(auth, 'GET', `/${namespace}`);
    const refusal = restoreRefusal({
      snapshot,
      target: namespace,
      targetTitle: info.result?.title,
      confirm: argument(argv, '--confirm-target'),
      protectedIds: protectedNamespaces(
        readFileSync(join(here, '..', '..', 'wrangler.toml'), 'utf8'),
      ),
    });
    if (refusal) throw new Error('restore refused: ' + refusal);
    for (let i = 0; i < snapshot.entries.length; i += 5000) {
      const batch = snapshot.entries.slice(i, i + 5000).map((e) => ({
        key: e.key,
        value: e.value,
        ...(e.metadata !== null ? { metadata: e.metadata } : {}),
        ...(e.expiration !== null ? { expiration: e.expiration } : {}),
      }));
      await api(auth, 'PUT', `/${namespace}/bulk`, batch);
    }
    console.log(
      JSON.stringify({
        mode,
        written: snapshot.entries.length,
        target: namespace,
      }),
    );
    return;
  }
  if (mode === 'verify') {
    const actual = await readAll(auth, namespace);
    const diff = compareEntries(snapshot.entries, actual);
    const ok =
      !diff.missing.length && !diff.changed.length && !diff.extra.length;
    console.log(
      JSON.stringify({
        mode,
        verdict: ok ? 'identical' : 'different',
        expected: snapshot.entries.length,
        actual: actual.length,
        actualDigest: snapshotDigest(actual),
        snapshotDigest: snapshot.digest,
        missing: diff.missing.length,
        changed: diff.changed.length,
        extra: diff.extra.length,
      }),
    );
    process.exitCode = ok ? 0 : 1;
    return;
  }
  throw new Error('mode must be snapshot, restore or verify');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((e) => {
    console.error(String(e.message ?? e));
    process.exit(1);
  });
