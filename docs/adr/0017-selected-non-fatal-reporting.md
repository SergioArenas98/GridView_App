# ADR 0017: A narrow non-fatal allowlist with enum-only diagnostic context

- Status: Accepted
- Date: 2026-08-13

## Context

The application already produces a rich stream of typed failures:
`ApiFailureKind` for every transport and contract outcome, three typed
persistence validation exceptions, and a `RefreshResult` for every resource
refresh. Once Crashlytics exists, the obvious move is to forward all of it.

That would be a mistake twice over.

**Volume.** Most of those failures are ordinary operational states. A user on a
train is offline; a superseded refresh is cancelled; a conditional request is
revalidated; a season the service no longer covers is `notFound`. Every one is
already represented in the UI. Reporting them turns Crashlytics into a
connectivity log in which a genuine contract break is invisible.

**Content.** The natural context to attach is also the most dangerous. Canonical
resource keys — the application's own vocabulary — embed stable identifiers:
`driver:max-verstappen:2026`, `grand-prix:2026:13`, `circuit:spa-francorchamps:2026`.
Attaching a key leaks an identifier into a third-party service and gives the
attribute unbounded cardinality. The same applies to URLs, query strings,
response bodies and exception messages.

## Decision

**A narrow allowlist, defaulting to silence.** `ObservabilityPolicy` is a pure,
total function of the typed failure category. Exactly three transport categories
are reported:

| Reported | Why |
|---|---|
| `invalidResponse` | The service answered with something this client cannot treat as valid. The contract drifted or a snapshot is corrupt. |
| `unsupportedApiVersion` | The build cannot speak the service's version. Users are stuck until someone ships or rolls back. |
| `configuration` | A release that cannot reach its own API, or asked for fixtures. Impossible in a correct production artifact. |

Everything else is never reported: `networkUnavailable`, `networkTimeout`,
`cancelled`, `rateLimited`, `serverUnavailable`, `maintenance`, `notFound`,
`invalidRequest` and `unknown`. `invalidRequest` is excluded deliberately — it
is reachable from a stale local key, so it is not reliably a client defect —
and `unknown` because an unmapped server code usually means the build predates
the code rather than that anything broke.

**One owner per failure.** The three typed validation exceptions
(`InvalidEntityException`, `InvalidSeasonEntriesException`,
`InvalidMediaOwnershipException`) are raised by the DAOs while rejecting a
*remote payload*, and `SyncedRepository` converts each into
`RefreshFailure(invalidResponse)`. They are therefore reported **only** at the
refresh boundary, as `invalidRemoteContract`.

An earlier revision also reported them at the persistence boundary as
`persistenceInvariantViolation`. That produced two non-fatals for one fault,
under two different signatures — so the throttle could not collapse them either
— and one of the two blamed local persistence for a service defect. The member
no longer exists: a payload that would have violated an invariant is a remote
contract problem, and if a genuinely local invariant failure ever becomes
reachable it earns its own member then.

`localDatabaseFailure` is what remains at the snapshot-apply boundary: an error
that escaped the transaction without being one of the typed rejections, meaning
the database failed a write that should have succeeded. It propagates as a
thrown error rather than a `RefreshFailure`, so the refresh boundary never sees
it — exactly one report. Paired with `ObservedOperation.snapshotApply` it *is*
the "transport succeeded and the write did not" case; there is deliberately no
separate `syncMaterializationFailure` member, because a second name for the same
event would invent precision the report does not have.

**Two hooks, not twelve.** Reporting is wired once in the composition root, at
the two objects every repository already shares: `RefreshCoordinator` (every
completed refresh) and `ResourceSync` (every error escaping a snapshot
transaction). Neither gains an observability dependency — each takes a plain
callback and `sync_observation.dart` supplies the one that applies the policy.
No repository, controller or widget calls the reporter.

**Context is enums, and only enums.** `ObservedFailure` carries four fields:
kind, feature, operation and environment. All four are enums. This is a
structural guarantee rather than a convention — there is no field capable of
holding an identifier, slug, URL, query string, response body, credential, token,
KV key, route parameter or stack trace, so no call site can leak one even by
accident, and the attribute space is bounded by the enum product (well under
500 combinations) rather than by the data.

`ObservedFeature.fromResourceKey` is the redaction boundary. It inspects only
the leading segment of a canonical key and collapses anything unrecognised to
`other`, so *any* input — including a URL with a token in it — produces one of a
fixed set of values.

**Repeats are suppressed.** `NonFatalThrottle` reports the first occurrence of a
signature and drops further ones for five minutes. The signature is built from
enums, so the map is bounded by construction: there is no unbounded growth, and
therefore no eviction policy to claim and fail to enforce. Fatal errors are
never throttled — a crash is singular, and losing one is worse than a duplicate.

**Observation cannot change behaviour.** Every hook and every reporter call is
guarded. A throwing observer, a throwing reporter or a broken SDK cannot alter a
domain result, a synchronization decision, database state, media state or screen
state, and cannot convert a handled failure into an unhandled one.

## Consequences

- Crashlytics non-fatals stay rare and mean something. A single report is worth
  investigating, which is the only property that makes the feature useful.
- The reports are coarse. They say *what class of thing* failed and *where*, not
  which resource. Diagnosing a specific entity needs the edge API's own
  telemetry, which already has the request id — and which is the correct place
  for it, because it is first-party.
- Adding a category is a deliberate edit to one pure function with one
  exhaustive switch, so a new `ApiFailureKind` cannot silently inherit either
  "report" or "ignore".
- Because the context is enum-only, no future call site can be tempted to attach
  "just the id for debugging" without changing the type.

## Alternatives rejected

- **Report every caught exception.** Rejected: buries the signal and turns a
  crash reporter into a connectivity log.
- **Attach the canonical resource key.** Rejected: leaks stable identifiers to a
  third party and makes the attribute unbounded.
- **Attach exception messages or stack traces as custom string keys.** Rejected:
  unbounded, frequently contain payload fragments, and Crashlytics already
  carries the real stack for fatals.
- **A rate limiter keyed by resource.** Rejected: the key space would grow with
  the data, which is the cardinality problem in a different place.
- **Relying on the throttle to hide the duplicate.** Rejected outright: the two
  reports had different signatures, so the throttle never saw them as related —
  and suppressing a symptom of wrong ownership is not a fix for wrong ownership.
