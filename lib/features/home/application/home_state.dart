import '../../../core/api/errors/api_failure.dart';
import '../../shared/domain/collection_materialization.dart';
import '../../shared/domain/entities/calendar_entry.dart';
import '../../shared/domain/entities/enums.dart';
import '../../shared/domain/entities/home_dashboard.dart';
import '../../shared/domain/entities/season.dart';
import '../../shared/domain/entities/session.dart';
import '../../shared/domain/entities/sync_state.dart';
import '../../shared/domain/freshness_evaluator.dart';
import '../domain/home_leader.dart';
import '../domain/home_module_availability.dart';
import '../domain/home_race_winner.dart';
import '../domain/home_session_focus.dart';
import '../domain/home_temporal_state.dart';

/// One Home module's provenance: the freshness of the **exact** resource it was
/// composed from, and when that resource last synchronised successfully.
///
/// Home combines several independent resources, so it never publishes a single
/// screen-wide "updated" time. A module derived from the calendar carries the
/// calendar's record; a module derived from the drivers' standings carries that
/// table's record. A record with no `lastSuccessAt` yields a **null** freshness
/// — a representation materialized by an accepted bootstrap has no individual
/// provenance of its own, and unknown is presented as neither fresh nor stale.
class HomeSectionFreshness {
  const HomeSectionFreshness({this.freshness, this.lastSuccessAt});

  /// Freshness of this section's own resource, or `null` when it has none yet.
  final FreshnessState? freshness;

  /// When this section's own resource last synchronised successfully, or `null`
  /// when it never has under its own key. Never borrowed from bootstrap and
  /// never from another resource.
  final DateTime? lastSuccessAt;

  bool get isStale => freshness == FreshnessState.stale;

  /// Derives a section's provenance from its own persisted metadata.
  static HomeSectionFreshness of(ResourceSyncState? metadata, DateTime now) =>
      metadata?.lastSuccessAt == null
      ? const HomeSectionFreshness()
      : HomeSectionFreshness(
          freshness: evaluateResourceFreshness(metadata, now),
          lastSuccessAt: metadata!.lastSuccessAt,
        );
}

/// The featured Grand Prix module.
class HomeEventModule {
  const HomeEventModule({
    required this.focus,
    required this.phase,
    required this.sessionFocus,
    required this.scheduleWindow,
    required this.provenance,
  });

  final HomeFocus focus;
  final HomeTemporalPhase phase;

  /// The current or next session, or `null` when the weekend supplied none.
  final HomeSessionFocus? sessionFocus;

  /// The compact ordered subset of the weekend shown around [sessionFocus]. The
  /// complete schedule stays on the Grand Prix screen.
  final List<Session> scheduleWindow;

  /// The provenance of the resource the featured event actually came from: the
  /// Home resource for a contract-defined focus, the calendar for the fallback.
  final HomeSectionFreshness provenance;

  int get season => focus.season;
  int get round => focus.round;
  bool get hasSessions => focus.sessions.isNotEmpty;
}

/// One championship-leader module. The two are entirely independent: their data,
/// their failure and their freshness never cross.
class HomeLeaderModule {
  const HomeLeaderModule({
    required this.leader,
    required this.availability,
    required this.provenance,
    this.failed = false,
  });

  final HomeLeader leader;

  /// Whether this championship's standings table can answer at all, from its
  /// materialization rather than from how many rows it holds. A materialized
  /// table that names no confirmed leader yet — before the first race, or while
  /// a table is genuinely tied at zero — is a valid empty answer, not missing
  /// information.
  final HomeModuleAvailability availability;

  final HomeSectionFreshness provenance;

  /// Whether this championship's own resource failed its last refresh. Scoped
  /// strictly to this table — the other championship's failure is never here.
  /// A failure over cached rows never makes the module unavailable.
  final bool failed;

  /// Whether a leader is actually named. Distinct from [availability]: an
  /// available table can legitimately name none.
  bool get hasLeader => leader is! HomeLeaderUnavailable;
}

/// The latest completed Grand Prix, with optional already-cached race-result
/// enrichment.
class HomeLatestResultModule {
  const HomeLatestResultModule({
    required this.event,
    required this.provenance,
    this.resultProvenance,
    this.winner,
    this.resultStatus,
  });

  /// The completed event, from the calendar.
  final CalendarEntry event;

  /// The calendar's provenance — the result document has its own and is never
  /// allowed to speak for the event summary.
  final HomeSectionFreshness provenance;

  /// The **result document's** own provenance, present only when a
  /// classification is actually cached for this round.
  ///
  /// Kept apart from [provenance] deliberately: a stale classification says
  /// nothing about the calendar entry that names the event, and an absent
  /// classification is not a stale one. `null` therefore means "no result
  /// resource is being represented here", never "fresh".
  final HomeSectionFreshness? resultProvenance;

  /// The winner, only when one authoritative resolved entry held a confirmed
  /// position 1 in an already-cached **race** classification.
  final HomeRaceWinner? winner;

  /// The cached classification's own status, when a classification is cached,
  /// rendered through the same formatter the Grand Prix screen uses. Nothing is
  /// claimed to be final unless the stored status says so.
  final ResultStatus? resultStatus;

  int get season => event.season;
  int get round => event.round;
}

/// The upcoming-events module.
///
/// Always present in a ready dashboard. Whether it can answer is
/// [availability]; how much it has to say is [events]. An empty list from a
/// materialized calendar is the complete and correct answer after the season
/// finale — the module is not missing, the season simply has no races left.
class HomeUpcomingModule {
  const HomeUpcomingModule({
    required this.events,
    required this.availability,
    required this.provenance,
  });

  /// Already bounded and already ordered by the composition; a widget never
  /// re-sorts or re-slices it while building.
  final List<CalendarEntry> events;

  /// Whether the season calendar has a materialized local representation, so a
  /// reliable upcoming calculation can be made at all. Never derived from the
  /// number of events, and never downgraded by a stale record or by a refresh
  /// failure over a valid cached calendar.
  final HomeModuleAvailability availability;

  /// The calendar's provenance.
  final HomeSectionFreshness provenance;

  bool get isEmpty => events.isEmpty;
}

/// The Home screen's typed presentation state.
///
/// The variants are mutually exclusive and cover every case the dashboard must
/// represent, so the UI never relies on a single ambiguous loading/error
/// boolean. Within [HomeReady] the visible modules keep **independent**
/// availability: one missing optional module is not a page-level error, and one
/// failed resource never removes content another resource still provides.
sealed class HomeState {
  const HomeState();
}

/// The season context has not resolved yet, or no Home representation has been
/// materialized for it. A structured first-load frame — never shown once any
/// valid representation exists.
class HomeLoading extends HomeState {
  const HomeLoading();
}

/// No season could be resolved at all, so there is no canonical `home:<season>`
/// resource to read or refresh.
class HomeSeasonContextUnavailable extends HomeState {
  const HomeSeasonContextUnavailable();
}

/// No usable representation exists and synchronization failed.
class HomeFirstLoadError extends HomeState {
  const HomeFirstLoadError(this.failure);

  final ApiFailure failure;
}

/// A Home representation is materialized for the season and legitimately has no
/// events. A real, valid state — never loading, and never an error.
class HomeSeasonEmpty extends HomeState {
  const HomeSeasonEmpty({
    required this.seasonYear,
    required this.season,
    required this.provenance,
    this.refreshing = false,
    this.refreshError,
  });

  final int seasonYear;
  final Season? season;
  final HomeSectionFreshness provenance;
  final bool refreshing;
  final ApiFailure? refreshError;
}

/// The dashboard has content. Which modules are present is decided per module.
class HomeReady extends HomeState {
  const HomeReady({
    required this.seasonYear,
    required this.season,
    required this.event,
    required this.homeProvenance,
    required this.driverLeader,
    required this.teamLeader,
    required this.upcoming,
    this.latestResult,
    this.refreshing = false,
    this.refreshError,
  });

  final int seasonYear;
  final Season? season;

  /// The featured Grand Prix module. Always present in [HomeReady]: a ready Home
  /// without one is [HomeSeasonEmpty] instead.
  final HomeEventModule event;

  /// The Home resource's **own** provenance, used only for Home-owned content.
  final HomeSectionFreshness homeProvenance;

  final HomeLeaderModule driverLeader;
  final HomeLeaderModule teamLeader;

  /// The upcoming events. Always present: whether the calendar can answer is
  /// carried by its own availability rather than by making the module null.
  final HomeUpcomingModule upcoming;

  /// The latest completed Grand Prix, absent only when the season has none yet.
  /// Its absence is by design, never a data gap, so it is not part of
  /// [isPartial].
  final HomeLatestResultModule? latestResult;

  /// A refresh is in flight; every cached module stays visible throughout.
  final bool refreshing;

  /// A refresh failure that kept the cached content visible. Non-blocking by
  /// construction — it never replaces the screen.
  final ApiFailure? refreshError;

  HomeTemporalPhase get phase => event.phase;

  /// Whether some module's information is genuinely **unavailable**, so the
  /// screen can show one concise partial-data notice instead of a page-level
  /// error.
  ///
  /// Strictly availability, never cardinality: a module whose resource is
  /// materialized has answered, and an empty answer is an answer. No upcoming
  /// events after the finale, no confirmed leader yet, no cached classification
  /// and no completed event yet are all valid, complete states — none of them
  /// is partial. Staleness and refresh failures are separate conditions with
  /// their own notices and never make a module unavailable either.
  bool get isPartial => <HomeModuleAvailability>[
    driverLeader.availability,
    teamLeader.availability,
    upcoming.availability,
  ].any((HomeModuleAvailability a) => !a.isAvailable);

  /// Whether **any** visible module is currently stale, so one safe aggregate
  /// notice can describe the uncertainty without claiming a false global time.
  bool get hasStaleSection => <HomeSectionFreshness?>[
    homeProvenance,
    event.provenance,
    driverLeader.provenance,
    teamLeader.provenance,
    latestResult?.provenance,
    latestResult?.resultProvenance,
    upcoming.provenance,
  ].any((HomeSectionFreshness? s) => s?.isStale ?? false);
}

/// Everything the composition needs to derive [HomeState].
///
/// Grouping the inputs keeps the derivation a single pure function with a
/// readable signature, and keeps every value explicit — nothing is read from
/// ambient state, and no clock is consulted except the injected [now].
class HomeStateInputs {
  const HomeStateInputs({
    required this.season,
    required this.seasonReady,
    required this.dashboard,
    required this.dashboardReady,
    required this.homeMetadata,
    required this.calendarMetadata,
    required this.driverStandingsMetadata,
    required this.constructorStandingsMetadata,
    required this.resultMetadata,
    required this.bootstrapMetadata,
    required this.metadataReady,
    required this.refreshing,
    required this.lastFailure,
    required this.driverStandingsFailed,
    required this.constructorStandingsFailed,
    required this.syncSettled,
    required this.now,
  });

  /// The locally resolved current season, or `null` while none is stored.
  final int? season;
  final bool seasonReady;

  /// The composed local dashboard, or `null` when none is materialized.
  final HomeDashboardView? dashboard;
  final bool dashboardReady;

  final ResourceSyncState? homeMetadata;
  final ResourceSyncState? calendarMetadata;
  final ResourceSyncState? driverStandingsMetadata;
  final ResourceSyncState? constructorStandingsMetadata;

  /// The metadata of the exact result resource enriching the latest event, when
  /// one is cached.
  final ResourceSyncState? resultMetadata;

  /// Bootstrap's **own** record, consulted for one thing only: whether an
  /// accepted bootstrap materialized this exact season's collections. It
  /// contributes no ETag, provenance or freshness to any resource (ADR 0014).
  final ResourceSyncState? bootstrapMetadata;

  /// Whether the persisted metadata above has actually been read. While it is
  /// false no module is declared unavailable, because unavailability is a fact
  /// about stored state rather than an assumption made during loading.
  final bool metadataReady;

  final bool refreshing;

  /// The Home resource's own last failure. Another resource's failure is never
  /// passed here.
  final ApiFailure? lastFailure;

  final bool driverStandingsFailed;
  final bool constructorStandingsFailed;

  /// Whether an application-level run has actually finished trying, so "no
  /// season" is only claimed once it is genuinely unresolvable.
  final bool syncSettled;

  final DateTime now;

  /// Classifies one season collection Home derives a module from.
  ///
  /// Materialization comes from the single approved rule shared with the
  /// Calendar and Standings screens ([hasMaterializedCollection]): the
  /// collection's own successful record, or an accepted bootstrap for this exact
  /// season. Nothing here fabricates metadata, freshness or an ETag, and nothing
  /// infers materialization from how many rows arrived.
  HomeModuleAvailability availabilityOf(
    ResourceSyncState? metadata, {
    required bool isEmpty,
  }) => resolveHomeModuleAvailability(
    materialized: hasMaterializedCollection(
      season: season,
      metadata: metadata,
      bootstrapMetadata: bootstrapMetadata,
    ),
    materializationKnown: metadataReady && season != null,
    isEmpty: isEmpty,
  );
}

/// Derives the Home state from the composed local dashboard, each contributing
/// resource's own persisted metadata and the transient refresh status.
///
/// Pure and side-effect free, so every state is unit-testable without Riverpod
/// or a widget tree. Cached content always wins: it is never replaced by a
/// loader or by an error.
HomeState computeHomeState(HomeStateInputs input) {
  final HomeDashboardView? dashboard = input.dashboard;
  final int? season = input.season;

  final HomeSectionFreshness homeProvenance = HomeSectionFreshness.of(
    input.homeMetadata,
    input.now,
  );
  final HomeSectionFreshness calendarProvenance = HomeSectionFreshness.of(
    input.calendarMetadata,
    input.now,
  );
  final ApiFailure? refreshError = input.refreshing ? null : input.lastFailure;

  // A materialized representation for a *different* season is not this season's
  // Home: an old season's dashboard is never rendered as the new one.
  final bool materialized =
      dashboard != null && (season == null || dashboard.seasonYear == season);

  if (!materialized) {
    if (season == null) {
      if (!input.seasonReady || input.refreshing || !input.syncSettled) {
        return const HomeLoading();
      }
      return const HomeSeasonContextUnavailable();
    }
    if (!input.dashboardReady || input.refreshing) return const HomeLoading();
    final ApiFailure? failure = input.lastFailure;
    if (failure != null) return HomeFirstLoadError(failure);
    return const HomeLoading();
  }

  final HomeFocus? focus = dashboard.focus;
  if (focus == null) {
    return HomeSeasonEmpty(
      seasonYear: dashboard.seasonYear,
      season: dashboard.season,
      provenance: homeProvenance,
      refreshing: input.refreshing,
      refreshError: refreshError,
    );
  }

  final HomeSessionFocus? sessionFocus = resolveHomeSessionFocus(
    focus.sessions,
    input.now,
  );
  final HomeEventModule event = HomeEventModule(
    focus: focus,
    phase: resolveHomeTemporalPhase(
      event: focus.grandPrix,
      sessionFocus: sessionFocus,
      now: input.now,
    ),
    sessionFocus: sessionFocus,
    scheduleWindow: homeSessionWindow(focus.sessions, sessionFocus?.session),
    // Exact provenance: a calendar-derived fallback focus carries the
    // calendar's record, never the Home resource's.
    provenance: focus.source == HomeFocusSource.homeSnapshot
        ? homeProvenance
        : calendarProvenance,
  );

  final CalendarEntry? latest = dashboard.latestCompleted;
  final HomeLeader driverLeader = resolveDriverLeader(dashboard.driverLeaders);
  final HomeLeader teamLeader = resolveConstructorLeader(
    dashboard.constructorLeaders,
  );
  return HomeReady(
    seasonYear: dashboard.seasonYear,
    season: dashboard.season,
    event: event,
    homeProvenance: homeProvenance,
    driverLeader: HomeLeaderModule(
      leader: driverLeader,
      availability: input.availabilityOf(
        input.driverStandingsMetadata,
        isEmpty: driverLeader is HomeLeaderUnavailable,
      ),
      provenance: HomeSectionFreshness.of(
        input.driverStandingsMetadata,
        input.now,
      ),
      failed: input.driverStandingsFailed,
    ),
    teamLeader: HomeLeaderModule(
      leader: teamLeader,
      availability: input.availabilityOf(
        input.constructorStandingsMetadata,
        isEmpty: teamLeader is HomeLeaderUnavailable,
      ),
      provenance: HomeSectionFreshness.of(
        input.constructorStandingsMetadata,
        input.now,
      ),
      failed: input.constructorStandingsFailed,
    ),
    latestResult: latest == null
        ? null
        : HomeLatestResultModule(
            event: latest,
            provenance: calendarProvenance,
            // Only when a classification is actually cached: an event with no
            // stored result represents no result resource at all.
            resultProvenance: dashboard.latestRaceResult == null
                ? null
                : HomeSectionFreshness.of(input.resultMetadata, input.now),
            winner: resolveHomeRaceWinner(dashboard.latestRaceResult),
            resultStatus: dashboard.latestRaceResult?.status,
          ),
    upcoming: HomeUpcomingModule(
      events: dashboard.upcoming,
      // A materialized calendar has answered even when the answer is "no races
      // left": after the finale, and when every later event is excluded by the
      // approved upcoming rule, the empty list is the complete result.
      availability: input.availabilityOf(
        input.calendarMetadata,
        isEmpty: dashboard.upcoming.isEmpty,
      ),
      provenance: calendarProvenance,
    ),
    refreshing: input.refreshing,
    refreshError: refreshError,
  );
}
