# Identity reviews from PowerShell (U5)

U5 provides a local administration mechanism. No deployed identity API, real
credential or operational catalog is enabled by this work. The examples below
are **synthetic templates**, with deliberately unusable head/evidence hashes.
Use `--check` against them. Never submit them to staging or production.

Approval creates an immutable **proposal**. Validation creates a certificate.
Activation is a third explicit operation: it changes the identity catalog and
reserves the shown season dataset versions; it **does not publish race results**,
start synchronization or accept a classification. U6 runtime consumption is
not implemented or authorized.

## Local configuration and secure authentication

From `Gridview-jolpica-proxy/services/edge-api`:

```powershell
npm run identity -- --help
$env:GRIDVIEW_IDENTITY_URL = 'http://127.0.0.1:8787'
$env:GRIDVIEW_IDENTITY_INSTALLATION_ID = '<approved-local-installation-uuid>'
```

HTTP is accepted only on loopback; a future separately provisioned environment
must use its approved HTTPS origin. There is no automatic server startup,
credential creation, deployment or live synchronization command. U5's
isolated test Worker generates ephemeral synthetic test credentials in memory.
It is a test harness, not a service to deploy.

When a future environment and individual credential have separately been
authorized and provisioned, enter that credential without putting it in shell
history, a command argument, a JSON review file or a committed script:

```powershell
$credential = Read-Host 'Individual identity credential' -AsSecureString
try {
  $env:GRIDVIEW_IDENTITY_TOKEN = [System.Net.NetworkCredential]::new('', $credential).Password
  npm run identity -- status
  # Run the specific reviewed commands here.
} finally {
  Remove-Item Env:GRIDVIEW_IDENTITY_TOKEN -ErrorAction SilentlyContinue
  $credential.Dispose()
}
```

The bearer exists in process memory/environment while commands run. Use a
trusted local terminal and do not dump that environment. Keep exports in a
restricted local directory; they contain private evidence and audit history.
No token or digest is included in exports or request files.

Roles are explicit, with no implicit inheritance:

| Role        | Permission                                                                                                                              |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `reader`    | Inspect/export, history, notifications; acknowledge a notification individually.                                                        |
| `reviewer`  | Add dossiers; approve a binding, new driver or profile; reject/quarantine/reopen; report corrections; abandon own unactivated proposal. |
| `activator` | Seed/base import, validate, activate, admission control; abandon any unactivated proposal; inspect another actor's receipt.             |

An ordinary reviewer should also have `reader`; an activator using the CLI
also needs `reader` to inspect the proposal. One named individual may hold all
three roles and perform review and activation as separate operations. Shared
`ADMIN_TOKEN` cannot authorize any identity mutation. Its transitional reads
exist only under explicit `read-only` shadow mode and retain U2's old shapes.

## Inspect candidates and evidence

```powershell
npm run identity -- status
npm run identity -- candidates list --season 2026 --source jolpica --state unresolved --limit 20
npm run identity -- candidate inspect '<candidate-sha256-id>'
npm run identity -- evidence list '<candidate-sha256-id>'
npm run identity -- observations list '<candidate-sha256-id>'
npm run identity -- evidence inspect '<dossier-or-evidence-sha256-id>'
npm run identity -- notifications list
```

Copy identifiers exactly, including `sha256:`. Lists return `nextCursor`; pass
it back as `--cursor '<opaque-cursor>'` with the same filters. Each navigation
view has an insertion upper bound. Candidate states can change during paging;
the candidate version and evidence head on submission provide the final check.

Evidence is a sanitized projection or an explicitly reviewed dossier. An HTTP
200, a familiar name, an acknowledgement or an unknown provider key alone is
not identity proof. The CLI and Worker **never fetch citation URLs**, make
hidden Jolpica requests or derive a canonical ID from a provider slug.

Inspect the complete active revision when checking duplicates or an existing
driver's exact canonical ID and profile:

```powershell
npm run identity -- revisions list
npm run identity -- revision inspect '<active-revision-uuid>'
npm run identity -- export --revision '<active-revision-uuid>' --out '.\restricted\catalog-review.json'
```

Exports refuse to overwrite an existing file. Verify the wrapper `exportHash`
over canonical JSON excluding only that hash. `lineage` is U4's self-contained
revision export and retains its existing offline verifier. Referenced review
evidence and decisions remain durable; exports themselves are audited by actor
and hash, without logging their content.

## Prepare a dossier, then approve an exact binding

Copy a file from [the synthetic examples](identity-u5-examples/README.md) to a
private working directory. Edit JSON values in a text editor; programming is
not required. Fill the installation UUID, a fresh operation UUID, current head
and activation sequence, candidate version/evidence head and explicit rationale.
PowerShell can create an operation UUID with `[guid]::NewGuid().ToString()`.
The file must contain only the documented fields. Save as UTF-8 (with or without a BOM); UTF-16 is rejected. If using PowerShell JSON conversion, use `ConvertTo-Json -Depth 50` and `Set-Content -Encoding UTF8`. Do not add your name, roles,
credential ID, timestamps or bearer; the server derives attribution.

```powershell
npm run identity -- evidence add --file '.\reviews\dossier.json' --check
npm run identity -- evidence add --file '.\reviews\dossier.json' --preview
npm run identity -- evidence add --file '.\reviews\dossier.json'
```

After dossier creation, copy its returned `evidenceId`, `candidateVersion` and
`evidenceHead` into the approval file. `support.dossierId` must occur in
`support.evidenceIds`. Review the exact key-to-person association and the
existing canonical profile, then:

```powershell
npm run identity -- approve-existing --file '.\reviews\existing-driver.json' --check
npm run identity -- approve-existing --file '.\reviews\existing-driver.json' --preview
npm run identity -- approve-existing --file '.\reviews\existing-driver.json'
```

The CLI prints the file hash, exact submitted JSON, current candidate/evidence,
target and profile delta. It asks you to type `CONFIRM`, the operation name and
operation UUID. It submits the in-memory bytes just displayed. It never
activates the proposal after approval.

## A genuinely new driver or a profile change

A new identity requires an explicitly chosen canonical `driverId`, a complete
closed profile with explicit nulls for unsupported optional facts, evidence and
a duplicate-review attestation tied to the exact current catalog hash. Inspect
the complete canonical ID list, including same-name distinctions. The server
refuses guessed IDs, incomplete duplicate review and retargeting an existing
binding. If uncertain, quarantine instead of creating a new person.

```powershell
npm run identity -- approve-new --file '.\reviews\new-driver.json' --preview
npm run identity -- approve-new --file '.\reviews\new-driver.json'
npm run identity -- approve-profile --driver '<existing-canonical-id>' --file '.\reviews\profile.json' --preview
npm run identity -- approve-profile --driver '<existing-canonical-id>' --file '.\reviews\profile.json'
```

A profile operation includes `expectedProfileHash`; its ID stays fixed. Neither
operation changes the active head until separately validated and activated.

## Insufficient evidence, rejection and quarantine

```powershell
npm run identity -- candidate disposition '<candidate-sha256-id>' --file '.\reviews\quarantine.json' --preview
npm run identity -- candidate disposition '<candidate-sha256-id>' --file '.\reviews\quarantine.json'
npm run identity -- candidate acknowledge '<candidate-sha256-id>' --file '.\reviews\acknowledge.json'
```

Use `action: "quarantine"` for ambiguity or conflicting evidence. Use `reject`
for a reviewed invalid association/record and record the explicit reason code.
Reopening requires `action: "reopen"`, `reasonCode: "new-evidence"` and the latest
version/head of an eligible inactive candidate. No disposition or notification
acknowledgement turns an unresolved race/standings row into valid data. Acknowledge
before approving where possible: acknowledgement updates the candidate version;
refresh the candidate after it, and never substitute an old version into an approval. Required
identities still block their complete resource. The four November identifiers
remain unresolved and must not be mapped from these examples.

## Validate, inspect the consequences, then activate

Copy `proposedRevisionId`, `catalogHash` and reserved dataset versions from the
approval response. Validation and activation each need their own operation ID.

```powershell
npm run identity -- revision inspect '<proposal-uuid>'
npm run identity -- validate '<proposal-uuid>' --file '.\reviews\validation.json' --preview
npm run identity -- validate '<proposal-uuid>' --file '.\reviews\validation.json'
# Copy the returned reportHash into activation.json as validationReportHash.
npm run identity -- activate '<proposal-uuid>' --file '.\reviews\activation.json' --preview
npm run identity -- activate '<proposal-uuid>' --file '.\reviews\activation.json'
```

Activation displays the exact proposal delta, validation report and affected
season versions. It requires the exact hash, valid certificate and current
parent/sequence. A stale candidate, evidence head, catalog head or certificate
requires renewed inspection and a newly reviewed proposal. Never edit an old
request and reuse its operation ID. Unactivated proposals can be abandoned:

```powershell
npm run identity -- abandon '<proposal-uuid>' --file '.\reviews\abandon.json'
```

The deliberately named `--confirm-reviewed-operation` option replaces the
interactive prompt for a human-reviewed noninteractive invocation. Use it only
after inspecting the exact file and `--preview`; it is not an automatic
approval, activation, retry or scheduling mechanism.

## Failed or uncertain operations

```powershell
npm run identity -- operation inspect '<operation-uuid>' --family approve-existing
npm run identity -- history --candidate-id '<candidate-sha256-id>'
npm run identity -- history --revision-id '<proposal-uuid>'
```

A network timeout is **uncertain**, not proof of failure. Keep the exact file
and operation ID. Inspect the receipt; an activator can add `--principal` to
inspect another actor's receipt. A receipt marked `unknown` does not prove an
in-flight call cannot still commit. To deliberately recover the same request:

```powershell
npm run identity -- approve-existing --file '.\reviews\existing-driver.json' --retry-same-operation
```

If the receipt exists the CLI displays it and sends no mutation. Otherwise it
permits only the unchanged request and asks for confirmation. The server
returns the original receipt for an identical retry, including after restart
or credential rotation for the same principal. Different bytes/path with the
same family/ID conflict. Existing/new/profile approvals and dispositions share
the U4 `review` family; their CLI command names are accepted as receipt-lookup
aliases. Other families use their operation names. Rate-limit responses include `Retry-After`; wait and
retry deliberately. Capacity/unavailability errors require investigation,
never an automatic activation or a new operation ID to bypass the error.

## Historical corrections, imports and admission

An already activated identity cannot be retargeted, merged or deleted. If a
wrong association could affect published history, preserve evidence and report
a correction. The report is append-only and pauses catalog admission; it does
not repair historical results. Escalate for a separately approved historical
correction plan and existing operational holds/draining procedures.

```powershell
npm run identity -- correction report --file '.\reviews\correction.json' --preview
npm run identity -- correction report --file '.\reviews\correction.json'
npm run identity -- admission --file '.\reviews\pause-admission.json' --preview
```

Seed and sealed base imports require activator authority and reviewed complete
artifacts. `seedArtifact` wraps `{format:"gridview-reviewed-seed/1",seed,dossier}`;
`seedArtifactHash` hashes that wrapper and `approvedImportDossierId` hashes its
input dossier. Bootstrap retains its references in the proposal transaction.
Only an empty catalog accepts a seed. Root validation/activation use a null
expected active revision and sequence zero. Base imports use a validated U3
seed-format source artifact, its exact hash and supporting dossiers, preserve
runtime driver identities/profiles and all prior binding targets, and still
require separate validation/activation. They grant no arbitrary driver curation
or full-catalog replacement.

```powershell
npm run identity -- seed --file '.\reviews\reviewed-seed.json' --check
npm run identity -- import-base --file '.\reviews\reviewed-base.json' --check
```

These commands are mechanism documentation, not authorization to import or
activate real R0 anywhere. Admission controls future catalog pins only; U5 has
no runtime pin consumer. Public reads and in-flight operational work are not
cancelled by a catalog pause.

## Future provisioning, rotation and notifications

Before any provisioning, assign named primary/backup reviewers, activators and
recovery/export custodians and obtain environment-specific authorization.
Provision the separate `IDENTITY_REVIEWER_CREDENTIALS` secret as a closed JSON
array with `credentialId`, `tokenSha256` (64 lowercase hex digits), `principalId`,
explicit `roles`, boolean `disabled` and canonical UTC `expiresAt`. Tokens must
be independently issued from at least 32 random bytes and encoded as unpadded
base64url (43–128 characters). Neither server secret nor token belongs in Git,
review JSON or an example shell script. No real credential is provisioned by U5.

Rotation creates a **new credential ID and token** for the same stable principal.
Allow a short explicit overlap, verify the new credential, then disable/remove
the old entry. Revoke immediately with `disabled:true` or removal. Expiry and
disablement apply to every request, including receipt access; historical audit
retains the original principal and credential IDs. Never reuse a credential ID
for another principal. A later IdP integration requires a separate decision.

Durable U2 notification generations and individual acknowledgements are the
future email extension point. A separately approved delivery component could
consume pending required-identity alerts, inventory-only backlog and persistent
sync-failure state, with deduplicated delivery receipts and explicit thresholds.
U5 adds no email addresses, SMTP/provider integration, webhook, external message
or notification schedule. Acknowledgement remains distinct from resolution.
