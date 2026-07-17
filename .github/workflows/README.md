# CI workflows

GitHub Actions pipelines for GridView.

Planned workflows (see `../../docs/technical/GridView_TRD.md` section 34):

- `pull_request.yml` - formatting, analysis, tests, dev Android build,
  secret scan.
- `main.yml` - full checks plus staging artifacts.
- `release_candidate.yml` - production configuration validation and signed
  AAB build.

Status: created in Phase 1 (CI quality gates) of the Implementation Plan.
