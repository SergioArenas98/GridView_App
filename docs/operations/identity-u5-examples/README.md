# Synthetic U5 review files

Every file uses synthetic identities and deliberately unusable hashes and head
pointers. They contain **no credential**. They are templates for local validation,
not ready-to-submit approvals. Do not submit them to a real environment.

From `services/edge-api`, for example:

```powershell
npm run identity -- approve-existing --file '..\..\docs\operations\identity-u5-examples\approve-existing.json' --check
npm run identity -- approve-new --file '..\..\docs\operations\identity-u5-examples\approve-new.json' --check
npm run identity -- candidate disposition 'sha256:2222222222222222222222222222222222222222222222222222222222222222' --file '..\..\docs\operations\identity-u5-examples\quarantine.json' --check
npm run identity -- validate '55555555-5555-4555-8555-555555555555' --file '..\..\docs\operations\identity-u5-examples\validation.json' --check
npm run identity -- activate '55555555-5555-4555-8555-555555555555' --file '..\..\docs\operations\identity-u5-examples\activation.json' --check
```

`evidence-existing.json` demonstrates a dossier associating an exact synthetic
provider key with an existing synthetic canonical driver. Dossier creation
returns the next candidate version and evidence head; copy those actual values
into a separately reviewed approval. `approve-new.json` demonstrates an explicitly
chosen new canonical ID, profile and full-catalog duplicate-review attestation.
`evidence-new.json` supplies the corresponding synthetic new-person dossier;
use its returned ID/version/head when preparing that separate approval.
`reject.json` and `quarantine.json` demonstrate distinct reasons without resolving
any required race row. `validation.json` and `activation.json` are separate
operations. Activation changes the catalog, **not published race results**.

See the [PowerShell operator guide](../GridView_Identity_Admin_U5_Guide.md) for
secure authentication, the full workflow and uncertain-response recovery.
