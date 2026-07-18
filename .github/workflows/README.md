# CI workflows

GitHub Actions pipelines for GridView.

Workflows (see `../../docs/technical/GridView_TRD.md` section 34):

- `pull_request.yml` (active) - runs on pull requests and pushes to master:
  Flutter format/analyze/test + dev debug APK, edge API
  typecheck/lint/format/test, and a gitleaks secret scan. Uses no private
  secrets and builds only debug artifacts with standard debug signing.
- `main.yml` (planned) - staging artifacts.
- `release_candidate.yml` (planned) - production configuration validation
  and signed AAB build.
