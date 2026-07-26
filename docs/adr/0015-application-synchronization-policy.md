# ADR 0015: Application startup, foreground and manual synchronization policy

- Status: Accepted
- Date: 2026-07-26

## Context

Phase 6B1 gave every resource a complete, independent refresh pipeline:
conditional request, typed result, snapshot-conflict rule, atomic domain write,
per-key deduplication. What it deliberately did **not** answer is *what* to
refresh and *when*.

Left unanswered, that gap fills itself badly. Each screen's controller starts its
own refresh on creation; the Home controller already did. A second controller
appears and now two owners race at launch. A lifecycle listener is added in a
widget and fires on rebuilds. Someone adds a periodic timer "to keep things
fresh". The result is a chatty client with no single place to reason about
freshness, cancellation or offline behaviour.

## Decision

**One application-level owner.** `AppSyncCoordinator` owns first-use bootstrap
policy, current-season resolution, due-resource planning, the startup run, the
foreground run, manual current-season refresh, stage ordering, bounded
concurrency, aggregate run state and run cancellation. It owns none of the
per-resource mechanics — DTO parsing, HTTP handling, ETag persistence, the
conflict comparison and domain writes all stay in the Phase 6B1 repositories.
`HomeController` no longer launches a startup refresh of its own; it mirrors the
coordinator's outcome for the Home resource and keeps `refresh()` for the user's
explicit retry.

**Rendering never waits for the network.** Local services and Drift open, the
shell and any cached content render, and only then — in a post-frame callback —
does the startup run begin. Nothing in app construction awaits a remote call, and
there is no fixed-duration splash.

**A pure, deterministic planner.** `SyncPlanner` is a pure function of
`(trigger, supplied UTC clock, locally resolved season, expected core keys,
persisted metadata, due-query results, usable-cache flag, bootstrap-attempted
flag)`. It reads no clock and performs no I/O, so the same inputs always produce
the same typed plan.

**Server-provided freshness only.** A resource is due when `lastSuccessAt` is
null, `serverStale` is true, or `staleAfter <= now` — the same rule the persisted
due query uses, evaluated against the supplied UTC instant. The `<=` boundary is
deliberate. There is no client-side fallback TTL. A resource with **no metadata
row at all** counts as never synchronized: the SQL query can only return rows
that exist, so the planner merges the expected core keys with the query's result
rather than trusting the query alone.

**The usable-cache predicate is about materialization.** A usable first-screen
cache is a locally resolved current season plus a **materialized Home
representation for that season** — read from the persisted snapshot's season
(`snapshots.focusSeason` for the `home` key), never inferred from the presence of
a featured Grand Prix. A current season whose Home legitimately has no scheduled
events is a valid empty state and usable cache; treating "no featured event" as
"not materialized" would force a bootstrap on every restart for such a season.
`HomeView.featured` is therefore nullable and `HomeView.seasonYear` always names
the season, so an empty season renders a defined empty Home instead of looking
missing.

**Home is season-scoped.** Its canonical key is always `home:<year>`. There is no
`home:current`, no unscoped key, no temporary key and no unconditional request
whose metadata is assigned after the response — the coordinator must know the
season before it can read the right validator, record attempt metadata or
dispatch the refresh.

**First-use policy.** With no usable first-screen cache, bootstrap is the first
and *only* remote resource attempted — the point of the aggregate is to replace a
fan-out, not to join one. On success (or a valid `304`) the run ends there; the
UI renders from that transaction through Drift, and the individual endpoints
acquire their own representations later. On failure the shell stays usable, every
partial cache is preserved, there is no retry loop, and the run recovers with a
*minimal* plan: season context, then the minimum Home resource for the resolved
season — never a compensating fan-out of all collections. If no season can be
resolved, locally or remotely, Home is **not** called and the run finishes as
`AppSyncSeasonContextUnavailable`.

**Automatic scope.** Automatic startup and foreground runs cover only
current-season core resources: current season, season metadata, Home, calendar,
both standings tables, the season driver/constructor/circuit collections and the
content manifest. Individual Grand Prix details and results, driver, constructor
and circuit details, and historical-season resources stay **on demand** — owned
by whichever feature or detail controller opens them. Their metadata remains
stored and queryable either way.

**Staged, bounded execution.** Stages run in order — season context, first
screen, championship, then explore collections and content — because a changed
current season must be resolved before season-scoped commands are built.
Resources inside one stage are independent and run concurrently, bounded by an
injected limit of 4. This is not a global HTTP lock: whole *runs* are serialised,
resources within a stage are not. A failure never stops a stage; independent
resources continue.

**Lifecycle-driven, never rebuild-driven.** The only automatic triggers are the
one post-first-frame startup run and a genuine background → resumed transition.
A transient `inactive` (an iOS overlay) is not a return from the background.
Pause, hidden, detached and scope disposal cancel the active run. There is no
periodic timer, no background isolate, no scheduled job, and no synchronization
continues while the app is deliberately backgrounded.

**Manual means eligibility, not validator bypass.** The manual entry point
refreshes the current-season core set ignoring due eligibility for that one run,
while keeping conditional requests and every persisted ETag. Dropping validators
remains a separately named low-level repository option (`bypassValidator`) that
ordinary refreshes never use.

**Coalescing.** One run owns automatic orchestration at a time. An automatic
trigger during an active run joins it. A manual trigger during an active run
queues at most one forced follow-up, however many times the user taps.
Cancellation resolves pending work rather than leaving it dangling, and never
permanently blocks a future run.

**Season transitions.** No active year is hardcoded. When the current season
changes, previous-season data — calendars, standings, entities, details and their
metadata — is preserved untouched; new plans switch to the new year; the new
season's core resources are treated as missing/due; and a new season with no
usable Home cache legitimately prefers bootstrap. There is no global database
reset.

**Aggregate state stays in memory.** `resource_sync_metadata` remains the durable
record for each remote representation. The run state (idle, running with trigger
and stage, completed with per-resource outcomes and counts, cancelled, or unable
to resolve season context) lives in memory only and exposes nothing but canonical
keys, outcome categories and typed `ApiFailureKind` values — never an exception,
Dio response, DTO, Drift row, server body or configuration value.

**Failure semantics.** A failed resource keeps its valid cache and its ETag;
others continue; no coordinator-level retry loop is added; a rate-limited
resource is not immediately retried; the single unconditional `304` recovery
stays repository-owned; a configuration failure surfaces as a typed
`configuration` failure; and a cancelled run is never reported as a success.

## Consequences

- Exactly one place decides freshness, ordering, concurrency and cancellation.
- Startup issues one request on an empty cache and none at all when everything is
  fresh.
- Offline launches — first or returning — leave the shell and every cached
  section usable.
- Phase 7 controllers read Drift streams and call the manual/core refresh entry
  point; detail controllers own their on-demand refreshes. No feature recreates
  lifecycle policy.
- Covered by `test/sync/first_screen_cache_test.dart`,
  `test/sync/sync_planner_test.dart`,
  `test/sync/sync_resource_parser_test.dart`,
  `test/sync/app_sync_coordinator_test.dart`,
  `test/sync/season_transition_test.dart`,
  `test/sync/sync_providers_test.dart`,
  `test/sync/sync_persistence_test.dart` and
  `test/app/startup_non_blocking_test.dart`.
