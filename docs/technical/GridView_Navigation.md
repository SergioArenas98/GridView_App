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

Screens consume `lib/features/shared/presentation/placeholder/placeholder_content.dart`
— presentation-only models with deterministic mock values. **No API DTO or domain
entity is imported into a presentation widget.** Team colours appear only as
restrained accents (a line, dot or small highlight), never as full row
backgrounds. Real data replaces the placeholders in Phase 4.
