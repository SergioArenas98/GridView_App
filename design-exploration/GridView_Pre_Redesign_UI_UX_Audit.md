# GridView — Pre-Redesign UI/UX Audit

<!-- primer-v2-status-notice -->
> **Historical record.** This document records the audit of the pre-redesign interface that preceded Primer V2. It is not current guidance: Primer V2 is
> implemented in Flutter. Current guidance:
> [GridView_Design_System.md](../docs/technical/GridView_Design_System.md); decisions:
> [DESIGN-DECISIONS.md](prototypes/primer-v2/DESIGN-DECISIONS.md); open work:
> [DESIGN-BACKLOG.md](prototypes/primer-v2/DESIGN-BACKLOG.md). Statements about status, next steps or
> what is not yet implemented describe the date it was written. Validation
> folders it names (`validation-*/`) are not part of the published
> repository; see [Validation output](prototypes/primer-v2/README.md#validation-output).

## 1. Executive Summary

GridView’s presentation can be substantially redesigned without replacing its application architecture. Its existing Flutter implementation separates domain data, presentation states, formatting, navigation, media handling, and reusable widgets. Those boundaries provide a useful foundation for changing the visual identity while preserving information and behavior.

The audit identifies 19 regular screen/view variants, including both standings tables, all three Explore categories, and seven Settings sub-screens. Additional surfaces include route-error screens, a development component catalogue, environment and fixture notices, transient feedback messages, and the native Android launch surface.

The most important preservation requirements are:

- Keep every currently rendered field, including conditional profile facts, participation spans, result details, attribution notices, and preference descriptions.
- Preserve distinctions between unknown, unavailable, empty, loading, provisional, stale, and refresh-failed information.
- Preserve season context and relationships when navigating among events, circuits, drivers, teams, and standings.
- Keep cached information visible during refreshes and failures.
- Preserve English/Spanish localization, timezone preferences, both themes, text scaling, and accessible interaction.
- Do not turn API identifiers, inferred chronology, or missing values into fabricated information.

Several discrepancies require attention before redesign implementation:

1. Results scope: the PRD specifies race results only for release 2.0.0, but Flutter still renders stored sprint classifications, and a widget test explicitly requires that behavior.
2. Fonts: Sora and Inter are documented, but neither is configured or bundled. The implementation uses the framework/platform font fallback.
3. Freshness: presentation is inconsistent across screens. Explore carries freshness in its state but does not render stale notices or timestamps.
4. Circuit requirements: older product requirements mention lap counts and race distance; neither is currently displayed, and neither exists in the inspected Circuit or GrandPrix contract schemas.
5. Accessibility: the repository documents unresolved limitations. Existing tests do not establish complete visual readability or device-level accessibility compliance.

Audit boundary and verification

- Worktree verified: `wt-ui-redesign` (local Git worktree of this repository, `<local-projects-dir>/GridView/wt-ui-redesign`)
- Active branch verified: design/ui-redesign
- Inspected commit: aea1387
- Git working tree was clean at the beginning and at the final status check.
- Inspection was local and read-only.
- No repository files were created or modified.
- No app, test suite, build, network request, deployment, synchronization job, or backend procedure was executed.
- Findings describe source behavior and existing test assertions, not a freshly executed runtime validation.

The audit treats implementation and tests as evidence of current behavior, the PRD as product scope, and later technical decisions as qualifications of older design documents.

———

## 2. Complete Screen and Navigation Inventory

### 2.1 Navigation foundation

Routing is implemented by buildGridViewRouter() using StatefulShellRoute.indexedStack. Home, Calendar, Standings, and Explore each have their own branch navigator.

Grand Prix details, entity details, Settings, and Settings sub-screens appear above the shell on the root navigator.

Sources: app_router.dart (lib/app/router/app_router.dart), route_paths.dart (lib/app/router/route_paths.dart), entity_navigation.dart (lib/app/router/entity_navigation.dart).

Shared infrastructure:

- GvScreenScaffold: app bar, optional Settings/refresh actions, safe-area body.
- AppShell / GvBottomNav: four primary destinations.
- GvScreenSection / GvSectionHeader: section headings and optional actions.
- GvHeroCard, GvContentCard, GvInfoCard, GvDetailField: presentation containers.
- Shared loading, error, empty, stale, image, button, and row components.

### 2.2 Regular screen/view inventory

Field identifiers below refer to the verification matrices in Section 3.

| # | Screen/view and purpose | Route | Main widgets and shared components | Actions and navigation | Relevant states |
|---|---|---|---|---|---|
| 1 | Home: immediate season overview | / | HomeScreen, HomeHero, HomeSessionBlock, HomeLeaderCard, HomeLatestResultCard, HomeUpcomingList; hero/content cards, session rows, notices | Open featured GP; open focused session’s GP; open leader detail; open exact-season standings; open upcoming GP; Calendar and Explore shortcuts; Settings; refresh | Loading, unresolved season, first-load error, season empty, ready with independently resolving/empty/unavailable modules; stale/partial/refresh failure |
| 2 | Calendar: complete current-season event list | /calendar | CalendarScreen, CalendarEventCard, CalendarScrollAnchor; content cards, status chips | Open GP by season/round; initial positioning at relevant event; scroll; Settings; refresh | Loading, unresolved season/resource error, materialized empty calendar, ready, stale, refreshing, failed refresh |
| 3 | Grand Prix detail: weekend facts, schedule, classifications | /calendar/:season/:round | GrandPrixDetailScreen, GrandPrixHero, GrandPrixEventInfo, SessionList, GrandPrixResultSection, GvResultRow | Open circuit; open result driver; separately open result team; retry detail/results errors; return Home on GP not-found; Back | Detail loading/not-found/error/ready; independent result unavailable/loading/error/ready; empty sessions; partial facts; stale/cached failures |
| 4 | Drivers’ standings | /standings, /standings/drivers/:season | StandingsScreen, _DriversTable, StandingsRowView, GvStandingsRow, GvSegmentedControl | Switch championship; open driver; Settings; refresh | Per-table loading/error/empty/ready; unresolved season; ties, unranked rows, provisional/mixed data; stale/refreshing/failure |
| 5 | Constructors’ standings | /standings/constructors/:season; also selector at /standings | StandingsScreen, _ConstructorsTable, same shared table components | Switch championship; open team; Settings; refresh | Same table-state family, independently scoped |
| 6 | Explore — Drivers | /explore, /explore/drivers | ExploreScreen, ExploreCollectionView<SeasonDriverCard>, ExploreDriverCardRow, GvDriverRow, GvRemoteImage | Switch category; open driver; retry empty/error state; Settings | Loading/error/empty/ready; partial cards; refreshing/failure notice; media fallback |
| 7 | Explore — Teams | /explore/teams | ExploreTeamCardRow, GvTeamRow, common Explore components | Open team; category switching; retry; Settings | Same collection-state family |
| 8 | Explore — Circuits | /explore/circuits | ExploreCircuitCardRow, GvCircuitRow, common Explore components | Open circuit; category switching; retry; Settings | Same collection-state family |
| 9 | Driver detail: identity, participation, championship, biography | /drivers/:driverId | DriverDetailScreen, _DriverHero, EntityDetailScaffold<DriverProfile>; team row, fields, status chip, remote image | Open relevant team; open exact-season driver standings when standing exists; retry initial error; Back | Loading, season unavailable, not-found, first-load error, partial/complete ready, detail unavailable, stale, refresh failure |
| 10 | Team detail: season branding, championship, line-up, facts | /constructors/:constructorId | ConstructorDetailScreen, _TeamHero, EntityDetailScaffold<TeamProfile>; driver rows, fields, image | Open line-up driver; open exact-season constructor standings when standing exists; retry initial error; Back | Same detail-state family; optional line-up/facts/biography |
| 11 | Circuit detail: circuit identity, physical facts, lap record, related event | /circuits/:circuitId | CircuitDetailScreen, _CircuitHero, EntityDetailScaffold<CircuitProfile>; fields, event card, image | Open related GP when present; retry initial error; Back | Same detail-state family; valid absence of related event; partial lap record/physical facts |
| 12 | Settings root | /settings | SettingsScreen, GvSettingsRow, GvInfoCard | Open seven sub-screens; external feedback action when configured; development catalogue outside production | Current preference values; configured/absent support contact; environment-dependent developer section |
| 13 | Language selection | /settings/language | LanguageSettingsScreen, PreferenceChoiceScreen, GvSettingsOption | Select System default / English / Español; Back | Selected/unselected; immediate application; persistence failure with rollback and snackbar |
| 14 | Theme selection | /settings/theme | ThemeSettingsScreen, same choice components | Select System / Dark / Light; Back | Same preference behavior |
| 15 | Time display selection | /settings/time | TimeDisplaySettingsScreen, same choice components | Select Device / Event / Both; Back | Same preference behavior |
| 16 | Data and updates | /settings/data | DataSettingsScreen, GvSettingsField | Read-only; Back | Remote/sample/frozen/unverified data descriptions; unresolved current season |
| 17 | Acknowledgements | /settings/acknowledgements | AcknowledgementsScreen, DataSourceAttributionCard, settings fields/rows | Open source project, terms, license externally; Back | Sources resolving/error/empty/populated; media credits resolving/empty/populated |
| 18 | Privacy and legal | /settings/privacy | PrivacySettingsScreen, GvSettingsField, GvSettingsRow | Open configured privacy policy externally; Back | Build policy; session reporting pending/active/unconfirmed/omitted; missing policy treatment differs by environment |
| 19 | App information | /settings/about | AboutSettingsScreen, GvSettingsField | Read-only; Back | Package metadata resolved/unresolved; missing version/build omitted |

### 2.3 Additional surfaces

| Surface | Entry and purpose | Information/interactions |
|---|---|---|
| Unknown route / invalid parameters | Router error builder or failed RouteParams validation; NotFoundScreen | App title; distinct unknown-route or invalid-link heading/message; Home action |
| Component catalogue | Settings → Developer, development/staging only; imperative MaterialPageRoute, no named URL | Demonstrates buttons, selector, chips, navigation, cards, rows, team accents, skeletons, empty/error/offline states, image placeholder, reserved ad container, long text, 1.8× text, narrow layout |
| Build-environment strip | EnvironmentBadgeOverlay, globally outside production | DEV or STAGING; separate noninteractive strip above application content |
| Fixture-data banner | Conditional on Home, Calendar, Standings, Explore and GP detail | Sample, frozen capture with date, or unverified-origin copy |
| Preference-save snackbar | Failed preference persistence | Localized failure message; selection has already reverted |
| External-open snackbar | Failed external application launch | Localized failure message; no raw exception or destination exposed |
| Native launch surface | Before Flutter’s first frame | Android launch theme/background and OS-managed launcher presentation; no application data or Flutter route |

No application showDialog or showModalBottomSheet call sites were found. There is no implemented onboarding, login, search screen, season picker, notification centre, favorites screen, media gallery, or in-app browser.

### 2.4 Navigation behavior to retain

- Switching primary branches restores their navigation/scroll context.
- Re-selecting the active primary destination returns it to its branch root.
- Explore categories are sibling routes replaced using go; switching categories does not accumulate pages.
- Standings selection is retained during the application session. Driver and constructor tables have independent remembered scroll offsets.
- Explicit-season standings routes retain their exact season.
- Entity routes carry stable identifiers. The originating season travels in EntityNavigationOrigin, rather than in the entity URL.
- Direct entity entry without origin metadata resolves the current season locally.
- openEntity() collapses an immediate A → B → A return into pop(). It does not implement arbitrary global stack deduplication.
- Settings preserves the originating branch. Repeated openSettings() calls do not stack Settings again.
- Home shortcuts use branch navigation; related-entity navigation uses openEntity().
- Calendar positions the relevant event once, rather than moving the user after every data update.
- App-bar and Android Back return through the existing stack.
- Route validation accepts seasons 1950–2100, rounds 1–30, and lowercase kebab identifiers up to 64 characters. Invalid input gets a controlled error surface.

The router is directly addressable, but the inspected Android manifest contains only the launcher intent filter, not public HTTP App Link routing.

———

## 3. Screen-by-Screen Displayed Information Matrix

### 3.1 Reading the checklist

Each identifier below is a preservation checkpoint.

Source classification:

| Code | Meaning |
|---|---|
| A | Public API field, retained through DTO/domain/local persistence |
| D | Domain/read-model composition, usually joining API-backed entities |
| C | Client-derived value, selection, formatting, or local metadata |
| U | User preference |
| P | Presentation copy, bundled attribution/configuration, or build presentation |

A → D means the displayed value is API-backed but resolved through a local read model. This does not imply a network request during rendering.

Unless a row says otherwise:

- Optional null values are omitted.
- Missing numbers are not converted to zero.
- Genuine zero values remain visible.
- Supplied proper names and biographies are displayed as supplied.
- App-authored labels are localized through AppLocalizations.
- Stable IDs remain navigation/internal values.
- Joined optional text omits missing parts rather than leaving dangling separators.

Relevant contract: gridview-api-v1.yaml (docs/api/gridview-api-v1.yaml), particularly Driver, Constructor, Circuit, LapRecord, Session, GrandPrix, season entries, standings, and race-result schemas.

### 3.2 Home

Source: home_screen.dart (lib/features/home/presentation/home_screen.dart), its widgets/ directory, HomeFormatter, and home_state.dart.

| ID | Element | Source/property or computation | Rendering and conditions |
|---|---|---|---|
| H01 | Application name | P: l10n.appTitle | GvScreenScaffold app-bar title |
| H02 | Season year | A → D: HomeReady.seasonYear / HomeSeasonEmpty.seasonYear | _SeasonHeading; localized seasonLabel, plain year without grouping |
| H03 | Featured-event section meaning | C: HomeTemporalPhase through HomeFormatter.heroTitle() | “Next Grand Prix”, “Current Grand Prix”, or “Latest Grand Prix”; not a direct API field |
| H04 | GP name | A: module.focus.grandPrix.name | HomeHero; heading, maximum two lines |
| H05 | Round number | A: grandPrix.round | Localized round label |
| H06 | Circuit name | A → D: focus.circuit?.name | Hero subtitle when resolved |
| H07 | Locality | A → D: focus.circuit?.locality | Joined with country |
| H08 | Country | A → D: focus.circuit?.country | Joined with locality; absent parts omitted |
| H09 | Weekend dates | A: startDate, endDate; C: formatDateRange() | Localized calendar-date range; one known endpoint can render alone; no timezone conversion |
| H10 | Event status | A + P: grandPrix.status, requiredEventStatusLabel() | Always a textual chip, including “Status unknown” |
| H11 | Race-weekend context | C: module.phase == raceWeekend | Additional “Race weekend” chip; distinct from supplied event status |
| H12 | Sprint-weekend indicator | A + P: format == sprint | Sprint chip only; Home does not display a standard/unknown-format chip here |
| H13 | Relative start information | C: focused session start/status and injected now | “Live now”, “Starting soon”, or starts in minutes/hours/days. No label for an absent or elapsed non-live start |
| H14 | Event/circuit imagery | A → D: eventMedia, circuitMedia; EventHeroImage | Event imagery preferred, circuit fallback; stable placeholder when neither is suitable |
| H15 | Focused-session heading | C: HomeSessionFocus.isLive | Current session if live; otherwise Next session. See the latest fallback discrepancy in §8 |
| H16 | Focused-session name | A/C: Session.name, otherwise type fallback | HomeSessionFocusView / HomeSessionBlock |
| H17 | Focused-session status | A + P: Session.status | Textual status chip, including unknown |
| H18 | Focused-session explicit date/time/zone | A + C + U: startTime, event timezone, time preference | Primary date/time/zone; optional second clock and differing date. Omitted if start is null |
| H19 | Focused-session relative label | C: HomeFormatter.relativeStart() | Also displayed in focused-session card when truthful |
| H20 | Compact weekend schedule | A → D/C: module.scheduleWindow | Up to three delivered sessions around focus, using all S01–S05 fields below |
| H21 | Device timezone label | C: deviceTimeZoneLabelProvider | Caption when the session block contains focus or schedule content |
| H22 | Missing session information | P: homeSessionUnavailable | “Session times not available” when neither focus nor schedule window exists |
| H23 | Driver leader name | A → D/C: HomeSingleLeader.name from confirmed position 1 | HomeLeaderCard; never chooses a leader from maximum points or first row |
| H24 | Driver leader team | A → D: HomeSingleLeader.teamName | Optional subtitle; based on standings association |
| H25 | Driver leader points | A: HomeSingleLeader.points | Locale-formatted number plus localized compact points unit |
| H26 | Driver leader provisional status | A: provisional == true | Provisional chip |
| H27 | Driver leader team accent | A → D: teamColor; C: GvTeamAccent.parse() | Decorative bar when valid |
| H28 | Constructor leader name | A → D/C: HomeSingleLeader.name | Season-resolved constructor display name |
| H29 | Constructor leader points | A: points | Same points formatting |
| H30 | Constructor leader provisional status/accent | A → D: provisional, teamColor | Same conditions as driver leader |
| H31 | Tied-leader statement | C: multiple confirmed position-1 entries | “Tied leaders”; no arbitrary primary leader |
| H32 | Tied competitors’ names | A → D: HomeTiedLeaders.names | Known names joined with separators; unresolved names omitted |
| H33 | Shared tied points | C over A: _sharedPoints() | Only displayed if all tied rows agree on total |
| H34 | Leader availability | D + P: module materialization/availability | Distinct silent resolving block, “Leader unavailable”, and “No leader yet” |
| H35 | Latest-event identity | A → D: latestResult.event | Name, round, circuit name, locality, country, date range, event status; same fallback rules as relevant shared fields |
| H36 | Latest classification status | A: latestResult.resultStatus | Chip only when a cached race document supplies it |
| H37 | Race winner name | A → D/C: resolveHomeRaceWinner() | Exactly one resolved race entry with position 1; no sprint substitution |
| H38 | Winner team name | A → D: HomeRaceWinner.teamName | Optional, beside winner name |
| H39 | Latest-result availability explanation | A/C/P: cached result, winner resolution, hasResults | Distinguishes winner unavailable, classified result available but not loaded, and result unavailable |
| H40 | Upcoming events | D/C: HomeUpcomingModule.events | Up to three events; CalendarEventCard with C02–C09 fields; no Calendar relevance emphasis passed |
| H41 | Upcoming-module availability | D + P | Resolving, unavailable, available-empty, or populated; “No upcoming events” only for a known empty answer |
| H42 | Last successful Home check | C: homeProvenance.lastSuccessAt | _HomeNotices: localized “Last successful check: HH:mm”; device-local clock; only Home resource’s own timestamp |
| H43 | Refresh progress | C + P: state.refreshing | Refreshing label replaces timestamp on populated Home |
| H44 | Aggregate uncertainty | C + P: refresh error, hasStaleSection, isPartial | Notice precedence: failed update → some information outdated → some information unavailable |
| H45 | Empty-season message | D + P: HomeSeasonEmpty | Season heading, no-published-events message, shortcuts; cached/failure notice where applicable |
| H46 | Section/action labels | P | Weekend sessions, championship headings, Latest result, Upcoming events, View standings, View Calendar, Explore categories, Open GP, refresh and Settings semantics |

The latest-result section is omitted entirely when state.latestResult == null. A missing cached classification does not remove an otherwise valid latest-event summary.

### 3.3 Shared session rendering

Sources: session_list.dart (lib/features/shared/presentation/widgets/session_list.dart), domain_status.dart, and SessionTimePresenter.

| ID | Element | Source/property | Rendering and conditions |
|---|---|---|---|
| S01 | Session name | A: Session.name; C fallback from Session.type | Supplied nonempty name wins. Known unnamed type is humanized from its wire name; unknown type gets localized “Session” |
| S02 | Session status | A: Session.status | Scheduled, Live, Completed, Cancelled, Postponed, or Status unknown |
| S03 | Primary session date | A + C + U: startTime under chosen timezone | Localized weekday and month/day in subtitle; absent when start is null |
| S04 | Primary session clock and zone | A + C + U | HH:mm through DateFormat.Hm, followed by zone abbreviation/name |
| S05 | Secondary clock/zone/date | C + U: Both preference | Second line only when the formatted clocks differ; includes secondary day when conversion crosses a date boundary |

SessionList renders sessions in delivered order. It does not supply tap handlers to individual rows. Home’s separate focused-session card is tappable.

No session end time, duration, lap timing, or session-result selector is rendered.

### 3.4 Calendar

Sources: calendar_screen.dart (lib/features/calendar/presentation/calendar_screen.dart), widgets/calendar_event_card.dart.

| ID | Element | Source/property | Rendering and conditions |
|---|---|---|---|
| C01 | Season year | A → D: CalendarReady.season / CalendarEmpty.season | Localized heading |
| C02 | Round number | A: CalendarEntry.round | Leading number; never list index |
| C03 | GP name | A: entry.grandPrix.name | Main card text |
| C04 | Circuit name | A → D: entry.circuitName | Optional subtitle component |
| C05 | Locality | A → D: entry.locality | Optional location component |
| C06 | Country | A → D: entry.country | Optional location component |
| C07 | Weekend dates | A/C: startDate, endDate, SessionTimePresenter.formatDateRange() | Same date-only range policy as Home |
| C08 | Event status | A/P: grandPrix.status | Required textual chip, including unknown |
| C09 | Sprint-weekend flag | A/P: format == sprint | Additional chip only for sprint |
| C10 | Next-event designation | C: resolveRelevantEvent(), CalendarEventEmphasis.next | “Next” chip |
| C11 | Current-event emphasis | C: relevant event with inProgress == true | Accent emphasis; does not fabricate a supplied lifecycle status |
| C12 | Completed-event treatment | A/C: status completed and not emphasized | Reduced opacity; text remains present |
| C13 | Last successful check | C: lastSuccessAt | Localized label with device-local Hm |
| C14 | Refresh progress | C: refreshing | Timestamp label displays an ellipsis during refresh |
| C15 | Stale/refresh-failed notice | C/P: isStale, refreshError | Cached-data notice; failure wording takes precedence |
| C16 | Empty/error/context copy | D/P | Distinct empty calendar, season unavailable, and typed resource-error messages |

No Calendar row image, session start time, calendar progress percentage, or season selector is currently rendered.

### 3.5 Grand Prix detail

Sources: grand_prix_detail_screen.dart (lib/features/calendar/presentation/grand_prix_detail_screen.dart), grand_prix_hero.dart, grand_prix_event_info.dart, and grand_prix_results_section.dart.

| ID | Element | Source/property | Rendering and conditions |
|---|---|---|---|
| GP01 | App-bar event identity | A/C: grandPrixScreenTitle() | Trimmed event name when ready and nonblank; otherwise localized Grand Prix |
| GP02 | Hero GP name | A: view.grandPrix.name | Main heading |
| GP03 | Official name | A: officialName | Only when non-null and different from name |
| GP04 | Round | A: grandPrix.round | Localized round label |
| GP05 | Season | A: grandPrix.season | Localized season label |
| GP06 | Locality and country | A → D: view.circuit | Optional joined location in hero and factual block |
| GP07 | Weekend date range | A/C: startDate, endDate | Hero and factual block; omitted if neither date is usable |
| GP08 | Event status | A/P: status | Required chip, including unknown |
| GP09 | Weekend format | A/P: format | Standard weekend, Sprint weekend, or Format unknown |
| GP10 | Event/circuit image | A → D: event media, then circuit media | No background widget when no suitable asset exists; typography remains |
| GP11 | Circuit name | A → D: view.circuit?.name | GvDetailField; omitted if unresolved |
| GP12 | Event timezone | A: grandPrix.timezone | Raw declared IANA identifier as factual value when non-null |
| GP13 | Device timezone | C: deviceTimeZoneLabelProvider | Always supplied to factual block |
| GP14 | Full weekend schedule | A: grandPrix.sessions | Every delivered session with S01–S05 |
| GP15 | No-sessions message | P | Dedicated empty state when sessions list is empty |
| GP16 | Detail/result freshness notices | C/P | Stale and refresh-failed notices; remote-build stale aggregation described in §4 |
| GP17 | Circuit navigation label | P | View circuit button; route uses stored circuitId even if circuit name is unresolved |

#### Classification fields

| ID | Element | Source/property | Rendering and conditions |
|---|---|---|---|
| R01 | Classification section title | A/P: RaceResult.sessionType | Race results / Sprint results / generic Results for other types |
| R02 | Classification status | A/P: RaceResult.status | Provisional, Final, Not available, or Status unknown |
| R03 | Finishing position | A: RaceResultEntry.position | Number or —; duplicates retained |
| R04 | Driver name | A → D: entry.driverName | Localized unavailable name if unresolved; ID remains usable for navigation |
| R05 | Constructor name | A → D: entry.constructorName | Localized unavailable name if unresolved |
| R06 | Points scored | A: entry.points | Locale decimal formatting; null omitted; zero retained |
| R07 | Finish status | A/P: entry.status | Lapped, DNF, DNS, DSQ, DNQ, unknown shown visibly. “Finished” omitted visually but retained in semantic label |
| R08 | Elapsed race time | A/C: elapsedTimeMillis → entry.elapsedTime | First timing choice; h:mm:ss.mmm, or m:ss.mmm without hours |
| R09 | Gap to leader | A/C: gapToLeaderMillis → entry.gapToLeader | Used only without elapsed time; +s.mmm or +m:ss.mmm |
| R10 | Laps behind | A/P: entry.lapsBehind | Used if neither structured elapsed nor gap exists and value is greater than zero; localized plural |
| R11 | Supplied gap fallback | A: entry.gapText | Last timing fallback; displayed verbatim |
| R12 | Fastest-lap badge | A/C: entry.fastestLap == true OR document fastestLap.driverId matches row | Badge only; no fastest-lap time or lap number displayed |
| R13 | Driver action | D/P: entry.driverId, document.season | Open driver, preserving classification season |
| R14 | Separate team action | D/P: constructorId, resolved team name | Separate interactive team area; unnamed localized action when name unavailable |
| R15 | Results unavailable/error/loading copy | D/P: GrandPrixResultsState | Scoped result area, independently from weekend facts |

Only documents with nonempty entries enter GrandPrixResultsReady. Stored classifications remain eligible even if a later event summary says hasResults == false.

Release conflict: R01 describes the implemented renderer. It is not authorization to include sprint or other non-race results in the 2.0.0 redesign.

### 3.6 Standings

Sources: standings_screen.dart (lib/features/standings/presentation/standings_screen.dart), standings_row_view.dart (lib/features/standings/presentation/standings_row_view.dart).

| ID | Element | Source/property | Rendering and conditions |
|---|---|---|---|
| ST01 | Season | A → D: StandingsScreenState.season | Heading only when resolved |
| ST02 | Championship labels and selection | P/C: StandingsChampionship | Drivers / Constructors; selected state conveyed visually and semantically |
| ST03 | Driver position | A: DriverStandingEntry.position | Number or —; semantic “unranked” fallback |
| ST04 | Driver name | A → D: driverName | Localized unavailable copy if unresolved |
| ST05 | Driver’s standings team | A → D: constructorName | Optional; derived from the standing’s association, not guessed from participation |
| ST06 | Driver points | A: points | Required numeric total; locale decimal format |
| ST07 | Driver wins | A: wins | Localized wins count; null omitted, zero retained |
| ST08 | Driver team accent | A → D: teamColor | Decorative when valid |
| ST09 | Constructor position | A: ConstructorStandingEntry.position | Same unranked behavior |
| ST10 | Constructor name | A → D: displayName | Season name before stable name; unavailable copy if neither resolves |
| ST11 | Constructor points | A: points | Same numeric policy |
| ST12 | Constructor wins | A: wins | Same optional count policy |
| ST13 | Constructor accent | A → D: teamColor | Decorative |
| ST14 | Confirmed leader emphasis | C: position == 1 | Every confirmed leader emphasized; ties announced as ties |
| ST15 | Provisional information | A/C: row provisional, StandingsProvisionalSummary | Uniform provisional table gets one notice. Mixed table marks only rows explicitly provisional. Null does not become final |
| ST16 | Last successful check | C: selected table’s lastSuccessAt | Device-local Hm; never borrows the other table’s timestamp |
| ST17 | Refresh progress | C/P | Refreshing label replaces timestamp |
| ST18 | Stale/failure notice | C/P | Retains cached rows; failure takes precedence |
| ST19 | Loading/empty/error copy | D/P | Independently scoped to selected championship |

Driver podiums and short codes exist in read models but are not rendered in the standings table.

### 3.7 Explore categories

Sources: explore_cards.dart (lib/features/explore/presentation/explore_cards.dart), explore_screen.dart, explore_collection_view.dart, and season_card.dart.

Shared information: resolved season heading; category labels/selected state; fixture banner where applicable; collection-specific empty/error copy; refresh-failure notice or thin progress indicator.

#### Drivers

| ID | Element | Source/property | Rendering and conditions |
|---|---|---|---|
| ED01 | Driver name | A → D: SeasonDriverCard.name | GvDriverRow; unresolved identities do not become cards |
| ED02 | Team name | A → D: teamName | Relevant participation’s team; season branding resolved locally; absent if unavailable |
| ED03 | Nationality | A: nationality | Optional subtitle component |
| ED04 | Championship position | A → D: position | Only when non-null; no unranked placeholder in Explore |
| ED05 | Championship points | A → D: points | Optional locale-formatted number |
| ED06 | Season race number | A: raceNumber | Optional trailing number; no permanent-number fallback here |
| ED07 | Short code | A → D: shortCode | Season-entry code, otherwise driver identity code; optional trailing text |
| ED08 | Team accent | A → D: teamColor | Decorative bar when valid |
| ED09 | Portrait thumbnail | A → D: media | Driver-owned media, otherwise person placeholder |

Position and points appear as compact bare numbers, not separately labelled statistics.

#### Teams

| ID | Element | Source/property | Rendering and conditions |
|---|---|---|---|
| ET01 | Team display name | A → D: SeasonTeamCard.displayName | seasonName ?? shortName ?? stableName; DAO can supply stable short name as short-name fallback |
| ET02 | Championship position | A → D: position | Only when known |
| ET03 | Championship points | A → D: points | Only when known; locale decimal format |
| ET04 | Power unit | A: powerUnit | Optional subtitle component |
| ET05 | Line-up summary | A → D/C: lineup.map(shortCode ?? name) | Joined list; absent for empty line-up; no individual driver actions in this summary |
| ET06 | Team accent | A → D: teamColor | Season color before stable color |
| ET07 | Team image | A → D: stable constructor media | Logo/car/generic accepted imagery; shield fallback; not season-specific livery |

Nationality and country code are not displayed in this collection.

#### Circuits

| ID | Element | Source/property | Rendering and conditions |
|---|---|---|---|
| EC01 | Circuit name | A → D: SeasonCircuitCard.name | GvCircuitRow |
| EC02 | Locality | A: locality | Optional joined location |
| EC03 | Country | A: country | Optional joined location |
| EC04 | Related GP name | A → D: relatedGrandPrix?.name | Optional event line; no invented name if absent |
| EC05 | Related GP start date | A/C: relatedGrandPrix.startDate | Localized yMMMd; date-only |
| EC06 | Circuit length | A/C: lengthMeters / 1000 | Locale-formatted kilometres with unit |
| EC07 | Circuit thumbnail | A → D: media | Circuit-layout preference, then permitted imagery; route placeholder |

Corner count, related event round/status/format/end date, and country code are not displayed in the Explore circuit row.

Collection ordering: drivers use race-number order with unnumbered drivers last and name tie-breaking; teams use stable-name order; circuits use calendar-related order. These are not user-selectable sorting controls.

### 3.8 Driver detail

Sources: driver_detail_screen.dart (lib/features/drivers/presentation/driver_detail_screen.dart), DriverProfile, DriverParticipation, and EntityFormatter.

| ID | Element | Source/property | Rendering and conditions |
|---|---|---|---|
| D01 | Full name | A: profile.driver.fullName | Hero heading |
| D02 | Hero number | A/C: relevant.raceNumber ?? driver.permanentNumber | #number chip component; omitted if both null |
| D03 | Hero short code | A: driver.shortCode | Joined with number; uses stable driver code here |
| D04 | Hero team name | A → D: relevantParticipation.teamName | Optional subtitle |
| D05 | Nationality | A: driver.nationality | Hero subtitle and profile field when present |
| D06 | Driver portrait | A → D: driver-owned media | Remote image or person placeholder |
| D07 | Related team name/action | A → D: relevant participation | Team section only when a team name resolves; routes using corresponding constructor ID |
| D08 | Relevant-team participation span | A/C: startRound, endRound | Shown beside team link only when multiple participation spans exist |
| D09 | Related team accent | A → D: relevant.teamColor | Decorative |
| D10 | Championship position | A: standing.position | Localized “Unranked” when null; section absent if no standing |
| D11 | Championship points | A: standing.points | Locale decimal number |
| D12 | Season wins | A: standing.wins | Optional count; zero retained |
| D13 | Season podiums | A: standing.podiums | Optional count; zero retained |
| D14 | Provisional standing | A: standing.provisional == true | Provisional chip |
| D15 | Participation team, for every span | A → D: participations[].teamName | Team unavailable fallback when unresolved |
| D16 | Participation role, for every span | A/P: role | Race driver / reserve / test / unknown-role fallback, including null |
| D17 | Participation race number | A: raceNumber | Optional labelled number |
| D18 | Participation boundaries | A/C: startRound, endRound | Both → round range; start only → From round; end only → Until round; neither → From season start |
| D19 | Date of birth | A/C: driver.dateOfBirth | Localized date-only yMMMd |
| D20 | Place of birth | A: driver.placeOfBirth | Optional text |
| D21 | Permanent number | A: driver.permanentNumber | Labelled profile field, distinct from season race number; subject to profile-section gate below |
| D22 | Biography | A: trimmed driver.biography | About section only when nonblank |
| D23 | Partial/stale/failure notice | D/C/P | Shared entity-detail notice rules |
| D24 | Championship navigation label | P | View standings action only when championship section exists |

Exact gate: _profileFacts() first checks DriverProfile.hasProfileFacts. That predicate includes nationality, birth fields, biography, given name and family name, but does not include permanent number. Consequently a permanent number alone does not make its labelled profile row appear, although it may appear in the hero.

Given name and family name are not displayed as separate fields.

The selected season controls the data and outgoing navigation, but this screen does not explicitly print the season year.

### 3.9 Team detail

Sources: constructor_detail_screen.dart (lib/features/constructors/presentation/constructor_detail_screen.dart), TeamProfile, TeamLineupMember.

| ID | Element | Source/property | Rendering and conditions |
|---|---|---|---|
| T01 | Season-aware team name | A → D: seasonEntry.fullName ?? seasonEntry.shortName ?? constructor.name | Hero heading |
| T02 | Stable constructor name | A/C: stableFallbackName | Subtitle only if different from displayed team name |
| T03 | Nationality / registered-country fallback | A/C: constructor.nationality ?? countryCode | Optional hero subtitle |
| T04 | Team accent | A/C: season colorPrimary, otherwise constructor color | Decorative hero bar |
| T05 | Team image | A → D: stable constructor media | Mark/car/generic imagery or shield placeholder |
| T06 | Championship position | A: standing.position | “Unranked” when null; whole section omitted without standing |
| T07 | Championship points | A: standing.points | Locale decimal formatting |
| T08 | Season wins | A: standing.wins | Optional count |
| T09 | Provisional standing | A: standing.provisional | Chip only for true |
| T10 | Line-up driver name | A → D: lineup[].name | One row per participation span; unresolved driver identities omitted upstream |
| T11 | Line-up role | A/P: lineup[].role | Localized role including unknown fallback |
| T12 | Line-up observed span | A/C: startRound, endRound | Shown only when at least one boundary is known |
| T13 | Line-up race number | A: lineup[].raceNumber | Optional trailing number |
| T14 | Line-up short code | A → D: entry code, then driver identity code | Optional trailing code |
| T15 | Power unit | A: seasonEntry.powerUnit | Optional season fact |
| T16 | Team principal | A: seasonEntry.teamPrincipal | Optional season fact |
| T17 | Operational base | A: seasonEntry.base | Optional season fact |
| T18 | Chassis | A: seasonEntry.chassis | Optional season fact |
| T19 | Nationality information field | A: constructor.nationality | Optional stable-identity fact |
| T20 | Biography | A: trimmed constructor.biography | About section only when nonblank |
| T21 | Partial/stale/failure notice | D/C/P | Shared entity-detail notice rules |
| T22 | Championship and driver action labels | P | View standings; open each line-up driver |

Line-up comes from participation records, not an independently invented roster. Multiple spans must not imply that every driver was present simultaneously.

Like Driver detail, Team detail uses exact season context without visibly printing the year.

### 3.10 Circuit detail

Sources: circuit_detail_screen.dart (lib/features/circuits/presentation/circuit_detail_screen.dart), CircuitProfile, EntityFormatter.

| ID | Element | Source/property | Rendering and conditions |
|---|---|---|---|
| CI01 | Circuit name | A: profile.circuit.name | Hero heading |
| CI02 | Locality | A: locality | Optional hero location |
| CI03 | Country | A: country | Optional hero location |
| CI04 | Circuit layout/environmental image | A → D: circuit-owned media | Layout preferred; route placeholder otherwise |
| CI05 | Circuit length | A/C: lengthMeters / 1000 | Localized kilometres |
| CI06 | Corner count | A: cornerCount | Optional whole-number statistic |
| CI07 | Direction | A/P: direction | Omitted for null; localized clockwise/counter-clockwise/unknown for non-null value |
| CI08 | First GP year | A: firstGrandPrixYear | Plain year, no digit grouping |
| CI09 | Lap-record time | A/C: lapRecord.timeMillis → Duration | Shared elapsed-time formatter |
| CI10 | Lap-record holder name | A → D: lapRecord.driverId resolved to lapRecordDriverName | Row only if driver ID exists; unavailable-holder copy if name unresolved |
| CI11 | Lap-record year | A: lapRecord.year | Optional plain year |
| CI12 | Related GP name | A → D: relatedGrandPrix.name | Localized name-unavailable fallback |
| CI13 | Related GP round | A: relatedGrandPrix.round | Localized round label |
| CI14 | Related GP start date | A/C: relatedGrandPrix.startDate | Localized date-only yMMMd |
| CI15 | Related GP status | A/P: nullable relatedGrandPrix.status | Omitted for null; explicit unknown label for unknown enum |
| CI16 | Related GP format | A/P: nullable relatedGrandPrix.format | Omitted for null; localized format otherwise |
| CI17 | No-related-event statement and season | D/P: relatedGrandPrix == null, ready.season | Season label plus no-related-GP message; valid state |
| CI18 | Partial/stale/failure notice | D/C/P | Shared entity-detail notice rules |

Lap-record gate: the section requires a record with a time or year. A record containing only a holder ID is not displayed.

No coordinates, map, lap count, race distance, generic historical paragraph, or lap-record-holder navigation are rendered.

### 3.11 Settings and information screens

Sources: settings_screen.dart (lib/features/settings/presentation/settings_screen.dart), information_screens.dart (lib/features/settings/presentation/information_screens.dart), preference_screens.dart, PreferenceLabels, and settings_rows.dart.

#### Settings root and preferences

| ID | Element | Source/property | Rendering and conditions |
|---|---|---|---|
| SE01 | Preference section and row names | P | Preferences; Language; Theme; Time display |
| SE02 | Current language value | U: AppPreferences.language | Localized System default, English, Español |
| SE03 | Current theme value | U: AppPreferences.theme | System, Dark, Light |
| SE04 | Current time-display value | U: AppPreferences.timeDisplay | Device time, Event time, Both |
| SE05 | Data/application destinations | P | Data and updates; Acknowledgements; App information |
| SE06 | Privacy/support destinations | P/configuration | Privacy and legal; Send feedback when configured |
| SE07 | Absent support contact explanation | P/configuration | Non-production only; production omits unavailable action |
| SE08 | Developer destination | P/build environment | Developer heading, Component catalogue title/description; non-production only |
| SE09 | Language choices | U/P | Three options; System option includes fallback explanation; language names remain recognizable in their own language |
| SE10 | Theme choices | U/P | Three options; System includes follow-device explanation |
| SE11 | Time choices and descriptions | U/P | Device, Event, Both, each with explanation |
| SE12 | Selected preference state | U/P | Radio glyph and semantics; current implementation also composes a selected-state label |
| SE13 | Save failure | C/P | Localized snackbar; previous stored value restored |

#### Data and updates

| ID | Element | Source/property | Rendering and conditions |
|---|---|---|---|
| DA01 | Environment | P: AppEnvironment.label | DEV, STAGING, or PRODUCTION |
| DA02 | Data source | P/D: DataSourceMode, usesMockData, FixtureDataIdentity | GridView service, Sample data, frozen captured data with date, unverified-origin data, or Not configured |
| DA03 | API version | P/configuration: kGridViewApiVersion | Read-only version value |
| DA04 | Current season | A → D: currentSeasonProvider | Year or “Not available yet” |
| DA05 | Data/update explanation | P selected by mode | Remote build explains local storage and downloads; bundled/frozen builds explicitly state that they do not download updates |
| DA06 | Frozen capture date | D/C: FrozenCaptureData.capturedAt | UTC calendar date formatted YYYY-MM-DD, not locale-transformed |

This screen has no refresh button, synchronization toggle, cache-clear action, resource list, or endpoint editor.

#### App information

| ID | Element | Source/property | Rendering and conditions |
|---|---|---|---|
| AB01 | App name | D: AppInfo.appName from package metadata | Falls back to GridView before metadata resolves |
| AB02 | Version | D: AppInfo.version | Omitted when empty/unresolved |
| AB03 | Build number | D: AppInfo.buildNumber | Omitted when empty/unresolved |
| AB04 | Independence statement | P | Not associated with, endorsed by, or affiliated with Formula 1, FIA, or any team |

#### Privacy and legal

| ID | Element | Source/property | Rendering and conditions |
|---|---|---|---|
| PR01 | Independence statement | P | Same independent-app statement |
| PR02 | Crash-reporting policy | P: DiagnosticsPolicy | Configured in production policy; Disabled under no-diagnostics policy |
| PR03 | Performance-monitoring policy | P: DiagnosticsPolicy | Same policy distinction |
| PR04 | App reporting this session | C: ObservabilityActivation | Starting / Active / Not confirmed; omitted for no policy or notConfigured |
| PR05 | Advertising status | P | Disabled |
| PR06 | Diagnostic-components explanation | P | Explains packaged components and the distinction between build policy and session confirmation |
| PR07 | Privacy-policy action | P/configuration: validated privacyPolicy | Action only when configured; URL is not printed as the row value |
| PR08 | Missing-policy explanation | P/configuration | Non-production only; omitted in production |
| PR09 | External-open failure | C/P | Snackbar; no raw URL or exception |

These are disclosures, not user-configurable telemetry switches.

### 3.12 Acknowledgements

Sources: acknowledgements_screen.dart (lib/features/settings/presentation/acknowledgements_screen.dart), DataSourceAttributionCard, and data-sources.json (content/attribution/data-sources.json).

| ID | Element | Source/property | Rendering and conditions |
|---|---|---|---|
| AC01 | Independence statement | P | Always displayed |
| AC02 | Active data-source description | P/D | GridView service or corresponding fixture description |
| AC03 | Provider name | P: bundled DataSourceAttribution.name | Source-card heading |
| AC04 | Provider integration status explanation | P: bundled status; D: frozen-source override | Dormant, operator-batch, automatic-capability, or frozen-capture explanation |
| AC05 | Modification notice | P | Explains transformation, normalization, combination with curated information |
| AC06 | License notice | P: source name and licenseName | Localized framing around supplied names |
| AC07 | Non-endorsement notice | P | States provider has not reviewed/endorsed GridView |
| AC08 | Creator designation | P: creatorDesignation | Optional verbatim credit |
| AC09 | Copyright notice | P: copyrightNotice | Optional verbatim text |
| AC10 | Warranty disclaimer | P: warrantyDisclaimerNotice | Optional verbatim text |
| AC11 | Source project link text/action | P: sourceLink | Displays host plus path, without scheme/trailing slash; opens full validated link |
| AC12 | Terms link text/action | P: nullable termsLink | Same formatting; omitted if absent |
| AC13 | License name/title/action | P: licenseName, licenseTitle, licenseLink | Name as value, full title as description, external action |
| AC14 | Media category | A → D/P: MediaAttribution.category | Localized Portrait / Logo / Car / Circuit layout / Hero / Thumbnail / generic Image |
| AC15 | Media attribution | A → D: MediaAttribution.attribution | Stored attribution text |
| AC16 | Media license | A → D: MediaAttribution.license | Appended when supplied |
| AC17 | Source-record resolving/error state | C/P | Skeleton while resolving; explicit unavailable message on error |
| AC18 | Media-credit resolving/empty state | D/P | Skeleton before answer or on stream error; explicit no-attributions copy only after a known empty answer |

The committed record currently contains Jolpica F1, status automatic, license CC BY-NC-SA 4.0, its full license title and links, and its supplied uptime/availability/correctness disclaimer. Creator designation and copyright notice are null.

This describes the bundled presentation record; no provider or service availability was checked.

### 3.13 Additional presentation-only information

| ID | Surface | Source and displayed content |
|---|---|---|
| X01 | Route error | P: localized app name, reason-specific title/message, Home action |
| X02 | Environment badge | P: AppEnvironment.label; non-production only |
| X03 | Fixture banner | D/P: Sample data; frozen capture plus ISO date; unverified origin |
| X04 | Component catalogue | P: hardcoded demonstration labels and example data; not real season information |
| X05 | Catalogue interactive states | C/P: selected example segment/nav item; enabled, disabled, loading buttons; no-op demonstration callbacks |
| X06 | Native launch | P: Android resource themes/background; no data fields |

Catalogue examples cover position, driver/team names, points, wins, number, session date/time/status, result gap/score/fastest lap/DNF, and representative team accents. They are component demonstrations, not production-content requirements. GvAdContainer and GvDataCard currently have catalogue call sites only.

### 3.14 Contract/model fields that must not be mistaken for displayed information

The following were found in models/contracts but not rendered as independent production fields:

- Stable entity, session, result, participation and media IDs; event slugs.
- Season status, season label from the API, season start/end dates, round count, isCurrent, and a numeric season-progress display.
- Season.currentRound as a visible statistic; it contributes to chronology instead.
- Session endTime.
- Result gridPosition, completed laps, dnfReason.
- Fastest-lap time and lap number.
- Driver given/family names as separate fields.
- Driver country code as a flag or text field.
- Standings driver short code and podiums.
- Explore driver role and span count.
- Explore circuit corner count and country code.
- Circuit latitude/longitude.
- Constructor secondary color as an independent visual field.
- Raw generatedAt, sourceUpdatedAt, staleAfter, ETag, content version, request ID, resource key, cache key or service URL.
- Media dimensions, version, URL and ownership IDs.

Do not add these to a redesign solely because they are present in a model.

———

## 4. Presentation States and UI Behavior

### 4.1 Loading, data availability and failure

The application distinguishes whether data has been materialized locally from whether a returned list happens to be empty.

| Situation | Current behavior |
|---|---|
| Initial data not yet known | Structured skeletons, with one localized loading announcement per wrapped screen/section |
| Cached useful content exists | Render it immediately; refresh does not replace it with a full-screen loader |
| Valid empty collection | Explicit empty state, not a perpetual skeleton |
| Season unresolved after resolution attempt | Controlled unavailable/error state |
| Initial request failure without cached content | Error state; retry where implemented |
| Refresh failure with content | Nonblocking notice; content and navigation remain |
| Missing optional value | Omit field/section or use the specific documented fallback |
| Partial entity summary without fetched detail | Render summary and “Some profile information is unavailable” |
| Detail endpoint not found but local identity exists | Keep local profile, mark detail unavailable |
| No real entity and confirmed not-found | Entity not-found empty state |
| Missing image | Stable image fallback; no page-level failure |
| Classification unavailable | Dedicated result-area message, not a failed weekend page |

State implementations include computeHomeState, computeCalendarState, standings/Explore state functions, computeEntityDetailState, and computeGrandPrixResultsState.

A result-area failure does not remove the schedule. However, the current widget tree mounts _ResultsArea inside the ready-detail content: independently cached results are not a separate full-page recovery view when the entire detail is absent.

### 4.2 Refresh affordances and ownership

| Surface | Implemented user action | Visible progress |
|---|---|---|
| Home | Pull-to-refresh and app-bar refresh | Pull indicator; populated-page refreshing text |
| Calendar | Pull-to-refresh and app-bar refresh | Pull indicator; ellipsis in last-check label |
| Current-season standings | Pull-to-refresh and app-bar refresh | Pull indicator; refreshing text for selected table |
| Explicit historical standings | Focused selected-table refresh | Same table presentation |
| Explore | Retry in empty/error state | Thin progress bar over collection; failure notice takes precedence |
| GP detail | Retry first-load detail error | Detail loading presentation; no general pull-refresh action |
| GP results | Retry result error | Result-area skeleton when no classification cached |
| Entity details | Retry initial/season error | No visible general refresh control or ready-state progress indicator |
| Settings | No data-refresh action | Local reads only |

Opening details makes their exact detail resource eligible for an on-demand refresh. GP results are eligible when stored classifications exist or the GP advertises results.

Primary screen builds, tab changes, Explore category changes, and preference changes do not themselves request domain synchronization.

AppSyncLifecycleScope starts synchronization after the first frame, forwards genuine foreground returns, and cancels work when backgrounded. “Background refresh” in presentation documentation means nonblocking refresh alongside visible content; it should not be represented as continuous background-device activity.

### 4.3 Freshness and offline presentation

Source: freshness_evaluator.dart, presentedFreshness, resource metadata, and screen-specific notice widgets.

- staleAfter is evaluated against the injected clock.
- If absent, the server stale flag is used.
- Missing provenance must not be replaced with a fabricated timestamp.
- Remote Home, Calendar, and Standings can present the accepted bootstrap representation’s freshness until their own resource has synchronized.
- Bootstrap provenance does not become an individual resource’s last-check time.
- lastSuccessAt means a successful local check, not necessarily changed content or a fresh provider observation.
- No global screen-wide Home timestamp claims that all modules were updated together.
- A failed refresh does not by itself establish that the device is offline.

| Screen | Current freshness display |
|---|---|
| Home | Home-resource last successful check; refreshing label; aggregate stale/partial/failure notice |
| Calendar | Calendar-resource last successful check, refresh ellipsis, stale/failure notice |
| Standings | Selected championship’s last successful check, refresh label, stale/failure notice |
| GP detail/results | Stale/failure notices; no timestamp displayed |
| Driver/Team/Circuit | Partial/outdated/update-failed notice; no timestamp or active-refresh indicator displayed |
| Explore | Refresh progress/failure only; state freshness and timestamp are not consumed by view |
| Data Settings | Explanatory copy; no last-check or synchronization dashboard |

In a remote build, GP detail combines stale detail/results into one screen-level stale notice. Fixture builds retain separate scoped stale notices. Results refresh errors remain scoped to their section.

### 4.4 Temporal context and status

The redesign must retain the distinction between:

- Supplied lifecycle status: scheduled, upcoming, in progress, completed, postponed, cancelled, unknown.
- Client relevance: next/current/latest event, race-weekend context.
- Classification availability: hasResults, cached classification, unresolved winner.

resolveRelevantEvent() and related chronology helpers use known dates, race start instants, round context, and results evidence. They do not rewrite an unknown event status as completed merely because time passed.

Confirmed behaviors:

- Cancelled events remain in Calendar but are excluded from upcoming relevance.
- Settled events—completed or carrying classified-result evidence—are excluded from upcoming selection.
- Postponed events remain representable with their own status.
- Unknown-status events use available chronology without manufactured dates.
- Home relative timing is computed on rebuild; there is no second-by-second countdown or timer-driven polling.
- Home’s schedule window preserves delivered order.
- Standings and classifications preserve authoritative row order and duplicate positions.
- A confirmed leader requires position 1.
- A race winner requires exactly one resolved position-1 race entry.
- A tied leader state is not collapsed to one competitor.
- Participation with no observed end does not mean the driver will remain through the full season.

### 4.5 Localization and formatting

Sources: session_time.dart (lib/core/time/session_time.dart), entity_formatting.dart, result_formatting.dart, locale_resolution.dart, app_en.arb, app_es.arb.

| Topic | Current behavior |
|---|---|
| Supported languages | Exactly English and Spanish |
| Default language | System preference; first supported platform language wins; otherwise English |
| Regional locale variants | Resolve to supported base language |
| Explicit language | Overrides later platform-language changes |
| Proper names and biographies | Delivered text; not automatically translated |
| Session-name fallback | Supplied name first; known type humanized; unknown localized |
| Decimal values | NumberFormat.decimalPattern(locale); Spanish decimal comma; insignificant .0 not printed |
| Counts | Locale decimal integer formatting |
| Years | Plain toString(), no thousands grouping |
| Result/lap durations | Deterministic colon/dot duration format, not a localized clock |
| Circuit length | Metres converted for display to kilometres |
| Birth/related-event date | DateFormat.yMMMd |
| Weekend range | MMMd / MMMEd, without timezone conversion |
| Capture date | UTC ISO YYYY-MM-DD |
| Last successful check | Device-local DateFormat.Hm; no date or explicit timezone printed |

The formatter comments describe loss-free point formatting, but the actual implementation delegates to NumberFormat.decimalPattern; no additional arbitrary-precision policy is configured.

### 4.6 Timezone preference

- Device: device-local clock.
- Event: event’s declared IANA zone.
- Both: event clock first, device clock second.
- Missing/unresolvable event zone falls back to the device clock.
- Both mode collapses identical formatted clocks.
- A different secondary calendar day is shown explicitly.
- A null start time displays no clock.
- Calendar-only dates are never shifted through timezone conversion.
- No timezone is inferred from country.
- No separate 12/24-hour control exists. The code uses Hm, which produces the inspected English/Spanish 24-hour formatting; its comment should not be read as support for every platform clock preference.

### 4.7 Preferences, theme and accessibility settings

- Language defaults to System.
- Theme defaults to Dark.
- Time display defaults to Device.
- Preferences are persisted as stable tokens.
- Changes apply immediately and keep the choice screen open.
- A failed write rolls back the visible value and shows a snackbar.
- Theme/language changes retain the router and current navigation context.
- Dark, Light, and System theme modes are implemented.
- Android text scaling is not globally clamped.
- Reduced motion is read from MediaQuery.disableAnimationsOf.
- No in-app accessibility settings screen, text-size setting, custom high-contrast mode, or reduced-motion toggle is implemented.

### 4.8 Existing evidence and its limits

Relevant inspected suites include:

| Area | Repository evidence |
|---|---|
| Screen fields and states | test/screens/home_widget_test.dart, calendar_widget_test.dart, grand_prix_widget_test.dart, standings_widget_test.dart, explore_widget_test.dart, entity_detail_widget_test.dart |
| State computation | test/application/*_state_test.dart, controller tests |
| Chronology and leaders | test/domain/home_*, relevant_event_test.dart, unknown_status_chronology_test.dart, season_chronology_test.dart |
| Freshness | test/screens/expired_freshness_notice_test.dart, test/domain/presented_freshness_test.dart, wording tests |
| Navigation | test/navigation/router_test.dart, state_preservation_test.dart, entity_graph_navigation_test.dart, home_navigation_test.dart |
| Preferences and Settings | test/settings/*, test/preferences/*, test/time/session_time_test.dart |
| Accessibility | test/a11y/*, test/design_system/*semantics*, touch-target, contrast and reduced-motion tests |
| Images | test/media/*, including ownership, variants, integration, failures, caching and no-offstage-prefetch |
| Visual baselines | Screen, light-theme, settings, media and design-system golden suites |

For example, grand_prix_widget_test.dart explicitly asserts separate sprint and race classifications. Entity tests assert missing optional sections, season participation spans, unknown team fallback, and non-predictive “From season start” wording.

The text-scale matrix covers 200% text, 320/390 dp widths, English/Spanish, and dark/light combinations. Its own comments explicitly state that visual ellipsis/truncation is not detected merely by asserting semantic-label presence and absence of overflow exceptions.

No tests were executed during this audit.

———

## 5. Existing Design System Assessment

### 5.1 Documented versus implemented foundation

Sources: GridView_Design_System.md (docs/technical/GridView_Design_System.md), GridView_UI_UX_Design.md, gridview_theme.dart (lib/core/theme/gridview_theme.dart), and lib/core/theme/tokens/.

| Area | Documented intention | Actual implementation |
|---|---|---|
| Visual identity | Dark-first motorsport direction; restrained red; cards and hero imagery | Dark/light semantic palettes, rounded cards, hero surfaces, outlined icons, pill navigation |
| Fonts | Sora headings + Inter body/UI | Both GvFonts values are null; no fonts: declaration in pubspec.yaml |
| Light theme | Optional/deferred in early documents | Fully implemented through shared theme builder |
| Responsive width | maxContentWidth = 560 token | Token has no consuming call site in lib; live screens are not globally capped by it |
| Media | Progressive, licensed remote imagery | Image selection/loading/cache/fallback infrastructure implemented; actual approved production inventory not established here |
| Advertising | Earlier optional placements and reserved container | No live advertising; GvAdContainer catalogue-only |
| Motion | Short transitions and controlled image presentation | Concrete skeleton/selector/image animation paths; no custom feature-level cinematic transition system |
| Search | Optional Explore search | Not implemented |
| Screens | Early phase skeletons | Actual local-domain-backed screen implementations |

### 5.2 Current palettes

These values describe the existing implementation, not a proposed direction.

| Role | Dark | Light |
|---|---|---|
| Background | #0B0D12 | #F1F4F9 |
| Surface | #11151C | #F7F9FC |
| Elevated surface | #171C24 | #FFFFFF |
| Alternate elevated surface | #202734 | #E5EAF2 |
| Primary text | #F5F7FA | #0F131A |
| Secondary text | #D9DEE7 | #333C4A |
| Muted text | #A1AAB8 | #566070 |
| Disabled text | #697386 | #7A8493 |
| Divider | #2D3645 | #C7D0DE |
| Primary accent | #FF3B30 | #C62719 |
| Filled primary-button accent | #DC2626 | #C62719 |
| Secondary/information accent | #3B82F6 | #1D4ED8 |
| Warning/stale | #F59E0B | #9A5B08 |
| Success | #22C55E | #12703A |
| Tertiary | #8B5CF6 | #5B21B6 |

GvSemanticColors exposes 21 roles through context.gvColors, including hero scrims and on-accent foregrounds. info maps to the secondary accent; stale maps to warning.

Team colors are API-backed identity accents. GvTeamAccent parses supplied colors and provides contrast-safe foreground selection where needed.

### 5.3 Typography

| Token | Size | Weight | Line height |
|---|---:|---:|---:|
| displayXl | 42 | 700 | 1.10 |
| displayL | 34 | 700 | 1.15 |
| pageTitle | 28 | 700 | 1.20 |
| sectionTitle | 20 | 600 | 1.25 |
| cardTitle | 18 | 600 | 1.30 |
| bodyL | 16 | 400 | 1.45 |
| bodyM | 14 | 400 | 1.45 |
| label | 12 | 500 | 1.30 |
| caption | 11 | 400 | 1.30 |
| statValue | 24 | 700 | 1.10 |

statValue requests tabular figures. Several rows override token sizes, commonly to 16 for row titles and 18 for standings values.

Runtime-font conclusion: the app does not request Sora or Inter. It inherits framework/platform fallback selection. The exact resolved device font was not measured in this audit.

### 5.4 Spacing, shape and surfaces

- Spacing: 4, 8, 12, 16, 20, 24, 32, 40 logical pixels.
- Radii: 8, 12, 20, 28, plus pill radius.
- Default horizontal screen padding: 20.
- Minimum interactive target token: 48.
- Shared row minimum height: 56.
- Hero default minimum height: 200, with content allowed to grow.
- Content cards use elevated tonal surfaces and radius 20.
- Heroes use radius 28 and optional theme-aware scrims.
- App bars and standard Material cards have zero elevation.
- Shadow tokens exist for low/medium/high depth; bottom navigation uses the floating/elevated treatment.
- Safe-area handling and reserved bottom-navigation space protect content from overlap.

Some widgets use direct layout literals alongside tokens. A redesign should assess actual widget consumption, not assume every dimension is centrally controlled.

### 5.5 Components and navigation

Reusable components are mostly data-agnostic and accept formatted values/callbacks:

- App bar, bottom navigation, section header.
- Primary, secondary and icon buttons.
- Segmented control and status chips.
- Hero, content, data and information cards.
- Session, standings, driver, team, circuit and result rows.
- Detail fields and Settings rows/options.
- Skeletons and loading semantics.
- Empty/error states and stale notices.
- Remote image and placeholder.

The primary navigation currently uses outlined Material icons for Home, Calendar, Standings and Explore. Settings, refresh, back, forward, external link, person, shield, route and status icons also come from Material icons.

The navigation’s pill appearance is replaceable. Its selection semantics, hit targets, context preservation and accessible labels are functional requirements.

### 5.6 Images and placeholders

Sources: gv_remote_image.dart (lib/core/widgets/gv_remote_image.dart), MediaSlotPolicy, media_slot.dart, EventHeroImage, and media_cache.dart.

Implemented rules:

- Driver imagery belongs to the stable driver.
- Team imagery belongs to the stable constructor.
- Circuit imagery belongs to the circuit.
- Event heroes may use event imagery or the explicitly supported circuit fallback.
- Season-specific team livery cannot be claimed from constructor media; season entries have no media field.
- Explore thumbnails render in 40×40 logical-pixel slots.
- Variant selection considers display role, dimensions and device pixel ratio.
- Decode width is tied to rendered width and device density.
- One shared disk cache stores image bytes separately from domain persistence.
- Cache configuration uses 400 objects and a 30-day stale period; there is no configured byte ceiling.
- No image refresh loop or user-facing cache-clear function exists.
- Absent, loading, rejected, failed and undecodable images use the stable placeholder path.
- New images fade in; cached images do not replay the fade.
- Media failure does not remove text or navigation.
- Portraits and marks are decorative when adjacent text already identifies the entity.
- Circuit-layout diagrams receive informative semantics where the selected slot treats them as additional information.
- Media credits are available through Acknowledgements.

The media documentation records historical placeholder-only performance evidence and no approved Formula 1 media at that stage. That is not proof of current remote availability; no remote inventory was inspected.

### 5.7 Motion

- Durations: 120 / 220 / 320 ms.
- Curves: ease-in-out cubic, ease-out cubic, ease-in cubic.
- Skeleton blocks pulse unless animations are disabled.
- Segmented selection respects reduced motion.
- Remote-image fade uses the 120 ms token and is skipped for cached images or reduced motion.
- Calendar initial positioning is immediate, not animated.
- Home resolving submodules use static placeholders.
- No timer-driven live countdown or custom shared-element transition was found.

Reduced-motion support in these components does not establish that every platform route or Material progress animation has been independently audited.

### 5.8 Accessibility assessment

Source: GridView_Accessibility.md (docs/technical/GridView_Accessibility.md).

Reusable strengths:

- Named actions and controls.
- Heading semantics.
- Selected/checked states.
- Loading live regions.
- Separate result driver/team actions.
- Minimum touch targets.
- Keyboard/D-pad activation paths.
- Text-scale and theme tests.
- Identifier suppression.
- Decorative/informative image distinctions.

Known limitations include:

- Dark segmented-control selected label: white on #FF3B30, approximately 3.55:1, below the documented 4.5:1 small-text target.
- Duplicate selected-state narration in preference options.
- Duplicate or redundant headings in some semantic compositions.
- Accessibility focus not restored to the originating Settings row after Back in the recorded device review.
- An unresolved discrepancy between one keyboard observation and widget-test Enter activation.
- Terse Explore numerical semantics.
- Visual truncation beyond the scope of current text-scale assertions.

These are existing limitations, not design requirements to reproduce.

### 5.9 What can be reused

The strongest reuse candidates are:

1. Domain/read-model contracts and sealed presentation states.
2. Formatting, localization and timezone policy.
3. Season-aware navigation metadata and route validation.
4. Preference persistence and application-level theme/locale wiring.
5. Media ownership, selection, caching and failure handling.
6. Resource-scoped freshness semantics.
7. Accessibility primitives and meaningful behavioral tests.
8. Semantic token architecture.

Existing card geometry, colors, fonts, component silhouettes, page composition, spacing, and navigation appearance are reconsiderable.

———

## 6. Mandatory Redesign Constraints

### 6.1 Information and meaning

- Preserve all applicable Section 3 fields and conditions.
- Preserve the meaning of season-specific versus stable identity data.
- Keep championship points distinct from points scored in one classification.
- Keep permanent driver number distinct from season race number.
- Keep driver participation distinct from standings constructor association.
- Keep event dates distinct from session instants.
- Keep circuit facts distinct from event-specific facts.
- Preserve provisional and unknown states.
- Preserve duplicate ranks and ties.
- Do not promote a first row or highest points total into a confirmed leader.
- Do not manufacture missing dates, times, statistics, names, flags, profiles, media, or status.
- Do not expose stable identifiers as user-facing fallback names.
- Do not add currently unrendered API fields merely to fill a design.

### 6.2 Functionality and navigation

- Keep the purposes of Home, Calendar, both standings tables, all Explore collections, entity details, and Settings accessible.
- Preserve GP → circuit → related GP.
- Preserve result → driver and result → team as separately usable actions.
- Preserve driver ↔ team relationships.
- Preserve exact-season standings links.
- Preserve current context on Back and branch switching.
- Preserve controlled handling of invalid routes and unavailable resources.
- Retain existing refresh and retry capabilities.
- Preserve immediate preference changes and failure rollback.
- Preserve external attribution/privacy/support actions where configured.

Navigation grouping and visual presentation may change under the redesign brief, but destination coverage, season context and journey outcomes must remain equivalent.

### 6.3 Offline, synchronization and architecture

- Render available local information without waiting for network or images.
- Do not replace cached content with a loading/error screen on refresh failure.
- Preserve resource-specific freshness and failure scope.
- Do not equate last successful check with provider update time.
- Do not invent a global dashboard freshness timestamp.
- Do not introduce requests on visual rebuilds or category/theme/language changes.
- Do not alter persistence, synchronization ownership, public contracts, backend architecture or provider behavior as part of visual work.
- Continue using the reconstructed application; legacy Spring Boot/MySQL/scraper architecture is not a foundation for redesign.

### 6.4 Localization and accessibility

- Preserve English and Spanish.
- Preserve System/explicit language resolution.
- Preserve Device/Event/Both time preferences and timezone labels.
- Preserve light, dark and system theme functionality.
- Keep content usable at supported text scales and narrow widths.
- Keep meaning available without relying on color alone.
- Preserve accessible action names, selection state, reading order and informative-image descriptions.
- Preserve appropriate touch targets and reduced-motion behavior.
- Existing accessibility defects should remain documented; they must not be silently treated as acceptable targets.

### 6.5 Media and attribution

- Do not assume licensed photos, team logos, circuit layouts or fonts exist.
- Keep no-image layouts complete and intentional.
- Preserve correct asset ownership.
- Keep mandatory provider notices, license information and media credits accessible.
- Do not imply official affiliation or provider endorsement.
- Do not interpret stable team imagery as a particular season’s car.
- Avoid layout shifts and excessive image decoding/downloads.

### 6.6 Product scope

The PRD excludes accounts, favorites, personalized feeds, news, social features, notifications/reminders, live timing/telemetry, lap-by-lap analysis, fantasy/predictions, purchasing, and dedicated tablet/web/iOS experiences.

There is no user-facing historical-season browser or search implementation to preserve.

Advertising is not retained for v1. Catalogue placeholders do not authorize advertising UI.

The race-only release decision must be respected while the sprint-renderer discrepancy is resolved explicitly before implementation.

### 6.7 Android continuity

Read-only source baseline:

| Item | Current repository value |
|---|---|
| Production application ID | com.sejuma.gridview |
| Namespace | com.sejuma.gridview |
| Declared version | 2.0.0+8 |
| Gradle version source | flutter.versionName / flutter.versionCode |
| Compile/target SDK | 36 / 36 |
| Minimum SDK | Delegated to flutter.minSdkVersion |
| Signing configuration reference | android/key.properties; keystore path read from its storeFile property |

No signing credentials were opened, and no release configuration was changed.

Future work must preserve production update compatibility, signing continuity and the existing application identity. The repository version is not a substitute for checking the highest Play Console version code before a future release.

### 6.8 Reconsiderable design decisions

The redesign may reconsider:

- Palette and color distribution.
- Typography and licensed font choices.
- Card usage and shapes.
- Spacing and density.
- Hero prominence and image placement.
- Row/table/card composition.
- Information grouping and section ordering.
- Navigation appearance and, where justified, navigation organization.
- Status-component appearance.
- Loading/empty/error visual treatment.
- Motion styling within accessibility/performance constraints.

These are presentation choices, not reasons to change data or product scope.

———

## 7. Functional Design Brief for Claude Code and Google Stitch

### 7.1 Product description

GridView is an independent Android application for casual and habitual Formula 1 followers. It helps users understand the current season, find relevant event/session times, inspect championship standings, review race classifications, and explore connected drivers, teams and circuits.

It is an information companion. It is not a live timing, telemetry, news, social, or account-based product.

Its value depends on quick comprehension, trustworthy handling of incomplete information, and useful offline access after information has been stored.

### 7.2 Screen objectives and required content

Use the Section 3 matrix as the binding field checklist.

| Experience | User question | Required content and actions |
|---|---|---|
| Home | “What matters now?” | Season; relevant GP identity/location/dates/status/round; session timing and compact schedule; both championship leader states; latest completed-event/result summary; upcoming events; shortcuts; accurate freshness/availability communication |
| Calendar | “What is the season schedule?” | Every stored season event in order; round/name/circuit/location/dates/status; sprint indication; relevant-event emphasis; GP entry; refresh and stale/error states |
| GP detail | “What is happening this weekend, and what was the result?” | Event identity, optional official name, season/round, location/dates, format/status, circuit, timezone context, every session, race classification fields and driver/team links |
| Drivers’ standings | “Who leads, and where does each driver stand?” | Position, driver, standings-associated team, points, optional wins, team identity accent, provisional/tie/unranked states, freshness and detail navigation |
| Constructors’ standings | “How are the teams ranked?” | Position, team, points, optional wins, team identity accent, provisional/tie/unranked states, freshness and team navigation |
| Explore Drivers | “Which drivers are associated with this season?” | Name, season number, short code, optional team/nationality/standing, available portrait; open detail |
| Explore Teams | “Which teams participate, and who drives for them?” | Season-aware name, optional standing/power unit/line-up summary, team imagery/accent; open detail |
| Explore Circuits | “Where does the season race?” | Circuit name/location, optional related GP/date/length, suitable imagery; open detail |
| Driver detail | “Who is this driver, and how are they involved this season?” | Identity, number/code/nationality, relevant team, championship, every participation span, optional birth facts/permanent number/biography; team/standings links |
| Team detail | “What is this team’s season identity and line-up?” | Season and stable names where applicable, nationality, championship, every line-up span, optional power unit/principal/base/chassis/biography; driver/standings links |
| Circuit detail | “What is this circuit, and which event does it host?” | Name/location, suitable image, optional length/corners/direction/first GP year, conditional lap record, related GP or explicit absence |
| Settings | “How do I read and understand this app?” | Language/theme/time choices; data/update explanation; app version/build; privacy disclosures; provider/media acknowledgements; configured external support/legal actions |

Do not present sprint-result screens as an approved release feature. Their existing renderer support is a documented implementation conflict, not a new design requirement for 2.0.0.

### 7.3 Information rules for every concept

- A field can be optional without being disposable. If the app can currently show it, the redesigned experience must still accommodate it under the same valid conditions.
- A missing value must not be filled with plausible sample content presented as real.
- A status badge must identify whether it reflects supplied data or client context.
- “Next”, “Current”, “Race weekend”, relative start text and leader selection are computed meanings.
- “Unknown” must remain possible for event/session/result statuses.
- “No information loaded” and “the known answer is empty” must look and read as different states.
- Partial profiles must remain useful.
- A failed update must not erase saved information.
- Images must be optional enhancements.
- Source/legal notices must remain accessible.
- Displayed IDs, fabricated statistics and assumed media are prohibited.

### 7.4 Scenarios every design exploration must account for

Without generating mockups in this audit, the future design inputs should include:

1. Populated Home before an event.
2. Race-weekend Home with current or next session.
3. Post-race/latest-event Home.
4. Tied leaders and unavailable leader identities.
5. Known-empty versus unresolved upcoming module.
6. Calendar with cancelled, postponed and unknown-status events.
7. Standard and sprint weekend schedules.
8. Missing session start time and missing event timezone.
9. Both clocks crossing a calendar-day boundary.
10. Final and provisional race classifications.
11. Null finishing position, fractional points, DNF/DNS/DSQ/DNQ, lapped result, fastest-lap badge.
12. Cached information during refresh and after failure.
13. Partial driver/team/circuit details.
14. Multiple participation spans and changed team branding.
15. Circuit without a related event or complete lap record.
16. Missing and failed imagery.
17. English and Spanish, dark and light, narrow width and large text.
18. Preference-save and external-link failures.
19. Acknowledgements resolving, empty and populated.
20. Invalid navigation and confirmed not-found content.

### 7.5 Freedom of visual exploration

No aesthetic direction is selected by this report.

Future concepts may substantially change composition, emphasis, hierarchy, component appearance and navigation organization. They should demonstrate that the same user questions remain answerable and that every preservation checkpoint has a destination.

For implementation review, map each Section 3 identifier to:

- Its new location.
- Its conditional rendering rule.
- Its action, where applicable.
- Its accessible representation.
- Its degraded-data behavior.

An absent mapping is an information-loss risk, even if the proposed screen appears visually complete.

———

## 8. Unverified Details, Documentation Conflicts, and Open Questions

### 8.1 Confirmed documentation/implementation discrepancies

| Issue | Evidence | Consequence for redesign |
|---|---|---|
| Race-only release versus generic classifications | PRD §9.3 owner decision dated 2026-10-21 excludes sprint/non-race results. GrandPrixResultSection renders sprint and other types; grand_prix_widget_test.dart explicitly tests coexistence | Resolve release intent against retained renderer/test behavior before implementation; do not silently delete behavior or expand release scope |
| Circuit laps/race distance | PRD §9.4 lists them; screen and inspected Circuit/GrandPrix schemas do not provide/render them | Do not invent fields or move them into circuit identity |
| Documented fonts absent | Sora/Inter recommended; GvFonts.heading/body == null; no bundled font declaration | Existing screenshots/goldens are not evidence of Sora/Inter typography |
| Freshness visibility broader in requirements than implementation | PRD requires understandable freshness; Explore ignores state freshness/timestamps; details omit timestamps/progress | Record as current gap, not an existing rendered capability |
| Old GP duplicate-stale finding partly superseded | Accessibility document says two scoped notices remain; current remote branch aggregates them; fixture branch still differs | Do not repeat the older finding as universal current behavior |
| Old navigation description of Explore stacking | Technical navigation text describes Back to Explore root; implementation uses sibling replacement routes | Use current router behavior as baseline |
| Historical dark-only/deferred-light statements | Later design-system documentation and theme code implement light mode | Preserve all three theme preferences |
| Historical advertising guidance | Old UI/UX placement guidance versus ADR 0018 and no live call sites | No production ad surface belongs in this redesign |
| 560 px content cap | Token exists; no application call site | Do not claim implemented wide-screen constraint |
| Optional search in flow documents | Search appears as optional/planned; no control or search state implemented | Not existing functionality |
| Incomplete bundled demo inventory | Only home.json and two GP fixtures are committed; no bundled current-season/bootstrap fixture | A default fixture build is not a complete populated design-review environment |

### 8.2 Confirmed implementation details requiring care

Home fallback session wording.
resolveHomeSessionFocus() can return HomeSessionRelevance.latest. HomeFormatter.sessionFocusLabel() checks only isLive; every non-live focus is labelled “Next session”. A past fallback session can therefore carry that heading. This is a wording/meaning discrepancy, not a behavior to treat as intentional future design.

Driver permanent-number gate.
The permanent-number profile row is conditional on a predicate that does not count permanent number itself. The hero fallback and labelled profile field therefore have different availability behavior.

Lap-record gate.
A holder-only record is not rendered without a record time or year.

Season context is not always visible.
Driver and Team details use exact season context without printing the year. Circuit detail prints the season in the no-related-event state, but not uniformly across all ready states.

Some explicit semantic labels omit visible information.
Because _RowScaffold excludes child semantics when an explicit label is supplied:

- Explore driver labels omit visible nationality, race number and short code.
- Explore team labels omit visible power unit.
- Explore circuit labels omit visible event date and circuit length.
- Team line-up labels primarily announce the open-driver action/name, rather than all visible role/span/number/code information.
- Other composed card labels also warrant review for parity with visible content.

These are source-confirmed accessibility limitations; current visual information must still be preserved.

Entity season-unavailable retry is limited.
The shared detail controller’s retry returns when it has no resolved season. The UI offers Retry, but that action does not itself establish a missing season. Do not claim that the button guarantees season recovery.

Formatting comments exceed some implementations.
The source uses DateFormat.Hm, despite a comment suggesting general locale 12/24-hour convention. Numeric formatting uses the formatter’s defaults, despite broad “never rounded” comments.

### 8.3 What this audit does not establish

- Which optional fields are populated in current production data.
- Whether production currently has usable licensed imagery for each slot.
- Whether any live service currently supplies non-race classifications.
- The exact installed application’s build defines, privacy-policy URL, or metadata.
- Current production deployment/version/signing state.
- Current Play Console highest version code.
- Fresh execution results for widget, golden, accessibility or integration tests.
- Exact device font resolution.
- Current device-level TalkBack/Switch Access behavior.
- Complete text readability where widgets ellipsize.
- Real-media performance on representative mid-range Android hardware.
- Every Android-version-specific native launch-screen appearance.

Historical accessibility and performance documents remain useful evidence, but their recorded test counts, device observations and limitations are not a fresh certification of this commit.

### 8.4 Decisions to resolve before implementation

1. Reconcile the race-only release decision with existing sprint/generic classification rendering and tests.
2. Decide how the redesign will represent existing freshness information consistently without inventing metadata or changing synchronization.
3. Decide how exact season context remains understandable when information is redistributed.
4. Establish the available, licensed media/font inputs before concepts depend on them.
5. Separate intended behavior preservation from correction of the documented wording, gating and accessibility defects.
6. Reassess accessibility focus, reading order and visual truncation when navigation or semantic structure changes.

The read-only audit is complete. No design generation or implementation has begun.