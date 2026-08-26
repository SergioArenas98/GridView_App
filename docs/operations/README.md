# Operations documentation

Operational documentation for GridView.

- `GridView_Staging_Edge_Runbook.md` — Cloudflare **staging** deployment of the
  edge API: account selection, config, secrets, deploy/dry-run, initial sync,
  public smoke, ETag/HEAD/304, admin-security, rollback, observability/redaction,
  scheduled handler, KV eventual-consistency and cache-purge limitations,
  Flutter staging run, and production prerequisites.

- `GridView_Provider_Mapping_Guide.md` — the curated provider-identifier
  mapping registry: how an unmapped-identity signal is detected and read, how
  to verify the intended GridView identity against the canonical registry, how
  to add a mapping or an intentional alias without changing a public ID, how a
  genuinely new entity is handled, how wrong mappings are corrected through
  code review, why duplicate/ambiguous/dangling records fail closed, which
  checks must run, and why string similarity and slug minting are forbidden.
  **Dormant:** no adapter consumes the registry yet.

Planned:

- Incident runbook.
- Release checklist.
- Legacy shutdown record.
- Synchronization and quota monitoring notes.

See `../technical/GridView_Backend_Scheme.md` (section 35) for the minimum
runbook scenarios.
