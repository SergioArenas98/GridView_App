# GridView Navigation

The navigation shell and routing, established in Phase 3B and accumulated
through Phase 7D. Implemented with
[`go_router`](https://pub.dev/packages/go_router) (17.x) and a
`StatefulShellRoute.indexedStack`.

**Every screen now renders real, Drift-backed content.** The Phase 3B statement
that all screens were "data-independent skeletons rendering deterministic
placeholder content" described the shell before any feature existed and has not
been true since Phase 7D: Home, Calendar, Grand Prix detail, both standings
tables, the three Explore collections and the driver, team and circuit details
all read local domain models through repositories and controllers (see §8).
Advertising is still not involved anywhere
([ADR 0018](../adr/0018-advertising-not-retained-for-v1.md)), and Firebase is
involved only as production-only observability, which owns no route.

The routing behaviour described below — the four-branch state-preserving shell,
root-navigator detail routes, parameter validation, back behaviour and
immediate-loop prevention — is current and unchanged.

**Primer V2 (2026-11-22).** The shell now renders the Primer V2 bottom
navigation (§1), and two recovery rules were added for invalid Standings
routes (§1.1, NF-02 and NF-03). No route, route name, parameter rule or
navigator assignment changed. Visual and accessibility details of the
navigation bar: [GridView_Design_System.md](GridView_Design_System.md) §7 and
[GridView_Primer_V2_Theme_Foundation.md](GridView_Primer_V2_Theme_Foundation.md)
§6b, §6c and §6q.

Source of truth for the intended flows: `../product/GridView_App_Flow.md`.

## 1. Shell and branches

The app is a state-preserving `IndexedStack` of four primary branches, each with
its own `Navigator`. The shell (`lib/app/router/app_shell.dart`, `AppShell`)
renders the Primer V2 bottom navigation (`GvPrimerBottomNav`) on
`surface.page`, placed as the scaffold's `bottomNavigationBar` so it reserves
layout space — scrollable content is never hidden behind it. The bar is 68dp
plus the system inset; at large text it becomes a 2 × 2 grid (155dp at 320dp
@200%) and the content area shrinks accordingly. (The earlier floating pill,
`GvBottomNav`, was removed in Step 55C.15.)

| # | Branch | Root location | Owns |
|---|---|---|---|
| 1 | Home | `/` | Home |
| 2 | Calendar | `/calendar` | Calendar, Grand Prix detail (rendered above the shell) |
| 3 | Standings | `/standings` | Drivers & Constructors standings |
| 4 | Explore | `/explore` | Explore root, Drivers/Teams/Circuits lists |

- Each branch preserves its **navigation stack** and **scroll position** when the
  user switches tabs (guaranteed by `indexedStack`).
- The **Standings branch root is `/standings`** — deliberately season-agnostic.
  No season is baked into the router; the screen shows the drivers view and
  resolves the active season **from the local database** (Phase 7B). The
  `/standings/drivers/:season` and `/standings/constructors/:season` routes
  remain for season-specific deep links and render their exact season.
- **Re-selecting the active branch** returns it to its branch root; repeated
  taps do not stack duplicate routes. `AppShell._onSelect` calls
  `goBranch(index, initialLocation: reset)`, where `reset` is true for the
  active branch and for a branch that must recover from an invalid page
  (§1.1).
- The **selected state** is conveyed by the oxide slab behind the icon, a bold
  label and a `selected` semantics flag, not by colour alone.

### 1.1 Branch restoration and invalid-route recovery (NF-02, NF-03)

Selecting a branch normally restores its last location, stack and scroll
offset. An invalid Standings season (`/standings/drivers/abc`) is rendered
**inside the Standings branch**, so without extra handling the branch would
keep that invalid location and show "Invalid link" again on the next
Standings selection. go_router has no public API to rewrite a branch's stored
location without navigating to it, so the shell decides at selection time.

`ShellBranchResets` (`lib/app/router/shell_branch_resets.dart`, one instance
per router) makes the shell open a branch at its initial location when either:

- **NF-02:** the user left through the invalid page's "Go to Home" action.
  `NotFoundScreen.onGoHome` records a reset request for the branch it is
  shown in (read from `StatefulNavigationShell`, never a hard-coded index) and
  then navigates Home; or
- **NF-03:** the branch is still showing an invalid page. The invalid
  Standings `NotFoundScreen` is wrapped in `ShellBranchInvalidPage`, which
  reports itself to `ShellBranchResets` while mounted (a count, not a flag,
  because a replacing invalid page mounts before the old one is disposed).
  Leaving through another tab and coming back therefore reopens Standings at
  `/standings`.

A pending request is dropped when the branch is activated by another
navigation (a deep link or an in-app `go`), because that already replaced the
stored location. Every valid location, and every other branch, keeps the
normal restoration. Invalid parameters on root-navigator routes (Grand Prix,
driver, team, circuit) render above the shell and do not affect any branch.

Tests: `test/navigation/nf02_branch_recovery_test.dart` and
`test/navigation/nf03_branch_reentry_test.dart`.

**Known, deferred (NF-04).** After leaving an invalid Grand Prix with `go`,
go_router 17.3.0 keeps the old URI in its scoped match list. Nothing observable
depends on it today: the app has no router refresh, `refreshListenable`, state
restoration, route observers or web build. Reopen NF-04 if any of those is
introduced.

## 2. Route inventory

Registered in `lib/app/router/app_router.dart`. Patterns and typed builders live
in `lib/app/router/route_paths.dart`; names in `route_names.dart`.

| Pattern | Name | Navigator | Screen |
|---|---|---|---|
| `/` | `home` | Home branch | `HomeScreen` |
| `/calendar` | `calendar` | Calendar branch | `CalendarScreen` |
| `/calendar/:season/:round` | `grand-prix` | **root** (above shell) | `GrandPrixDetailScreen` |
| `/standings` | `standings` | Standings branch | `StandingsScreen` (drivers) |
| `/standings/drivers/:season` | `standings-drivers` | Standings branch | `StandingsScreen` |
| `/standings/constructors/:season` | `standings-constructors` | Standings branch | `StandingsScreen` |
| `/explore` | `explore` | Explore branch | `ExploreScreen` |
| `/explore/drivers` | `explore-drivers` | Explore branch | `ExploreScreen(category: ExploreCategory.drivers)` |
| `/explore/teams` | `explore-teams` | Explore branch | `ExploreScreen(category: ExploreCategory.teams)` |
| `/explore/circuits` | `explore-circuits` | Explore branch | `ExploreScreen(category: ExploreCategory.circuits)` |
| `/drivers/:driverId` | `driver` | **root** (above shell) | `DriverDetailScreen` |
| `/constructors/:constructorId` | `constructor` | **root** (above shell) | `ConstructorDetailScreen` |
| `/circuits/:circuitId` | `circuit` | **root** (above shell) | `CircuitDetailScreen` |
| `/settings` | `settings` | **root** (above shell) | `SettingsScreen` |
| unmatched | — | root | `NotFoundScreen` (via `errorBuilder`) |

Route **parameters are stable GridView identifiers** (`max-verstappen`,
`spa-francorchamps`, integer `season`/`round`). **Display names are never used as
route identifiers.**

## 3. Parameter validation

Every parameter arriving through a URL is untrusted (deep link, restored state).
`lib/app/router/route_params.dart` validates at the boundary and returns `null`
for anything invalid; the route builder then renders a controlled
`NotFoundScreen(kind: invalidParameters)` instead of throwing.

| Parameter | Rule |
|---|---|
| `season` | integer in `[1950, 2100]` |
| `round` | integer in `[1, 30]` |
| `driverId` / `constructorId` / `circuitId` | non-empty lowercase-kebab `^[a-z0-9]+(-[a-z0-9]+)*$`, ≤ 64 chars |

Invalid examples that resolve to the invalid-route state (never an exception):
`/standings/drivers/abc`, `/calendar/2026/999`, `/drivers/BAD_ID`.

## 4. Opening detail screens

Grand Prix detail and every entity/Settings route render on the **root
navigator**, above the shell, and are opened with `push` semantics. Back returns
to the branch the user came from, with that branch's stack and scroll preserved.
Explore's collection lists are the exception: they belong to the Explore branch
(so the bottom navigation stays visible and back returns to the Explore root).

Rules (implemented in `lib/app/router/entity_navigation.dart`):

- `context.openEntity(location)` opens a detail route. To prevent an endless
  `A → B → A → B` stack (App Flow §11.3 / §12.3), when the target route is the
  page **directly beneath** the current one, it returns to that page (`pop`)
  instead of pushing a duplicate. Otherwise it pushes. This uses only go_router's
  **public API**: each push stamps the current location onto the child route's
  `extra` (an `EntityNavigationOrigin`); the child recognises an immediate loop
  back to its origin and pops. No internal routing-match types are used.
- `context.openSettings()` pushes `/settings` above the current screen **without
  changing the active branch** (App Flow §13.3).
- Branch switches (bottom nav, the Standings segmented control, "see all") use
  `go` so they stay within / activate a branch rather than pushing.

## 5. Back behaviour

- Android **system back** and the app-bar back button pop the top detail route
  and return to the originating branch (verified by tests using
  `handlePopRoute()` and `pageBack()`).
- Popping at a branch root follows normal Android expectations.
- Settings does not reset the primary-navigation destination.
- `NotFoundScreen` shows Back only when there is something to pop: it is
  absent when the not-found page is the only route (an unmatched deep link)
  and present when the page was pushed. An invalid Grand Prix returns to
  Calendar. "Go to Home" always lands on exactly one Home shell with nothing
  left to pop (`test/screens/not_found_primer_test.dart`).

## 6. Deep-link readiness

Every screen is reachable by its URL with no shell state assumed: the router
accepts an `initialLocation`, so `/drivers/max-verstappen`,
`/calendar/2026/3`, `/standings/constructors/2026`, etc. open directly. This is
the seam a future Android App Link / `uni_links` integration will use; no
deep-link intent filters are added in Phase 3B.

## 7. Development routes in production

The component catalogue is development/staging only. The Settings screen shows
its entry only when `AppEnvironment.current` is not production, and
`ComponentCatalogueScreen.open` refuses to navigate in production. There is no
production route to it. (`SettingsScreen.environmentOverride` is a test-only seam;
production always uses the real compile-time environment.)

## 8. Presentation data

Every screen consumes a Drift-backed domain read model. **No API DTO or Drift
row is imported into a presentation widget.** Team colours appear only as
restrained accents (a line, dot or small highlight), never as full row
backgrounds.

Home and Grand Prix detail were moved onto real read models in Phase 4; the
Calendar followed in Phase 7A and Standings in Phase 7B. Phase 7C replaced the
old drivers, teams and circuits list screens with a single
`ExploreScreen(category:)` over real season collections, which was the last
consumer of the Phase 3B placeholder catalogue.

That catalogue —
`lib/features/shared/presentation/placeholder/placeholder_content.dart` and the
`EventRow` / event-status helpers that were its only readers — was therefore
unreachable, and was deleted in Phase 8C-3 together with the `eventStateCurrent`
string that existed solely for its `PlaceholderEventState.current`. The live
`EventStatus` mapping in `domain_status.dart` is unaffected: it has no "current"
state, using `inProgress` → `eventStateLive` instead, and it still owns
`eventStateCompleted` and `eventStateUpcoming`.

## 9. Calendar and Grand Prix navigation (Phase 7A)

### 9.1 Calendar to Grand Prix

The Calendar branch root is season-agnostic (`/calendar`) and resolves the
current season locally. Tapping an event opens `/calendar/<season>/<round>` via
`context.openEntity`, using the event's own stored `season` and `round` — never
a display name and never a hardcoded year.

Grand Prix detail renders on the **root navigator** (§4), so the Calendar
branch, its stack and its scroll position are preserved underneath. Back
(app-bar or Android system back) returns to exactly that position.

### 9.2 Calendar scroll and branch state

`CalendarScreen` owns a `ScrollController` for the branch session. Because the
shell keeps each branch's state in an `IndexedStack`, that controller — and the
user's scroll offset — survives switching to another branch and back, and
survives returning from Grand Prix detail.

On the first useful render of a branch session the list is positioned **once** so
the current/next relevant event is near the top, with earlier events still
reachable above it. `CalendarScrollAnchor` converges deterministically within a
bounded number of frames (scroll the anchored row into view if it is built,
otherwise jump to a proportional estimate and retry next frame) — no timer and
no arbitrary delay. It never repositions again: not for a later Drift emission,
not after a background refresh and not on return from a detail screen.
Re-selecting the Calendar branch returns it to its root through the existing
shell behaviour without creating a duplicate route.

### 9.3 Grand Prix to Circuit, Driver and Constructor

All three use stable identifiers through `RoutePaths`:

- the circuit action opens `/circuits/<circuitId>`;
- a result row's primary action opens `/drivers/<driverId>`;
- the team name inside a result row is a **separate** hit area (at least
  48 logical pixels, with its own button semantics) that opens
  `/constructors/<constructorId>`.

The two hit areas are stacked rather than nested, so there are no competing tap
regions. Immediate-loop prevention (§4) is unchanged: Grand Prix → Circuit →
that same Grand Prix returns to the existing route instead of stacking a
duplicate.

Circuit, driver and constructor detail content was a skeleton when this section
was written. **Phase 7C implemented all three**: each renders local content
immediately and triggers one on-demand refresh of its exact resource (§11).

### 9.4 Deep links and invalid parameters

`/calendar/:season/:round` continues to open directly, independently of the
current Calendar season — Grand Prix detail is keyed by its own route values.
An invalid season or round still resolves to the controlled invalid-parameter
screen, and a Grand Prix that a successful refresh proves does not exist shows a
controlled not-found state with a recovery action.

## 10. Standings navigation (Phase 7B)

### 10.1 Branch root and explicit season routes

Three routes remain registered inside the Standings branch:

- `/standings` — season- **and** championship-agnostic. It resolves the current
  season locally and shows Drivers on the first visit of an application session.
- `/standings/drivers/:season`
- `/standings/constructors/:season`

The explicit routes render their exact validated route season (an invalid season
still resolves to the controlled invalid-parameter screen) and select the
championship they encode, even when that season is not the current one.

### 10.2 Selector and URL behaviour

The championship selector is presentation, not navigation — it never issues a
request.

- On `/standings` a selector change stays internal to the screen: the
  season-agnostic location is preserved and no season is invented in the URL.
- On an explicit season route it `go`es to the **sibling** route for the same
  season. Both routes are siblings at branch level, so this replaces the current
  page: switching back and forth can never build a
  Drivers → Constructors → Drivers stack.

The selected championship lives in `standingsUiStateProvider` for the
application session, so it survives a bottom-navigation branch switch and a
Driver/Constructor detail round trip. Nothing is persisted across launches in
Phase 7B: a fresh launch starts at Drivers.

### 10.3 Independent scroll positions

Each table has its **own** `ScrollController` — never one shared between them —
plus a `PageStorageKey`, and the branch's remembered offsets live in
`standingsUiStateProvider`. Switching Drivers → Constructors → Drivers restores
each table's own position, as does a branch switch and a return from detail. A
Drift emission or a background refresh never resets a list. Offsets are scoped to
the season they were taken in, so a season transition starts the new season's
tables at the top without disturbing the cached rows of any other season.

### 10.4 Standings to Driver and Constructor

Both use stable identifiers through `RoutePaths`, never a display name:

- a drivers' row opens `/drivers/<driverId>`;
- a constructors' row opens `/constructors/<constructorId>`.

Both detail routes render on the **root navigator** (§4), so the Standings
branch, its selected championship and both scroll positions are preserved
underneath; back (app-bar or Android system back) returns to exactly that state.
Immediate-loop prevention (§4) is unchanged, and only public go_router APIs are
used.

Driver and constructor detail **content** was a skeleton when this section was
written. **Phase 7C implemented both** (§11); the entry points described here are
unchanged.

## 11. Explore and entity-detail navigation (Phase 7C)

### 11.1 Explore route and category model

Explore has one screen and four route-addressable locations. The three category
routes are **siblings** of the branch root, not children of it:

| Location | Renders |
|---|---|
| `/explore` | `ExploreScreen` with the default category (Drivers) |
| `/explore/drivers` | `ExploreScreen(category: drivers)` |
| `/explore/teams` | `ExploreScreen(category: teams)` |
| `/explore/circuits` | `ExploreScreen(category: circuits)` |

Because they are siblings, selecting a category uses branch-level `go` semantics
and **replaces** the Explore page inside its branch — a category switch can never
stack a second Explore page, and repeated taps on the active category change
nothing. An explicit URL opens the category it encodes; an unrecognised segment
(`/explore/not-a-category`) falls through to the controlled not-found screen.

The Phase 3 entry-card model is gone: category cards are not reintroduced as a
second, competing navigation model. There is no Explore search in Phase 7C.

Branch behaviour is unchanged from the approved shell rules: switching bottom
navigation preserves the selected Explore route and every scroll offset, and
re-selecting the active Explore item returns the branch to its root
(`/explore`).

### 11.2 Category and scroll preservation

`ExploreUiState` (a root-scope, session-lived provider) remembers one scroll
offset per category, plus the season those offsets belong to. The selected
category itself is **route state**, not stored here.

- One `ScrollController` per category, never shared, so the three lists keep
  genuinely independent positions.
- Offsets are recorded without rebuilding anything, so a Drift emission or a
  focused refresh never resets a list.
- A season transition starts the new season's lists at the top rather than at a
  stale position; the previous season's rows on disk are untouched.
- Returning from an entity detail restores the exact originating category and
  offset, because details render above the shell.

### 11.3 Season context on detail routes

The public detail routes are unchanged and still carry only a stable identifier:

- `/drivers/:driverId`
- `/constructors/:constructorId`
- `/circuits/:circuitId`

The detail resources are season-scoped, so the season travels as typed,
runtime-only navigation metadata:

```dart
context.openEntity(RoutePaths.driver(id), season: resolvedSeason);
```

`EntityNavigationOrigin` now carries an optional `season` alongside the origin
location. It is never serialized, so a deep link simply arrives without one and
the screen resolves the current season locally. No route path was changed, no
query parameter was introduced, and no year is ever hardcoded. See
`GridView_Synchronization.md` §14.8 for the full origin/season table.

If neither an origin season nor a locally stored current season exists, the
screen shows a controlled season-unavailable state with a retry and makes no
season-scoped request.

### 11.4 Cross-entity navigation

| From | To | Route |
|---|---|---|
| Explore Drivers | Driver | `/drivers/<driverId>` |
| Explore Teams | Team | `/constructors/<constructorId>` |
| Explore Circuits | Circuit | `/circuits/<circuitId>` |
| Standings row | Driver / Team | same, with the table's exact season |
| Grand Prix result | Driver / Team | same, with the classification's season |
| Grand Prix | Circuit | `/circuits/<circuitId>`, with the event's season |
| Driver detail | Team | `/constructors/<constructorId>` |
| Team detail | Driver | `/drivers/<driverId>` |
| Driver / Team detail | Standings | `/standings/drivers|constructors/<season>` |
| Circuit detail | Grand Prix | `/calendar/<season>/<round>` |

Every route is built from a stable identifier through `RoutePaths`; no display
name ever reaches a URL. Details remain on the root navigator above the shell, so
Android back returns to the exact originating branch, category and scroll
position.

### 11.5 Loop prevention

`GridViewNavigation.openEntity` is unchanged in principle: when the target is the
page **directly beneath** the current one, it pops instead of pushing, so
`A → B → A` collapses rather than accumulating duplicate entity pages. Adding the
season to `EntityNavigationOrigin` does not affect the comparison, which is still
by path.

Covered by tests: Driver → Team → same Driver, Team → Driver → same Team, and
Grand Prix → Circuit → same Grand Prix all pop; navigation to a *different*
entity still pushes normally; repeated taps never stack identical routes.
