# GridView - Frozen-data test APK runbook

Status: procedure only. **Nothing in this runbook has been run against real
data.** The capture in step 2 contacts Jolpica and needs its own explicit
authorization each time.

## What this APK is

A **staging-flavor debug APK** (`com.sejuma.gridview.staging`) built with
`DATA_SOURCE=fixture`, whose bundled fixtures are replaced by one converted,
reviewed Jolpica capture.

- **It shows a fixed snapshot and receives no live updates.** It talks to no
  GridView service and to no provider. Every screen shows the season exactly
  as it was at the capture instant, for as long as the APK is installed.
  Because each document's `staleAfter` is 15 minutes after the capture, the
  app also marks the data as stale.
- It is labelled on every data screen as **"Frozen test data captured
  <date> — not live, no updates"**, and Settings → Data source shows "Frozen
  test data captured <date>".
- Acknowledgements credit Jolpica F1 for the snapshot, with the CC BY-NC-SA
  4.0 licence, modification and non-endorsement notices and links.
- It is a test build for the owner's own device. It is **not** a release, not
  signed with the release key, and not for Google Play. Its data is Adapted
  Material under CC BY-NC-SA 4.0: keep the APK and every intermediate file
  private, and decide on any sharing separately.

The normal app is unchanged: production never serves fixtures, a normal
fixture build is labelled "Sample data", and the bundled attribution record
still calls Jolpica `dormant`.

## Tools (all offline except step 2)

| Step | Command | Writes |
|---|---|---|
| Generate | `npm run season-batch:generate -- --capture <dir> --out <dir>` | `artifact.json`, `manifest.json` |
| Convert | `npm run season-batch:fixtures -- --batch <dir> --out <dir> --manifest-sha256 <hex> --origin provider-capture` | fixture envelopes + `frozen-dataset.json` |
| Build | `npm run season-batch:frozen-apk -- --batch <dir> --manifest-sha256 <hex> --origin provider-capture --fixtures <dir> --work <dir> --out <dir>` | APK + `build-record.json` |

All three run from `services/edge-api/` and refuse any directory inside the
repository (after resolving links and junctions). The build re-declares the
batch, the reviewed manifest SHA-256 and the origin, reconverts the batch
itself and requires the fixture directory to be exactly that conversion, so
an edited fixture, a relabelled origin or a swapped set is refused even when
its descriptor was edited to match. The converter writes all
files or none. The build exports the committed tree with `git archive` into
`--work`, replaces only `assets/dev_fixtures/` there, runs
`flutter test test/frozen_data/bundled_fixtures_test.dart` against the
injected fixtures, and then runs exactly:

```text
flutter pub get
flutter build apk --debug --flavor staging --dart-define=APP_ENV=staging --dart-define=DATA_SOURCE=fixture
```

`--prepare-only` stops after the injection, for inspection.

On Windows the build refuses a `--work` path longer than 80 characters
(`work-path-too-long`): Flutter writes intermediates about 120 characters
below it, and a deeper root breaks the 260-character path limit part-way
through Gradle. `$HOME/.gridview/frozen/<date>/work` is short enough.

`--origin` is declared, never inferred. Use `provider-capture` only for a
real, authorized capture. `synthetic` (test material) keeps the app's "Sample
data" label and credits no source.

**The origin cannot be checked from the data.** The generator accepts only
`api.jolpi.ca` URLs, so a synthetic batch and a real one look alike. A real
capture converted as `synthetic` by mistake would be labelled "Sample data",
and its Jolpica card would keep the `dormant` status line, although the card
still names Jolpica F1 with its licence, modification and non-endorsement
notices. Declare `provider-capture` in both step 5 and step 6, and check the
banner after installing (step 7).

## 1. Prepare (no network)

```bash
cd <repo>
git switch master && git pull --ff-only
git status --porcelain            # must print nothing
cd services/edge-api && npm ci && cd ../..
D="$HOME/.gridview/frozen/$(date -u +%Y-%m-%d)"   # private, outside the repo
mkdir -p "$D/capture"
```

## 2. Capture (contacts Jolpica - separately authorized)

Only after an explicit authorization for this capture. Around 22 `GET`s at
round 16; one per second keeps far inside Jolpica's published limits. No
credential is used. Use Git Bash.

```bash
UA='GridView/1.0 (+https://github.com/SergioArenas98/GridView_App)'
B='https://api.jolpi.ca/ergast/f1/2026'
cd "$D/capture"
get() { curl -sS --fail -A "$UA" -D "$1.headers" -o "$1" "$2" || return; sleep 1; }
get calendar.json              "$B/races/?limit=100" || exit 1
get circuits.json              "$B/circuits/?limit=100" || exit 1
get drivers.json               "$B/drivers/?limit=100" || exit 1
get constructors.json          "$B/constructors/?limit=100" || exit 1
get driver-standings.json      "$B/driverstandings/?limit=100" || exit 1
get constructor-standings.json "$B/constructorstandings/?limit=100" || exit 1
```

Then fetch the race results of **exactly** the rounds whose race started at
least five hours before the capture is complete (the runtime's `isEligible`
rule). This lists them from the calendar just fetched:

```bash
ROUNDS=$(node -e '
  const races = JSON.parse(require("fs").readFileSync("calendar.json","utf8")).MRData.RaceTable.Races;
  const cutoff = Date.now() - 5 * 3600 * 1000;
  console.log(races.filter(r => Date.parse(`${r.date}T${r.time ?? "00:00:00Z"}`) <= cutoff).map(r => r.round).join(" "));')
echo "$ROUNDS"
for r in $ROUNDS; do get "results-$(printf %02d "$r").json" "$B/$r/results/?limit=100" || exit 1; done
```

Write `capture.json` from what was received, with `observedAt` set now that
the capture is complete, and remove the header files:

```bash
node -e '
  const fs = require("fs"), crypto = require("crypto");
  const B = "https://api.jolpi.ca/ergast/f1/2026";
  const fixed = {"calendar.json":"races","circuits.json":"circuits","drivers.json":"drivers",
    "constructors.json":"constructors","driver-standings.json":"driverstandings",
    "constructor-standings.json":"constructorstandings"};
  const rounds = process.argv[1].split(" ").filter(Boolean).map(Number);
  const files = [...Object.keys(fixed), ...rounds.map(r => `results-${String(r).padStart(2,"0")}.json`)];
  const responses = files.map(file => {
    const headers = fs.readFileSync(file + ".headers", "utf8").split(/\r?\n/);
    const status = Number(headers[0].split(" ")[1]);
    const type = headers.find(h => /^content-type:/i.test(h)).split(":").slice(1).join(":").trim();
    const body = fs.readFileSync(file);
    const path = fixed[file] ?? `${Number(file.slice(8, 10))}/results`;
    return { url: `${B}/${path}/?limit=100`, status, contentType: type, file,
      byteLength: body.length, sha256: crypto.createHash("sha256").update(body).digest("hex") };
  });
  fs.writeFileSync("capture.json", JSON.stringify({ kind: "gridview-jolpica-capture", schemaVersion: 1,
    season: 2026, observedAt: new Date().toISOString(), classificationRounds: rounds, responses }, null, 2));
' "$ROUNDS"
rm -f ./*.headers
ls                       # capture.json plus exactly the body files
```

If a request fails, stop. Do not retry in a loop or edit a body: discard the
directory and start again under the same authorization only if it allows it.

## 3. Generate (offline)

```bash
cd <repo>/services/edge-api
npm run season-batch:generate -- --capture "$D/capture" --out "$D/batch"
sha256sum "$D/batch/manifest.json" "$D/batch/artifact.json"
```

Any refusal (`classification-rounds-mismatch`, `assembly-withheld`, a digest
mismatch, ...) means the capture is not usable. Do not edit it to fit.

## 4. Review (owner, before converting)

Read `$D/batch/manifest.json` and check:

1. `generator.treeClean` is `true` and `generator.gitCommit` is the `master`
   commit you meant to use.
2. `capture.observedAt` is the capture you just made, and
   `capture.classificationRounds` are the completed races you expect.
3. Every `capture.responses[].url` starts with
   `https://api.jolpi.ca/ergast/f1/2026/`, every `status` is `200`.
4. `summary` counts are plausible: 23 calendar rounds in the 2026 Jolpica
   calendar recorded on 2026-09-16, drivers and constructors as on the grid, standings non-empty
   after round 1.
5. `attribution` names Jolpica F1, `CC BY-NC-SA 4.0` and the licence URL.
6. Spot-check `artifact.json` for one finished round: winner, podium and
   championship leaders against an independent source.

Record the manifest SHA-256 you reviewed: it is the converter's
`--manifest-sha256`, and any later change to the manifest is refused.

## 5. Convert (offline)

```bash
npm run season-batch:fixtures -- --batch "$D/batch" --out "$D/fixtures" \
  --manifest-sha256 <reviewed manifest sha256> --origin provider-capture
```

It re-verifies the manifest, the artifact and every document digest, checks
that the documents regenerate exactly from the artifact's own `source`, and
validates every envelope against the OpenAPI contract. It refuses a batch
generated from a dirty tree.

## 6. Build (offline apart from Flutter and Gradle dependencies)

```bash
npm run season-batch:frozen-apk -- --batch "$D/batch" \
  --manifest-sha256 <reviewed manifest sha256> --origin provider-capture \
  --fixtures "$D/fixtures" --work "$D/work" --out "$D/apk"
```

`$D/apk/` then holds `gridview-staging-frozen-<date>-<manifest12>.apk` and
`build-record.json` (commit, descriptor SHA-256, APK SHA-256 and size). The
build stops if the bundled-fixture load test fails in the export.

## 7. Install on the phone

**Always install on a clean staging package.** The app keeps its local
database across an in-place update (`adb install -r`). A snapshot already
cached by an earlier staging or frozen build is kept whenever its
`sourceUpdatedAt` is newer than the frozen capture's, because the app
rejects older data (`SnapshotConflict`). Screens would then show that cached
data under the frozen banner. So remove the staging package, and its data,
first:

```bash
adb devices                                   # the reference phone only
adb shell pm list packages com.sejuma.gridview.staging
adb uninstall com.sejuma.gridview.staging     # only if the line above printed it
adb shell pm list packages com.sejuma.gridview.staging   # must print nothing
adb install "$D/apk/gridview-staging-frozen-<date>-<manifest12>.apk"
```

Uninstalling deletes everything the installed staging build stored. If that
installation is evidence for anything, for example a staging client
baseline, decide about it before removing it. The production app
(`com.sejuma.gridview`) is a different package and is not touched. Never use
`-r` for a frozen build, and repeat this step for every new frozen APK.

On the phone, check: the banner reads "Frozen test data captured <date> — not
live, no updates" on Home, Calendar, Standings, Explore and a Grand Prix;
Settings → Data source names the same date; Acknowledgements credits Jolpica
F1 with the frozen-snapshot status and the CC BY-NC-SA 4.0 licence.

## 8. Afterwards

- Delete `$D/work` (the export). Keep or delete `$D/capture`, `$D/batch` and
  `$D/fixtures` privately, as decided.
- Never copy any of them into the repository. The Edge API test
  `test/season-batch/tracked-data.test.ts` fails CI if a capture, batch,
  converted fixture, descriptor, build record or APK is tracked or staged.
- The APK never updates. A newer snapshot needs a new authorized capture and
  a new build.
