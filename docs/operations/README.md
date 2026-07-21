# Operations documentation

Operational documentation for GridView.

- `GridView_Staging_Edge_Runbook.md` — Cloudflare **staging** deployment of the
  edge API: account selection, config, secrets, deploy/dry-run, initial sync,
  public smoke, ETag/HEAD/304, admin-security, rollback, observability/redaction,
  scheduled handler, KV eventual-consistency and cache-purge limitations,
  Flutter staging run, and production prerequisites.

Planned:

- Incident runbook.
- Release checklist.
- Legacy shutdown record.
- Synchronization and quota monitoring notes.

See `../technical/GridView_Backend_Scheme.md` (section 35) for the minimum
runbook scenarios.
