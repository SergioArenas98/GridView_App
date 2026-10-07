# Season batch generator (offline, dormant)

Turns one **recorded** capture of Jolpica responses into a deterministic,
reviewable season artifact and manifest. It applies exactly the normalization,
curated mappings, assembly and validation rules the Worker's coordinated
runtime applies. Implementation Plan §14.0.46.

```text
npm run season-batch:generate -- --capture <capture-dir> --out <new-output-dir>
```

## What it never does

- **It sends no request.** The only transport replays the capture's recorded
  bodies. The CLI also disables `fetch` before loading the generator.
- **It reads no credential.** Its source reads no environment variable. The
  `git` child process it starts for provenance, and esbuild, inherit the
  environment as any process does.
- **It publishes nothing and is not an ingest.** Nothing here reaches the
  Worker, KV, a Durable Object or staging.
- **It is not part of the Worker bundle.** No `src` file imports it, and the
  dry-run bundle is unchanged.
- **It does not authorize a provider capture.** Recording a capture from the
  real provider is a separate, separately authorized step. No tool for it
  exists in this repository.

The capture directory and the output directory must both be **outside this
repository**, so a private capture or generated data cannot be staged by
accident. Both paths are compared after resolving symbolic links, junctions
and short names, so a link into the repository is refused. The output
directory must not exist, or must be empty. Both files are written, or
neither: a lone artifact left by a failed manifest write is removed.

Every file is read within a strict byte bound, on one open handle and
into a buffer allocated for that bound. `capture.json` must be at most
1 MiB. Each body must be at most its declared `byteLength`, which is itself
capped at the HTTP client's 2 MiB response limit. A larger file is
refused as `capture-manifest-oversized` or `capture-body-oversized`. It is
never read in full, and nothing is written. There is no stat-then-read, so
replacing a file between the two cannot bypass the bound.

The CLI prints the summary and the capture digest. Check that digest against
the capture you meant to replay: `capture.json` has no external integrity
anchor of its own.

## Capture format

`<capture-dir>/capture.json`, plus exactly the body files it names, and
nothing else:

```json
{
  "kind": "gridview-jolpica-capture",
  "schemaVersion": 1,
  "season": 2026,
  "observedAt": "2026-03-16T12:00:00.000Z",
  "classificationRounds": [1, 2, 3],
  "responses": [
    {
      "url": "https://api.jolpi.ca/ergast/f1/2026/races/?limit=100",
      "status": 200,
      "contentType": "application/json; charset=utf-8",
      "file": "calendar.json",
      "byteLength": 4312,
      "sha256": "<64 hex>"
    }
  ]
}
```

- **`observedAt`** is the instant the capture was complete. Every
  clock-dependent rule runs at that instant.
- **`classificationRounds`** must be exactly the rounds whose race anchor is
  at least five hours old at `observedAt`. That is the runtime's
  `isEligible` rule.
- **`responses`** holds:
  - the six season-level requests: races, circuits, drivers, constructors,
    driver standings and constructor standings;
  - one `/{round}/results/?limit=100` per classification round;
  - each URL exactly as the hardened HTTP client builds it.

## Fail-closed checks

The first problem refuses the whole capture with one closed reason (exit 1),
and no file is written:

| Stage        | Refusal                                                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Manifest     | Malformed manifest, an unknown field, a URL outside `https://api.jolpi.ca/ergast/f1/{season}/`, a repeated URL or file        |
| Body files   | A missing, extra, non-regular or oversized body file, a size or SHA-256 mismatch, any non-200 recording                       |
| Replay       | A request with no recording, a recording requested twice, a recording never requested                                         |
| Coordination | A run that did not complete. Every resource is selected only from a payload the ports validated (ADR 0024).                   |
| Assembly     | Any assembly gap: unavailable resource, missing round classification, A3.5 standings incoherence, inconsistent references     |
| Eligibility  | Declared rounds ≠ eligible rounds at `observedAt`                                                                             |
| Output       | Snapshot generation failure, a runtime snapshot validator issue, an invalid D14/D15 participation guard, a duplicate document |

## Output

Both files are canonical JSON: keys sorted by UTF-8 byte order, two-space
indentation, LF line endings and one trailing newline. The same capture,
commit and curated content always yield byte-identical files.

- **`artifact.json`** (`gridview-season-batch`) contains:
  - `release`: the version label, `generatedAt`, `sourceUpdatedAt`, and the
    curated content and attribution versions;
  - the assembled `source`;
  - every generated snapshot document, sorted by name.

  `source` regenerates exactly those documents through `generateSnapshotSet`.
  The artifact carries no provenance, so the same capture yields the same
  artifact from any commit that produces the same data.

- **`manifest.json`** (`gridview-season-batch-manifest`) contains:
  - `use: "review-only"` and `review.status: "unreviewed"`;
  - the generator commit and whether the tree was clean;
  - each recorded response's URL, status, size and SHA-256, and the capture
    digest;
  - the artifact's SHA-256;
  - per-document SHA-256s, counts, the classified rounds and the
    participation fact count;
  - the Jolpica attribution record it is credited under.

The generator refuses a dirty working tree unless `--allow-dirty-tree` is
passed, and records that choice as `treeClean: false`.

## How the artifact differs from a Worker publication

The documents follow the same rules, but not every byte matches what the
Worker would publish for the same responses:

- The release label is `<observedAt>-batch`. The runtime uses
  `<clock>-coordinated`, and the sequencer assigns the committed version at
  `prepare` anyway.
- `generatedAt` and `sourceUpdatedAt` are both `observedAt`. The runtime takes
  `generatedAt` from its clock. It takes `sourceUpdatedAt` from
  `nextOrderingInput`, which never goes backwards past the season's last
  ordering input.
- So every document's `meta` differs. A future ingest regenerates its
  documents from `source` with its own instants. It does not publish these
  documents.
- The plan is the runtime's publication plan as a manual run: every eligible
  round, with no cadence slots. The runtime builds its plan from anchors kept
  in the ledger.

## What it does not apply

The runtime accepts a classification only after several checks, using the
reconciliation ledger's history: settling confirmations, staged corrections
and review locks. A single capture has no such history. **Human review of the
manifest stands in for it.** The D14-D16 publication guard still applies to
any future guarded publication.

Generated data is derived from Jolpica F1 (CC BY-NC-SA 4.0). Keep it private
until its use is decided.
