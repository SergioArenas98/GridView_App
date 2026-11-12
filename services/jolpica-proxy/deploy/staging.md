# Staging-only proxy activation

Prepared procedure, not an executed deployment. Every live deployment, secret
upload and provider probe below needs separate authorization. Work only in
`Gridview-jolpica-proxy`, branch `feat/jolpica-egress-proxy`.

## Baseline and deployment delta

Operator-verified baseline supplied for this preparation:

- Active staging version: `de0dc58a-5c09-4b16-8ce4-aae56199dbde`.
- Proxy: `https://gridviewjol.vps.webdock.cloud`; VPS egress: `193.180.210.75`.
- Authenticated races GET: 200; unauthenticated: 401; public health: 404.
- Node service and Caddy active. Existing staging secret: `ADMIN_TOKEN`.

The configuration adds only staging `JOLPICA_TRANSPORT=proxy`,
`JOLPICA_PROXY_ORIGIN=https://gridviewjol.vps.webdock.cloud`, and the required
secret name `JOLPICA_PROXY_TOKEN`. No token value belongs in Wrangler vars.
The existing `ADMIN_TOKEN` remains required and is not replaced.

Preserve `PROVIDER_MODE=coordinated`, cutover `activate:2026`, authority
`sequencer`, batch ingest `2026`, `PUBLIC_BASE_URL`, all three Durable Object
bindings/SQLite exports and KV `1d0fb55486a745a1ad12e03d9f04942b`.
Keep explicit `crons=[]`, observability and compatibility date unchanged.
Production and the controlled-source demonstration environment stay unchanged.

Historical comments in Wrangler are not live-state evidence. Immediately before
an authorized deployment, recheck the account and staging version using the
installed Wrangler from `services/edge-api`:

```powershell
.\node_modules\.bin\wrangler.cmd whoami
.\node_modules\.bin\wrangler.cmd deployments status --env staging
.\node_modules\.bin\wrangler.cmd versions view de0dc58a-5c09-4b16-8ce4-aae56199dbde --env staging
.\node_modules\.bin\wrangler.cmd secret list --env staging
.\node_modules\.bin\wrangler.cmd deploy --dry-run --env staging
```

Inspect staging Settings for zero cron triggers, the same actual namespace IDs
and bindings, vars and observability. Dry-run lists binding names/classes; it
does not prove live namespace identity or secret availability. If the version
or settings changed, stop and reconcile before deploying. Record current
`GET /v1/status` and existing published data/ETags as the read-only baseline.
Confirm no manual synchronization is in flight or planned during activation.

## Windows 11 secret upload with code (future authorized action)

Use a trusted local PowerShell session in the isolated worktree's
`services/edge-api` directory. Use the already installed Wrangler 4.112.0;
do not upgrade dependencies during activation. Authenticate to Cloudflare
before handling the token. Do not run a transcript, terminal recording,
debug tracing, or verbose HTTP logging. Never put a token in a command,
chat, environment variable, repository file, or command-line argument.

### 1. Prepare a private copy on the VPS

Use Windows OpenSSH `ssh.exe` and `scp.exe` as `gridviewadmin`, with the
already verified ED25519 host key for `gridviewjol.vps.webdock.cloud`. All
connections use that hostname, IPv4 and the existing private key at
`$env:USERPROFILE\.ssh\gridview_webdock`. Do not substitute the IPv4 address
as the SSH destination, disable host-key checking, or accept a changed key.

No SSH agent is required: `IdentityAgent=none` disables agent use,
`IdentitiesOnly=yes` selects configured identities, and `BatchMode=no` allows
OpenSSH's normal hidden key-passphrase prompt. Enter the **SSH key passphrase**
only at that prompt, never into a command, variable or chat. The prompt may
appear separately for terminal A, SCP and each cleanup connection. Keep terminal
B interactive; do not redirect its input, pipe the script, or run it unattended.
Only public-key authentication is enabled; there is no server-password fallback.
No root SSH login, new key or sudo policy change is needed. The existing admin
must already be authorized to read the root-owned token with sudo.

In **terminal A**, connect to the VPS:

```powershell
$sshKey = Join-Path $env:USERPROFILE '.ssh\gridview_webdock'
ssh.exe -4 -i $sshKey -o StrictHostKeyChecking=yes -o IdentitiesOnly=yes -o IdentityAgent=none -o BatchMode=no -o PreferredAuthentications=publickey -o ForwardAgent=no -p 22 gridviewadmin@gridviewjol.vps.webdock.cloud
```

Start a dedicated `bash` shell there, then paste this Bash block. Keep this
shell open while terminal B transfers the file. The only printed output is a
temporary **path**, never the token. A sudo password, if requested, is entered
only at sudo's normal hidden prompt.

```bash
bash
```

```bash
umask 077
transferDir=$(mktemp -d /tmp/gridview-jolpica-transfer.XXXXXXXX) || exit 1
cleanup_transfer() {
    rm -f -- "$transferDir/token"
    if [ -d "$transferDir" ]; then rmdir -- "$transferDir"; fi
}
trap cleanup_transfer EXIT
trap 'exit 1' HUP INT TERM
sudo install -m 600 -o "$(id -u)" -g "$(id -g)" -- \
    /etc/gridview-jolpica-proxy/token "$transferDir/token" || exit 1
test "$(stat -c %a "$transferDir")" = 700 || exit 1
test "$(stat -c %a "$transferDir/token")" = 600 || exit 1
printf 'Transfer directory: %s\n' "$transferDir"
```

This reads the original file without changing it or restarting the service.
It creates only a mode-0700 directory and mode-0600 copy owned by the SSH admin.
Record the printed path locally for cleanup; it is not a credential. Do not use
`cat`, `Get-Content`, shell tracing, SCP verbose mode, or clipboard transfer of
the token. SCP transports file bytes over encrypted SSH without terminal output.

### 2. Transfer, remove the VPS copy, and deploy from Windows

In **terminal B**, use PowerShell in the isolated worktree's `services/edge-api`.
The account, hostname, key and port below match terminal A. At the path prompt,
enter only the temporary directory printed in terminal A, not a token or key
passphrase. Subsequent key-passphrase prompts come directly from OpenSSH.
The JSON will contain only `JOLPICA_PROXY_TOKEN`, not `ADMIN_TOKEN`.

The following block **deploys and uploads a secret**. Do not run it until that
operation is explicitly authorized and the preflight above still matches.
It uses a current-user-only NTFS directory outside the checkout and removes the
files in `finally`, including on deployment failure. Plaintext necessarily exists
briefly in memory and on disk for `--secrets-file`; use a trusted, BitLocker-
protected machine. File deletion is not guaranteed secure erasure on an SSD.

```powershell
$ErrorActionPreference = 'Stop'
$env:WRANGLER_SEND_METRICS = 'false'
$env:WRANGLER_LOG = 'warn'
$sshAdmin = 'gridviewadmin'
$sshPort = 22
$sshKey = Join-Path $env:USERPROFILE '.ssh\gridview_webdock'
if ($sshAdmin -cnotmatch '^[a-z_][a-z0-9_-]*$' -or $sshPort -lt 1 -or $sshPort -gt 65535) {
    throw 'Set the actual SSH admin and port before continuing.'
}
$sshTarget = $sshAdmin + '@gridviewjol.vps.webdock.cloud'
$remoteDir = Read-Host 'Temporary VPS directory printed in terminal A (not the token)'
if ($remoteDir -cnotmatch '^/tmp/gridview-jolpica-transfer\.[A-Za-z0-9]{8}$') {
    throw 'Unexpected transfer directory; clean up terminal A and stop.'
}
$sshOptions = @('-4', '-i', $sshKey,
    '-o', 'BatchMode=no', '-o', 'StrictHostKeyChecking=yes',
    '-o', 'IdentitiesOnly=yes', '-o', 'IdentityAgent=none',
    '-o', 'PreferredAuthentications=publickey',
    '-o', 'ForwardAgent=no', '-o', 'ClearAllForwardings=yes', '-o', 'LogLevel=ERROR',
    '-o', 'ConnectTimeout=10', '-o', 'ServerAliveInterval=5', '-o', 'ServerAliveCountMax=3')
$remoteCleanup = "rm -f -- '$remoteDir/token' && { [ ! -d '$remoteDir' ] || rmdir -- '$remoteDir'; }"
$remoteCleaned = $false
$secretDir = Join-Path $env:LOCALAPPDATA ('GridView-staging-' + [guid]::NewGuid())
$secretFile = Join-Path $secretDir 'secrets.json'
$tokenFile = Join-Path $secretDir 'token'
$plainToken = $null
$secretJson = $null
# Non-sensitive recovery path only; never print file contents.
Write-Host "Windows transfer directory: $secretDir"
try {
    New-Item -ItemType Directory -Path $secretDir | Out-Null
    $sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl = [System.Security.AccessControl.DirectorySecurity]::new()
    $acl.SetAccessRuleProtection($true, $false)
    $acl.SetOwner($sid)
    $rule = [System.Security.AccessControl.FileSystemAccessRule]::new(
        $sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
    $acl.AddAccessRule($rule)
    Set-Acl -LiteralPath $secretDir -AclObject $acl
    $actualAcl = Get-Acl -LiteralPath $secretDir
    if (-not $actualAcl.AreAccessRulesProtected -or
        @($actualAcl.Access).Count -ne 1 -or
        $actualAcl.Access[0].IdentityReference.Translate(
            [System.Security.Principal.SecurityIdentifier]).Value -ne $sid.Value) {
        throw 'Private directory ACL verification failed.'
    }
    & scp.exe -q @sshOptions -P $sshPort ($sshTarget + ':' + $remoteDir + '/token') $tokenFile
    if ($LASTEXITCODE -ne 0) { throw 'SCP failed; no deployment attempted.' }
    & ssh.exe -T @sshOptions -p $sshPort $sshTarget $remoteCleanup
    if ($LASTEXITCODE -ne 0) { throw 'VPS cleanup failed; no deployment attempted.' }
    $remoteCleaned = $true

    if ((Get-Item -LiteralPath $tokenFile).Length -gt 130) {
        throw 'Unexpected token file size; no deployment attempted.'
    }
    $plainToken = [IO.File]::ReadAllText($tokenFile) -replace '\r?\n\z', ''
    if ($plainToken -cnotmatch '^[A-Za-z0-9_-]{43,128}$') {
        throw 'Token does not match the proxy token format.'
    }
    $secretJson = @{ JOLPICA_PROXY_TOKEN = $plainToken } | ConvertTo-Json -Compress
    [IO.File]::WriteAllText($secretFile, $secretJson, [Text.UTF8Encoding]::new($false))
    $plainToken = $null
    $secretJson = $null
    Remove-Item -LiteralPath $tokenFile

    & .\node_modules\.bin\wrangler.cmd deploy --env staging --secrets-file $secretFile
    if ($LASTEXITCODE -ne 0) { throw 'Deployment failed; inspect staging state before any retry.' }
}
finally {
    $plainToken = $null
    $secretJson = $null
    # Attempt each cleanup independently, including after a partial SCP.
    foreach ($path in @($tokenFile, $secretFile)) {
        try {
            if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path }
        }
        catch { Write-Warning "Remove the temporary file manually: $path" }
    }
    try {
        if (Test-Path -LiteralPath $secretDir) { [IO.Directory]::Delete($secretDir, $false) }
    }
    catch { Write-Warning "Inspect and remove the temporary directory: $secretDir" }
    if (-not $remoteCleaned) {
        try {
            & ssh.exe -T @sshOptions -p $sshPort $sshTarget $remoteCleanup
            if ($LASTEXITCODE -ne 0) { throw 'Remote cleanup incomplete.' }
        }
        catch { Write-Warning 'Use terminal A or reconnect to remove the VPS temporary copy.' }
    }
}
```

On completion, exit the dedicated Bash shell in terminal A; its trap also
removes any remaining copy. Confirm the temporary directory is absent. Neither
cleanup path targets `/etc/gridview-jolpica-proxy/token`.

### 3. Interrupted transfer or deployment

If SCP fails, the script never deploys; it removes partial local files and
attempts remote cleanup. If remote cleanup cannot be confirmed, deployment is
blocked even if SCP succeeded. Do not retry until both copies are cleaned up.
If a key passphrase is wrong or cancelled, the connection fails closed. Cleanup
in `finally` may ask for the passphrase again. If that also fails or is cancelled,
use the still-open terminal A to run `cleanup_transfer`; deployment must not
proceed. Never enable batch mode or weaken host-key verification to bypass this.

After Ctrl+C, a lost connection, PowerShell termination or reboot, `finally`
and the Bash trap are best-effort only. Perform these checks manually:

- In terminal A, run `cleanup_transfer`, then `exit`. If the session was lost,
  reconnect using terminal A's exact hostname/IPv4/key command above. Set
  `transferDir` to the previously printed `/tmp/gridview-jolpica-transfer.XXXXXXXX` path and
  run `rm -f -- "$transferDir/token"` followed by `rmdir -- "$transferDir"` if
  the directory still exists. Verify with `test ! -e "$transferDir"`. Never
  delete the original `/etc/gridview-jolpica-proxy/token` or use wildcards.
- On Windows, set `$secretDir` to the exact printed directory beneath
  `$env:LOCALAPPDATA`. Verify that path before deleting. Remove only
  `(Join-Path $secretDir 'token')` and `(Join-Path $secretDir 'secrets.json')`
  with `Remove-Item -LiteralPath`; then remove the empty directory with
  `[IO.Directory]::Delete($secretDir, $false)`. Check `Test-Path` returns false.
  If the path was lost, list only directory names matching `GridView-staging-*`
  directly under LocalAppData, inspect them, and clean each confirmed transfer
  directory individually; never print file contents or recursively delete.
- If interruption occurred after Wrangler started, inspect staging deployments
  before any retry: the upload may have succeeded. Cleanup is not a rollback.

Do not share secret files or raw diagnostic dumps. Exit terminal B after cleanup
to release process memory. The procedure uses no secret-bearing command argument,
PowerShell history entry, environment variable, clipboard, or terminal output.
SSH/SCP arguments and ordinary audit logs contain paths and usernames only.
Do not run it on a host/session configured to record secret file contents or
SSH transfer payloads. References: [Windows OpenSSH](https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_keymanagement),
[SSH connection options](https://man.openbsd.org/ssh_config).

Wrangler preserves existing secrets omitted from `--secrets-file`, including
`ADMIN_TOKEN`. Do not run a separate `secret put` (which deploys independently),
rotate the admin token, or use `--keep-vars` to conceal configuration drift.
References: [Cloudflare secrets](https://developers.cloudflare.com/workers/configuration/secrets/),
[deploy options](https://developers.cloudflare.com/workers/wrangler/commands/workers/).

## Validate before synchronization

1. Re-read deployment status, the new version and secret **names only**. Expect
   both `ADMIN_TOKEN` and `JOLPICA_PROXY_TOKEN`, unchanged bindings/namespaces,
   publication controls and zero cron triggers. Record the new version ID.
2. Read staging `/v1/status` and existing published resources; verify the same
   active release and content. These routes do not contact providers. A healthy
   public API does **not** prove the proxy token or provider path works.
3. Check local VPS health (`http://127.0.0.1:8788/healthz`), service and Caddy
   status. Public `/healthz` remains 404 by design. Do not call an approved
   authenticated provider path just to check service health.
4. With separate approval for **one live provider diagnostic**, use the existing
   authenticated staging `POST /internal/admin/provider/jolpica/egress-identity`
   (no body, `ADMIN_TOKEN` supplied privately). It makes at most one Jolpica
   `/test/` GET via the configured transport, honors limiter holds/reservations,
   and does not synchronize, publish or write the reconciliation ledger.
   Inspect the response's `data.outcome`, not just its outer HTTP 200. Expected:
   `observed`, `fresh=true`, address class `other-ipv4`, `testCounterOver=false`.
   Non-Cloudflare addresses are intentionally redacted: this route cannot prove
   the exact address `193.180.210.75`; correlate with the independently verified
   VPS address/routing and prior origin-observed IPv4 evidence. If that evidence
   is absent, obtain a separately approved bounded VPS identity test.
5. Stop on deferral, refusal, unknown freshness, TLS/network errors, 401, or 429.
   Do not reset holds, retry automatically, or fall back to direct transport.
   For 429, preserve Retry-After and refusal facts and follow AU-4's no-repeat-
   that-day stopping rule. Proxy-generated 502/503/504 are distinguishable by
   `X-GridView-Proxy-Error`; public Worker errors may expose only the existing
   classification, so correlate sanitized logs without logging credentials.
6. Verify 429/Retry-After and publication guards using offline regression tests;
   never induce live rate limiting. A successful diagnostic is not permission
   for full sync. Review current ledger/due work and holds before authorizing
   one bounded manual run under AU-4; do not repeat the historical bootstrap.

There is no existing no-upstream Worker route that proves proxy authentication.
Do not add one just for activation. Connectivity, automatic hourly updates,
race-weekend soak and production authorization remain separate release gates:
[automatic updates](../../../docs/release/automatic-updates.md) is referenced
from the repository root as `docs/release/automatic-updates.md`.
Staging alone may use this VPS initially: production has a separate limiter
namespace and would otherwise share the same aggregate outbound-IP budget.

## Rollback (separately authorized)

Stop issuing manual provider requests and confirm schedules remain empty. Keep
all published data, Durable Object classes/IDs, KV, ledger state and holds.
Prefer a forward configuration rollback from this same code:

1. Change only staging `JOLPICA_TRANSPORT` to `direct`, remove its proxy origin,
   and return staging `secrets.required` to `["ADMIN_TOKEN"]`.
2. Review the diff, run transport/config tests and
   `wrangler deploy --dry-run --env staging` again. No other configuration delta
   is allowed. The installed proxy secret may remain; direct mode ignores it.
3. After approval, run `wrangler deploy --env staging` from `services/edge-api`.
   Verify the deployed version, unchanged namespaces/controls, empty cron and
   last-good public data. Do not trigger a synchronization to test rollback.
4. Direct Cloudflare egress can reintroduce the original 429 problem. Keep
   provider traffic stopped pending investigation; do not reset reservations.

Do not blindly run `wrangler rollback`: earlier versions can lack the ledger
class, and Worker version rollback does not restore schedules or application
data. The baseline version above is a reference, not an unconditional rollback
target. A bad published release requires the existing reconciliation hold and
guarded publication rollback procedure, separately approved. Revoking/removing
the proxy token and decommissioning the VPS are later operations.
