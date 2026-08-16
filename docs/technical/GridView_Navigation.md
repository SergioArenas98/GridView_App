# GridView Navigation

Phase 3B navigation shell and routing. Implemented with
[`go_router`](https://pub.dev/packages/go_router) (17.x) and a
`StatefulShellRoute.indexedStack`. All screens are **data-independent
skeletons**: they render deterministic placeholder content only. No repository,
controller, data source, Worker call, Firebase or advertising is involved.

Source of truth for the intended flows: `../product/GridView_App_Flow.md`.

## 1. Shell and branches

The app is a state-preserving `IndexedStack` of four primary branches, each with
its own `Navigator`. The shell (`lib/app/router/app_shell.dart`) renders a
floating elevated pill bottom navigation (`GvBottomNav`) placed as the scaffold's
`bottomNavigationBar` so it reserves layout space — scrollable content is never
hidden behind it.

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
  resolves the active season from presentation-only mock data
  (`Placeholders.season`), and in later phases from the local database. The
  `/standings/drivers/:season` and `/standings/constructors/:season` routes
  remain for season-specific deep links.
- **Re-selecting the active branch** returns it to its branch root
  (`goBranch(index, initialLocation: index == currentIndex)`); repeated taps do
  not stack duplicate routes.
- The **selected state** is conveyed by icon/label weight and a selected
  semantics flag, not by colour alone.

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
| `/explore/drivers` | `explore-drivers` | Explore branch | `DriverListScreen` |
| `/explore/teams` | `explore-teams` | Explore branch | `ConstructorListScreen` |
| `/explore/circuits` | `explore-circuits` | Explore branch | `CircuitListScreen` |
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

Circuit, driver and constructor detail content itself remains a skeleton until
Phases 7C/7D; only the routes are wired.

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

Driver and constructor detail **content** remains a skeleton until Phase 7C; only
the entry points are wired.

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
