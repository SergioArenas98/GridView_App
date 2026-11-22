// U11 G4 offline catalog-parity comparison (comparison policy §3.3).
//
//   node scripts/identity/parity-compare.mjs --a1 <dir> --a2 <dir> \
//     --b1 <dir> --b2 <dir> --export <staging-export.json>
//
// Read-only. Reads two runs of side A (bundled authority) and two runs of
// side B (runtime authority from the verified staging export), each an
// output directory of `npm run season-batch:generate`, plus the export file.
// Sends no request, reads no credential and writes nothing; it prints one
// JSON verdict. Exit codes: 0 parity, 1 difference or invalid input, 2 usage.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const usage =
  'Usage: node scripts/identity/parity-compare.mjs --a1 <dir> --a2 <dir> --b1 <dir> --b2 <dir> --export <file>';
const names = ['--a1', '--a2', '--b1', '--b2', '--export'];

export function parseArguments(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const [flag, value] = [argv[i], argv[i + 1]];
    if (!names.includes(flag) || typeof value !== 'string' || flag in out)
      return null;
    out[flag] = value;
  }
  return names.every((n) => n in out) ? out : null;
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Key-sorted JSON, so equality never depends on property order. */
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
      .join(',')}}`;
  return JSON.stringify(value);
}

function readTree(directory) {
  const artifactBytes = readFileSync(join(directory, 'artifact.json'));
  const manifestBytes = readFileSync(join(directory, 'manifest.json'));
  return {
    directory,
    artifactBytes,
    manifestBytes,
    artifact: JSON.parse(artifactBytes.toString('utf8')),
    manifest: JSON.parse(manifestBytes.toString('utf8')),
  };
}

const without = (value, keys) =>
  Object.fromEntries(Object.entries(value).filter(([k]) => !keys.includes(k)));

/** The private provenance envelope is the only intended A/B difference. */
function artifactBody(artifact) {
  return without(artifact, ['schemaVersion', 'identityCatalog']);
}
function manifestBody(manifest) {
  return {
    ...without(manifest, ['schemaVersion', 'identityCatalog', 'artifact']),
    generator: without(manifest.generator, ['schemaVersion']),
  };
}

/** Pure comparison over already-read trees; returns findings, never throws on difference. */
export function compareTrees({ a1, a2, b1, b2, exportBytes }) {
  const findings = [];
  const fail = (check, detail) => findings.push({ check, detail });
  const exported = JSON.parse(exportBytes.toString('utf8'));

  // Determinism: each side's two fresh runs are byte-identical.
  for (const [label, x, y] of [
    ['A', a1, a2],
    ['B', b1, b2],
  ])
    for (const file of ['artifactBytes', 'manifestBytes'])
      if (!x[file].equals(y[file]))
        fail('determinism', `${label} ${file} differs between runs`);

  // Each manifest commits to its own artifact bytes.
  for (const [label, t] of [
    ['A1', a1],
    ['B1', b1],
  ]) {
    if (
      t.manifest.artifact?.sha256 !== sha256(t.artifactBytes) ||
      t.manifest.artifact?.byteLength !== t.artifactBytes.byteLength
    )
      fail('manifest-artifact-commitment', label);
  }

  // Authority envelope: A is bundled v1, B is runtime v2.
  if (a1.artifact.schemaVersion !== 1 || 'identityCatalog' in a1.artifact)
    fail('side-a-authority', 'side A is not a bundled v1 artifact');
  if (b1.artifact.schemaVersion !== 2 || !b1.artifact.identityCatalog)
    fail('side-b-authority', 'side B is not a runtime v2 artifact');

  // Same code and clean tree on both sides.
  const ga = a1.manifest.generator,
    gb = b1.manifest.generator;
  if (ga?.gitCommit !== gb?.gitCommit) fail('code', 'generator commits differ');
  if (ga?.treeClean !== true || gb?.treeClean !== true)
    fail('code', 'a generator tree was not clean');

  // Request accounting: the consumed recordings (the generator refuses any
  // unrequested, repeated or unrecorded response) and classified rounds.
  if (canonical(a1.manifest.capture) !== canonical(b1.manifest.capture))
    fail('request-accounting', 'capture accounting differs');

  // Every generated public document, by name, byte for byte (canonical).
  const docs = (t) =>
    new Map(t.artifact.documents.map((d) => [d.documentName, canonical(d)]));
  const da = docs(a1),
    db = docs(b1);
  const documentDiffs = [...new Set([...da.keys(), ...db.keys()])]
    .filter((n) => da.get(n) !== db.get(n))
    .sort();
  if (documentDiffs.length) fail('documents', documentDiffs);

  // Season source (resolution, profiles, participants, results, standings).
  for (const key of Object.keys(a1.artifact.source ?? {}))
    if (
      canonical(a1.artifact.source[key]) !==
      canonical(b1.artifact.source?.[key])
    )
      fail('source', key);
  if (
    canonical(artifactBody(a1.artifact)) !==
    canonical(artifactBody(b1.artifact))
  )
    fail('artifact-body', 'artifact differs outside the provenance envelope');
  if (
    canonical(manifestBody(a1.manifest)) !==
    canonical(manifestBody(b1.manifest))
  )
    fail('manifest-body', 'manifest differs outside the provenance envelope');

  // The v2 reference block equals the verified export, in both B files.
  const ref = b1.artifact.identityCatalog ?? {};
  if (canonical(ref) !== canonical(b1.manifest.identityCatalog ?? null))
    fail('reference', 'artifact and manifest identityCatalog blocks differ');
  const expected = {
    installationId: exported.installationId,
    revisionId: exported.revision?.revisionId,
    catalogHash: exported.revision?.contentHash,
    exportSha256: exported.exportHash,
    inventoryPolicy: 'strict-v1',
  };
  for (const [k, v] of Object.entries(expected))
    if (ref[k] !== v) fail('reference', `identityCatalog.${k}`);
  if (ref.datasetVersion !== a1.artifact.release?.contentVersion)
    fail('reference', 'identityCatalog.datasetVersion');

  return {
    findings,
    facts: {
      exportFileSha256: sha256(exportBytes),
      exportHash: exported.exportHash,
      revisionId: exported.revision?.revisionId,
      gitCommit: ga?.gitCommit ?? null,
      documentCount: a1.artifact.documents.length,
      consumedResponses: a1.manifest.capture?.responses?.length ?? null,
      sideA: {
        artifactSha256: sha256(a1.artifactBytes),
        manifestSha256: sha256(a1.manifestBytes),
      },
      sideB: {
        artifactSha256: sha256(b1.artifactBytes),
        manifestSha256: sha256(b1.manifestBytes),
      },
      reference: ref,
    },
  };
}

function main() {
  const parsed = parseArguments(process.argv.slice(2));
  if (!parsed) {
    process.stderr.write(usage + '\n');
    process.exit(2);
  }
  globalThis.fetch = () => {
    throw new Error('parity-compare never sends a request');
  };
  let result;
  try {
    result = compareTrees({
      a1: readTree(parsed['--a1']),
      a2: readTree(parsed['--a2']),
      b1: readTree(parsed['--b1']),
      b2: readTree(parsed['--b2']),
      exportBytes: readFileSync(parsed['--export']),
    });
  } catch (error) {
    process.stdout.write(
      JSON.stringify({
        verdict: 'invalid-input',
        reason: String(error?.message ?? error).slice(0, 200),
      }) + '\n',
    );
    process.exit(1);
  }
  const verdict = result.findings.length === 0 ? 'parity' : 'difference';
  process.stdout.write(JSON.stringify({ verdict, ...result }, null, 2) + '\n');
  process.exit(verdict === 'parity' ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main();
