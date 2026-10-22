# CI workflows

GitHub Actions pipelines for GridView.

Workflows (see `../../docs/technical/GridView_TRD.md` section 34):

- `automation-monitor.yml` (manual only) - the outside-in monitor of the
  automatic updates (ADR 0028 D9): three public GETs, no secret. Its hourly
  `schedule:` is a separately authorized step (AU-5).
- `au3-e2e-observer.yml` (temporary) - gate AU-3's daytime observer for the
  replay on 2026-11-05 only: the same monitor plus ten public reads of the
  e2e host, kept as 90-day artifacts; no secret, read-only. A date guard
  makes it send nothing on any other day. Merging it is its activation, and
  it is removed with the e2e unschedule PR (`docs/release/automatic-updates.md`
  section 8.2).
- `pull_request.yml` (active) - runs on pull requests and pushes to master:
  Flutter format/analyze/test + dev debug APK, edge API
  typecheck/lint/format/test, and a gitleaks secret scan. Uses no private
  secrets and builds only debug artifacts with standard debug signing.
- `main.yml` (planned) - staging artifacts.
- `release_candidate.yml` (planned) - production configuration validation
  and signed AAB build.

## Pinned toolchains

Both toolchains are pinned to an exact version, and the pin applies to the
executable that actually runs - not to descriptive metadata.

- **Flutter**: read from `.fvmrc` and passed to `subosito/flutter-action`, so
  CI and developer machines resolve the same SDK from one source.
- **npm** (edge API job): `node-version: 22` pins Node but says nothing about
  npm, and the npm bundled with Node 22 moved 10.9.4 -> 10.9.7 -> 10.9.8 across
  its patch releases. The job therefore installs **npm 10.9.9** globally after
  Node setup and asserts `npm --version` before `npm ci`, failing the job if the
  assertion does not hold. 10.9.9 was the latest published npm 10 release when
  this pin was established on 2026-08-13, and it is the exact version
  `services/edge-api/package-lock.json` was resolved under, so the resolver that
  writes the lockfile and the one that installs it are the same.

Regenerate `services/edge-api/package-lock.json` only with that same version
(`npx --yes npm@10.9.9 install --package-lock-only`). npm 11 computes different
hoisting and, on Windows, prunes optional platform-transitive dependencies Linux
needs; `npm ci` still succeeds locally with the resulting lockfile, so the
breakage only surfaces on CI. That is how master broke once already, repaired in
`f2183ba`.
