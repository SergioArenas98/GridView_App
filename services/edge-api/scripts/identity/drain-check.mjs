// U11 G5 hold-and-drain evaluation over saved G0 admin reads.
//
//   node scripts/identity/drain-check.mjs --g0 <dir> [--now <ISO instant>]
//
// Read-only and offline. Reads the newest CutoverStatus-*.txt, SyncStatus-*.txt
// and Inspect-*.txt files written by the operator's GET-only G0 helper (first
// line: the request line; rest: the JSON body). Sends no request, reads no
// credential, writes nothing. Prints one JSON verdict.
//
// It judges only what those three reads expose. Conditions they cannot show
// are listed under `notObservable` and are never assumed to hold.
// Exit codes: 0 drained, 1 not drained or invalid input, 2 usage.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const notObservable = [
  'sequencer finalize outcomes recorded as uncertain',
  'season-batch ingest receipts with unknown completion',
  'pending publication recovery inside the sequencer',
];

/** Pure evaluation of the three response bodies' `data` objects. */
export function evaluateDrain({ cutover, sync, inspect }, now) {
  const checks = [];
  const add = (name, ok, detail = null) => checks.push({ name, ok, detail });
  add(
    'operator-hold-applied',
    inspect.operatorHold !== null && typeof inspect.operatorHold === 'object',
    inspect.operatorHold,
  );
  add('no-durable-block', inspect.durableBlock === null, inspect.durableBlock);
  add(
    'no-publication-disposition',
    inspect.publicationDisposition === null,
    inspect.publicationDisposition,
  );
  // A missing section is never read as "nothing there".
  const lease = inspect.lease;
  add(
    'lease-released-or-expired',
    lease === null ||
      lease?.state === 'released' ||
      (typeof lease?.expiresAt === 'string' &&
        Date.parse(lease.expiresAt) <= now),
    lease,
  );
  add(
    'backlog-empty',
    Array.isArray(inspect.backlog?.entries) &&
      inspect.backlog.entries.length === 0,
    inspect.backlog?.entries?.length ?? null,
  );
  const rounds = Array.isArray(inspect.rounds) ? inspect.rounds : null;
  const pending = (rounds ?? [])
    .filter((r) => r.stagedCorrection != null || r.competingCorrection != null)
    .map((r) => r.round);
  add(
    'no-pending-corrections',
    rounds !== null && pending.length === 0,
    rounds === null ? 'rounds missing' : pending,
  );
  const s = sync.sync;
  add('sync-status-present', s !== null && typeof s === 'object', null);
  const ended = [s?.lastCompletedAt, s?.lastFailedAt]
    .filter((v) => typeof v === 'string')
    .map(Date.parse);
  add(
    'no-sync-in-progress',
    typeof s?.lastStartedAt !== 'string' ||
      (ended.length > 0 && Math.max(...ended) >= Date.parse(s.lastStartedAt)),
    { lastStartedAt: s?.lastStartedAt ?? null },
  );
  add(
    'sequencer-authoritative',
    cutover.state === 'active' &&
      cutover.authoritative === true &&
      cutover.admissionClosed === false,
    { state: cutover.state, activeVersion: cutover.activeVersion ?? null },
  );
  return {
    drained: checks.every((c) => c.ok),
    checks,
    notObservable,
  };
}

export const maximumSpreadMs = 120000;
export const maximumAgeMs = 600000;

/** The three reads were taken together and recently enough to judge. */
export function freshness(instants, now) {
  const times = instants.map((t) => Date.parse(t));
  const ok =
    times.every(Number.isFinite) &&
    Math.max(...times) - Math.min(...times) <= maximumSpreadMs &&
    now - Math.max(...times) <= maximumAgeMs &&
    now >= Math.max(...times);
  return { name: 'reads-fresh-and-coherent', ok, detail: instants };
}

/** Body of the newest `<op>-*.txt` file in a G0 output directory. */
export function readG0(directory, op) {
  const file = readdirSync(directory)
    .filter((n) => n.startsWith(op + '-') && n.endsWith('.txt'))
    .sort()
    .pop();
  if (!file) throw new Error(`missing ${op} read`);
  const lines = readFileSync(join(directory, file), 'utf8')
    .replace(new RegExp('^' + String.fromCharCode(0xfeff)), '')
    .split(/\r?\n/);
  if (!/ HTTP 200$/.test(lines[0])) throw new Error(`${op} was not HTTP 200`);
  const at = / start=(\S+) /.exec(lines[0])?.[1];
  if (!at) throw new Error(`${op} read has no start instant`);
  return { file, at, data: JSON.parse(lines.slice(1).join('\n')).data };
}

function main() {
  const args = process.argv.slice(2);
  const g0 = args[0] === '--g0' ? args[1] : undefined;
  const nowArg = args[2] === '--now' ? args[3] : undefined;
  if (!g0 || (args.length !== 2 && !(args.length === 4 && nowArg))) {
    process.stderr.write(
      'Usage: node scripts/identity/drain-check.mjs --g0 <dir> [--now <ISO instant>]\n',
    );
    process.exit(2);
  }
  const now = nowArg ? Date.parse(nowArg) : Date.now();
  let result;
  try {
    if (!Number.isFinite(now)) throw new Error('invalid --now');
    const reads = Object.fromEntries(
      ['CutoverStatus', 'SyncStatus', 'Inspect'].map((op) => [
        op,
        readG0(g0, op),
      ]),
    );
    const evaluated = evaluateDrain(
        {
          cutover: reads.CutoverStatus.data,
          sync: reads.SyncStatus.data,
          inspect: reads.Inspect.data,
        },
        now,
      ),
      fresh = freshness(
        Object.values(reads).map((r) => r.at),
        now,
      );
    result = {
      at: new Date(now).toISOString(),
      files: Object.values(reads).map((r) => r.file),
      ...evaluated,
      drained: evaluated.drained && fresh.ok,
      checks: [...evaluated.checks, fresh],
    };
  } catch (error) {
    process.stdout.write(
      JSON.stringify({ drained: false, invalid: String(error?.message) }) +
        '\n',
    );
    process.exit(1);
  }
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(result.drained ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main();
