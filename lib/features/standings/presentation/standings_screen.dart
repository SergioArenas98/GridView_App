import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/entity_navigation.dart';
import '../../../app/router/route_paths.dart';
import '../../../core/theme/theme.dart';
import '../../../l10n/app_localizations.dart';
import '../../shared/application/providers.dart';
import '../../shared/domain/entities/standing_entry.dart';
import '../../shared/presentation/domain_status.dart';
import '../../shared/presentation/widgets/primer_pinned_header_layout.dart';
import '../application/standings_providers.dart';
import '../application/standings_state.dart';
import '../application/standings_ui_state.dart';
import 'standings_row_view.dart';
import 'widgets/standings_header.dart';
import 'widgets/standings_status_block.dart';
import 'widgets/standings_table.dart';

/// The Standings branch, in Primer V2 (Step 55C.5): the drivers' and
/// constructors' championship tables for the resolved season, read from Drift
/// in their delivered order, as a timing-sheet ranking.
///
/// The title row, the season row and the championship selector are pinned
/// above the selected table; that table's freshness caption, provisional
/// caption and notices scroll with its rows (see [StandingsHeader] for the
/// header budget, which is not applied).
///
/// The screen never launches a refresh of its own — neither when it is built nor
/// when the selector changes — because startup and foreground synchronization of
/// the current-season core set belong to the application coordinator (ADR 0015).
/// Pull-to-refresh and the header action go through the coordinator's manual
/// current-season entry point, or, on a historical season route, through one
/// focused refresh of exactly the selected championship's own resource.
///
/// [season] is absent at the branch root (`/standings`), which resolves the
/// locally current season; the explicit deep-link routes supply their own
/// validated season and the championship they encode.
class StandingsScreen extends ConsumerStatefulWidget {
  const StandingsScreen({super.key, this.championship, this.season});

  /// The championship encoded by an explicit route, or `null` at the
  /// season-agnostic branch root (which uses the session selection).
  final StandingsChampionship? championship;

  /// The exact validated route season, or `null` at the branch root.
  final int? season;

  @override
  ConsumerState<StandingsScreen> createState() => _StandingsScreenState();
}

class _StandingsScreenState extends ConsumerState<StandingsScreen> {
  late final StandingsScope _scope = StandingsScope(
    routeSeason: widget.season,
    routeChampionship: widget.championship,
  );

  /// One controller per table — never shared — so the two lists keep genuinely
  /// independent positions.
  late final Map<StandingsChampionship, ScrollController> _controllers;

  @override
  void initState() {
    super.initState();
    final StandingsUiState ui = ref.read(standingsUiStateProvider);
    _controllers = <StandingsChampionship, ScrollController>{
      for (final StandingsChampionship c in StandingsChampionship.values)
        c: ScrollController(initialScrollOffset: ui.offsetFor(c, widget.season))
          ..addListener(() => _remember(c)),
    };
  }

  @override
  void dispose() {
    for (final ScrollController c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  /// Records a table's offset without rebuilding anything: the screen reads the
  /// remembered offsets once, and a Drift emission or a background refresh never
  /// resets a list.
  void _remember(StandingsChampionship championship) {
    final ScrollController controller = _controllers[championship]!;
    if (!controller.hasClients) return;
    ref
        .read(standingsUiStateProvider.notifier)
        .rememberOffset(
          championship: championship,
          season: ref.read(standingsStateProvider(_scope)).season,
          offset: controller.offset,
        );
  }

  /// A selector change is presentation only: it never produces a request.
  ///
  /// At the branch root the season-agnostic location is preserved. On an explicit
  /// season route the sibling route replaces the current page, so repeated
  /// switching can never build a Drivers → Constructors → Drivers stack.
  void _select(StandingsChampionship championship) {
    ref.read(standingsUiStateProvider.notifier).select(championship);
    final int? season = widget.season;
    if (season == null) return;
    if (widget.championship == championship) return;
    context.go(
      championship == StandingsChampionship.drivers
          ? RoutePaths.standingsDrivers(season)
          : RoutePaths.standingsConstructors(season),
    );
  }

  Future<void> _refresh(StandingsChampionship selected) =>
      ref.read(standingsControllerProvider(_scope).notifier).refresh(selected);

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final StandingsScreenState state = ref.watch(
      standingsStateProvider(_scope),
    );
    final StandingsChampionship selected = state.selected;
    final int? season = state.season;
    final bool showMock = ref.watch(usesMockDataProvider);

    return Scaffold(
      backgroundColor: context.gvPrimer.surface.page,
      body: SafeArea(
        // Step 55C.15R: the header stays pinned unless it would leave the
        // list less than two targets (a short viewport at large text with the
        // strip and the 2 x 2 navigation); then it scrolls with the page.
        child: PrimerPinnedHeaderLayout(
          header: StandingsHeader(
            season: season == null ? null : l10n.seasonLabel('$season'),
            selected: selected,
            onSelect: _select,
            onRefresh: () => _refresh(selected),
            onOpenSettings: () => context.openSettings(),
          ),
          body: switch (selected) {
            StandingsChampionship.drivers => _DriversTable(
              state: state.drivers,
              controller: _controllers[StandingsChampionship.drivers]!,
              showMock: showMock,
              onRefresh: () => _refresh(StandingsChampionship.drivers),
            ),
            StandingsChampionship.constructors => _ConstructorsTable(
              state: state.constructors,
              controller: _controllers[StandingsChampionship.constructors]!,
              showMock: showMock,
              onRefresh: () => _refresh(StandingsChampionship.constructors),
            ),
          },
        ),
      ),
    );
  }
}

class _DriversTable extends StatelessWidget {
  const _DriversTable({
    required this.state,
    required this.controller,
    required this.showMock,
    required this.onRefresh,
  });

  final StandingsTableState<DriverStandingEntry> state;
  final ScrollController controller;
  final bool showMock;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return switch (state) {
      StandingsLoading<DriverStandingEntry>() => const StandingsSkeleton(),
      StandingsFirstLoadError<DriverStandingEntry>(
        :final StandingsFailure failure,
      ) =>
        _firstLoadError(
          l10n,
          failure,
          resourceTitle: l10n.standingsDriversErrorTitle,
          onRetry: onRefresh,
        ),
      StandingsEmpty<DriverStandingEntry>(
        :final DateTime? lastSuccessAt,
        :final bool isStale,
        :final bool refreshing,
        :final StandingsFailure? refreshError,
      ) =>
        StandingsEmptyTable(
          title: l10n.standingsDriversEmptyTitle,
          message: l10n.standingsDriversEmptyMessage,
          status: StandingsStatusBlock(
            lastSuccessAt: lastSuccessAt,
            stale: isStale,
            refreshing: refreshing,
            failed: refreshError != null,
            showMock: showMock,
          ),
          onRefresh: onRefresh,
        ),
      StandingsReady<DriverStandingEntry>(
        :final int season,
        :final List<DriverStandingEntry> rows,
        :final StandingsProvisionalSummary provisional,
        :final DateTime? lastSuccessAt,
        :final bool isStale,
        :final bool refreshing,
        :final StandingsFailure? refreshError,
      ) =>
        StandingsList(
          keyPrefix: 'driver-standing',
          storageKey: 'standings-drivers',
          controller: controller,
          onRefresh: onRefresh,
          status: StandingsStatusBlock(
            lastSuccessAt: lastSuccessAt,
            stale: isStale,
            refreshing: refreshing,
            failed: refreshError != null,
            showMock: showMock,
            provisional: provisional == StandingsProvisionalSummary.provisional,
          ),
          rows: _driverRowViews(context, rows, provisional),
          pointsUnit: _formatter(context).pointsUnit,
          // The table's exact season travels with the entity, so a historical
          // route opens that season's profile rather than the current one.
          onOpen: (String id) =>
              context.openEntity(RoutePaths.driver(id), season: season),
        ),
    };
  }
}

class _ConstructorsTable extends StatelessWidget {
  const _ConstructorsTable({
    required this.state,
    required this.controller,
    required this.showMock,
    required this.onRefresh,
  });

  final StandingsTableState<ConstructorStandingEntry> state;
  final ScrollController controller;
  final bool showMock;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return switch (state) {
      StandingsLoading<ConstructorStandingEntry>() => const StandingsSkeleton(),
      StandingsFirstLoadError<ConstructorStandingEntry>(
        :final StandingsFailure failure,
      ) =>
        _firstLoadError(
          l10n,
          failure,
          resourceTitle: l10n.standingsConstructorsErrorTitle,
          onRetry: onRefresh,
        ),
      StandingsEmpty<ConstructorStandingEntry>(
        :final DateTime? lastSuccessAt,
        :final bool isStale,
        :final bool refreshing,
        :final StandingsFailure? refreshError,
      ) =>
        StandingsEmptyTable(
          title: l10n.standingsConstructorsEmptyTitle,
          message: l10n.standingsConstructorsEmptyMessage,
          status: StandingsStatusBlock(
            lastSuccessAt: lastSuccessAt,
            stale: isStale,
            refreshing: refreshing,
            failed: refreshError != null,
            showMock: showMock,
          ),
          onRefresh: onRefresh,
        ),
      StandingsReady<ConstructorStandingEntry>(
        :final int season,
        :final List<ConstructorStandingEntry> rows,
        :final StandingsProvisionalSummary provisional,
        :final DateTime? lastSuccessAt,
        :final bool isStale,
        :final bool refreshing,
        :final StandingsFailure? refreshError,
      ) =>
        StandingsList(
          keyPrefix: 'constructor-standing',
          storageKey: 'standings-constructors',
          controller: controller,
          onRefresh: onRefresh,
          status: StandingsStatusBlock(
            lastSuccessAt: lastSuccessAt,
            stale: isStale,
            refreshing: refreshing,
            failed: refreshError != null,
            showMock: showMock,
            provisional: provisional == StandingsProvisionalSummary.provisional,
          ),
          rows: _constructorRowViews(context, rows, provisional),
          pointsUnit: _formatter(context).pointsUnit,
          onOpen: (String id) =>
              context.openEntity(RoutePaths.constructor(id), season: season),
        ),
    };
  }
}

/// The first-load error of one table: an unresolved season, or this table's
/// own resource failing, with the retry targeting exactly that table.
Widget _firstLoadError(
  AppLocalizations l10n,
  StandingsFailure failure, {
  required String resourceTitle,
  required Future<void> Function() onRetry,
}) => StandingsErrorTable(
  title: switch (failure.cause) {
    StandingsFailureCause.seasonUnresolved =>
      l10n.standingsSeasonUnavailableTitle,
    StandingsFailureCause.resourceFailed => resourceTitle,
  },
  message: failure.failure == null
      ? l10n.standingsSeasonUnavailableMessage
      : failureMessage(l10n, failure.failure!),
  onRetry: onRetry,
);

List<StandingsRowView> _driverRowViews(
  BuildContext context,
  List<DriverStandingEntry> rows,
  StandingsProvisionalSummary provisional,
) {
  final StandingsFormatter format = _formatter(context);
  final bool tied = hasTiedLeaders(
    rows.map((DriverStandingEntry r) => r.position),
  );
  final bool mark = marksRowsProvisional(provisional);
  return rows
      .map(
        (DriverStandingEntry r) => driverRowView(
          r,
          format: format,
          markProvisional: mark,
          tiedLeaders: tied,
        ),
      )
      .toList(growable: false);
}

List<StandingsRowView> _constructorRowViews(
  BuildContext context,
  List<ConstructorStandingEntry> rows,
  StandingsProvisionalSummary provisional,
) {
  final StandingsFormatter format = _formatter(context);
  final bool tied = hasTiedLeaders(
    rows.map((ConstructorStandingEntry r) => r.position),
  );
  final bool mark = marksRowsProvisional(provisional);
  return rows
      .map(
        (ConstructorStandingEntry r) => constructorRowView(
          r,
          format: format,
          markProvisional: mark,
          tiedLeaders: tied,
        ),
      )
      .toList(growable: false);
}

StandingsFormatter _formatter(BuildContext context) => StandingsFormatter(
  AppLocalizations.of(context),
  Localizations.localeOf(context).toLanguageTag(),
);
