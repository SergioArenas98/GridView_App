import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../app/router/entity_navigation.dart';
import '../../../app/router/route_paths.dart';
import '../../../core/theme/tokens/tokens.dart';
import '../../../core/widgets/widgets.dart';
import '../../../l10n/app_localizations.dart';
import '../../shared/application/providers.dart';
import '../../shared/domain/entities/standing_entry.dart';
import '../../shared/presentation/domain_status.dart';
import '../../shared/presentation/widgets/mock_data_banner.dart';
import '../../shared/presentation/widgets/screen_scaffold.dart';
import '../application/standings_providers.dart';
import '../application/standings_state.dart';
import '../application/standings_ui_state.dart';
import 'standings_row_view.dart';

/// The Standings branch: the drivers' and constructors' championship tables for
/// the resolved season, read from Drift in their delivered order.
///
/// The screen never launches a refresh of its own — neither when it is built nor
/// when the selector changes — because startup and foreground synchronization of
/// the current-season core set belong to the application coordinator (ADR 0015).
/// Pull-to-refresh and the app-bar action go through the coordinator's manual
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

    return GvScreenScaffold(
      title: l10n.standingsTitle,
      showSettingsAction: true,
      extraActions: <Widget>[
        GvIconButton(
          key: const ValueKey<String>('standings-refresh'),
          icon: Icons.refresh,
          semanticLabel: l10n.standingsRefreshAction,
          onPressed: () => _refresh(selected),
        ),
      ],
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          _StandingsHeader(season: state.season, selected: selected),
          Padding(
            padding: const EdgeInsets.fromLTRB(
              GvLayout.screenPaddingHorizontal,
              0,
              GvLayout.screenPaddingHorizontal,
              GvSpacing.sm,
            ),
            child: Semantics(
              label: l10n.standingsChampionshipSelector,
              container: true,
              child: GvSegmentedControl(
                segments: <String>[
                  l10n.standingsDrivers,
                  l10n.standingsConstructors,
                ],
                selectedIndex: selected.index,
                onChanged: (int index) =>
                    _select(StandingsChampionship.values[index]),
              ),
            ),
          ),
          Expanded(
            child: switch (selected) {
              StandingsChampionship.drivers => _DriversTable(
                state: state.drivers,
                controller: _controllers[StandingsChampionship.drivers]!,
                onRefresh: () => _refresh(StandingsChampionship.drivers),
              ),
              StandingsChampionship.constructors => _ConstructorsTable(
                state: state.constructors,
                controller: _controllers[StandingsChampionship.constructors]!,
                onRefresh: () => _refresh(StandingsChampionship.constructors),
              ),
            },
          ),
        ],
      ),
    );
  }
}

/// The season context and the mock-data banner. Freshness, notices and progress
/// belong to the selected table and are rendered with its content, so switching
/// the selector immediately switches that context.
class _StandingsHeader extends ConsumerWidget {
  const _StandingsHeader({required this.season, required this.selected});

  final int? season;
  final StandingsChampionship selected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final bool showMock = ref.watch(usesMockDataProvider);

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        GvLayout.screenPaddingHorizontal,
        GvSpacing.md,
        GvLayout.screenPaddingHorizontal,
        GvSpacing.sm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          if (season != null)
            Text(l10n.seasonLabel('$season'), style: GvTypography.sectionTitle),
          if (showMock) ...<Widget>[
            const SizedBox(height: GvSpacing.sm),
            const MockDataBanner(),
          ],
        ],
      ),
    );
  }
}

/// The selected table's own freshness, progress and non-blocking failure.
///
/// Everything here is scoped to one resource: the drivers' timestamp is never
/// shown while Constructors is selected, and a bootstrap-materialized table
/// claims no update time at all because it has no individual freshness yet.
class _TableStatus extends StatelessWidget {
  const _TableStatus({
    required this.lastSuccessAt,
    required this.isStale,
    required this.refreshing,
    required this.failure,
    this.provisional = StandingsProvisionalSummary.unspecified,
  });

  final DateTime? lastSuccessAt;
  final bool isStale;
  final bool refreshing;
  final StandingsFailure? failure;
  final StandingsProvisionalSummary provisional;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final DateTime? updated = lastSuccessAt;
    final bool showProvisional =
        provisional == StandingsProvisionalSummary.provisional;
    if (updated == null && !refreshing && failure == null && !isStale) {
      if (!showProvisional) return const SizedBox.shrink();
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        GvLayout.screenPaddingHorizontal,
        0,
        GvLayout.screenPaddingHorizontal,
        GvSpacing.sm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          if (refreshing)
            Text(l10n.standingsRefreshingLabel, style: GvTypography.caption)
          else if (updated != null)
            Text(
              l10n.lastUpdatedLabel(
                DateFormat.Hm(
                  Localizations.localeOf(context).languageCode,
                ).format(updated.toLocal()),
              ),
              style: GvTypography.caption,
            ),
          if (showProvisional) ...<Widget>[
            const SizedBox(height: GvSpacing.xxs),
            Text(l10n.standingsProvisionalNotice, style: GvTypography.caption),
          ],
          if (failure != null || isStale) ...<Widget>[
            const SizedBox(height: GvSpacing.sm),
            GvOfflineNotice(
              message: failure != null
                  ? l10n.refreshFailedNotice
                  : l10n.offlineStaleNotice,
            ),
          ],
        ],
      ),
    );
  }
}

class _DriversTable extends StatelessWidget {
  const _DriversTable({
    required this.state,
    required this.controller,
    required this.onRefresh,
  });

  final StandingsTableState<DriverStandingEntry> state;
  final ScrollController controller;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return switch (state) {
      StandingsLoading<DriverStandingEntry>() => const _StandingsSkeleton(),
      StandingsFirstLoadError<DriverStandingEntry>(
        :final StandingsFailure failure,
      ) =>
        _StandingsError(
          failure: failure,
          resourceTitle: l10n.standingsDriversErrorTitle,
          onRetry: onRefresh,
        ),
      StandingsEmpty<DriverStandingEntry>(
        :final DateTime? lastSuccessAt,
        :final bool isStale,
        :final bool refreshing,
        :final StandingsFailure? refreshError,
      ) =>
        _StandingsEmpty(
          title: l10n.standingsDriversEmptyTitle,
          message: l10n.standingsDriversEmptyMessage,
          status: _TableStatus(
            lastSuccessAt: lastSuccessAt,
            isStale: isStale,
            refreshing: refreshing,
            failure: refreshError,
          ),
          onRefresh: onRefresh,
        ),
      StandingsReady<DriverStandingEntry>(
        :final List<DriverStandingEntry> rows,
        :final StandingsProvisionalSummary provisional,
        :final DateTime? lastSuccessAt,
        :final bool isStale,
        :final bool refreshing,
        :final StandingsFailure? refreshError,
      ) =>
        _StandingsList(
          keyPrefix: 'driver-standing',
          storageKey: 'standings-drivers',
          controller: controller,
          onRefresh: onRefresh,
          status: _TableStatus(
            lastSuccessAt: lastSuccessAt,
            isStale: isStale,
            refreshing: refreshing,
            failure: refreshError,
            provisional: provisional,
          ),
          rows: _driverRowViews(context, rows, provisional),
          onOpen: (String id) => context.openEntity(RoutePaths.driver(id)),
        ),
    };
  }
}

class _ConstructorsTable extends StatelessWidget {
  const _ConstructorsTable({
    required this.state,
    required this.controller,
    required this.onRefresh,
  });

  final StandingsTableState<ConstructorStandingEntry> state;
  final ScrollController controller;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return switch (state) {
      StandingsLoading<ConstructorStandingEntry>() =>
        const _StandingsSkeleton(),
      StandingsFirstLoadError<ConstructorStandingEntry>(
        :final StandingsFailure failure,
      ) =>
        _StandingsError(
          failure: failure,
          resourceTitle: l10n.standingsConstructorsErrorTitle,
          onRetry: onRefresh,
        ),
      StandingsEmpty<ConstructorStandingEntry>(
        :final DateTime? lastSuccessAt,
        :final bool isStale,
        :final bool refreshing,
        :final StandingsFailure? refreshError,
      ) =>
        _StandingsEmpty(
          title: l10n.standingsConstructorsEmptyTitle,
          message: l10n.standingsConstructorsEmptyMessage,
          status: _TableStatus(
            lastSuccessAt: lastSuccessAt,
            isStale: isStale,
            refreshing: refreshing,
            failure: refreshError,
          ),
          onRefresh: onRefresh,
        ),
      StandingsReady<ConstructorStandingEntry>(
        :final List<ConstructorStandingEntry> rows,
        :final StandingsProvisionalSummary provisional,
        :final DateTime? lastSuccessAt,
        :final bool isStale,
        :final bool refreshing,
        :final StandingsFailure? refreshError,
      ) =>
        _StandingsList(
          keyPrefix: 'constructor-standing',
          storageKey: 'standings-constructors',
          controller: controller,
          onRefresh: onRefresh,
          status: _TableStatus(
            lastSuccessAt: lastSuccessAt,
            isStale: isStale,
            refreshing: refreshing,
            failure: refreshError,
            provisional: provisional,
          ),
          rows: _constructorRowViews(context, rows, provisional),
          onOpen: (String id) => context.openEntity(RoutePaths.constructor(id)),
        ),
    };
  }
}

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

/// The championship table: a lazy, single-column list of already-formatted rows.
class _StandingsList extends StatelessWidget {
  const _StandingsList({
    required this.keyPrefix,
    required this.storageKey,
    required this.controller,
    required this.onRefresh,
    required this.status,
    required this.rows,
    required this.onOpen,
  });

  final String keyPrefix;
  final String storageKey;
  final ScrollController controller;
  final Future<void> Function() onRefresh;
  final Widget status;
  final List<StandingsRowView> rows;
  final void Function(String entityId) onOpen;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        status,
        Expanded(
          child: RefreshIndicator(
            onRefresh: onRefresh,
            child: ListView.separated(
              // Keeps this table's own position when the other one is shown and
              // this list is rebuilt.
              key: PageStorageKey<String>(storageKey),
              controller: controller,
              padding: const EdgeInsets.fromLTRB(
                GvLayout.screenPaddingHorizontal,
                0,
                GvLayout.screenPaddingHorizontal,
                GvSpacing.xxl,
              ),
              itemCount: rows.length,
              separatorBuilder: (_, _) => const SizedBox(height: GvSpacing.xxs),
              itemBuilder: (BuildContext context, int index) {
                final StandingsRowView row = rows[index];
                return GvStandingsRow(
                  key: ValueKey<String>('$keyPrefix-${row.entityId}'),
                  position: row.position,
                  name: row.name,
                  team: row.team,
                  points: row.points,
                  stat: row.stat,
                  badgeLabel: row.badgeLabel,
                  isLeader: row.isLeader,
                  accentColor: row.accentColor,
                  semanticLabel: row.semanticLabel,
                  onTap: () => onOpen(row.entityId),
                );
              },
            ),
          ),
        ),
      ],
    );
  }
}

/// A materialized table that legitimately has no rows. A real state — not a
/// loader and not an error — and still refreshable.
class _StandingsEmpty extends StatelessWidget {
  const _StandingsEmpty({
    required this.title,
    required this.message,
    required this.status,
    required this.onRefresh,
  });

  final String title;
  final String message;
  final Widget status;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        status,
        Expanded(
          child: RefreshIndicator(
            onRefresh: onRefresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: <Widget>[
                SizedBox(height: MediaQuery.sizeOf(context).height * 0.08),
                GvEmptyState(
                  title: title,
                  message: message,
                  icon: Icons.emoji_events_outlined,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// A section-level first-load error: the shell, the season context and the
/// selector all stay usable, and retry targets exactly this table's resource.
class _StandingsError extends StatelessWidget {
  const _StandingsError({
    required this.failure,
    required this.resourceTitle,
    required this.onRetry,
  });

  final StandingsFailure failure;
  final String resourceTitle;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return GvErrorState(
      title: switch (failure.cause) {
        StandingsFailureCause.seasonUnresolved =>
          l10n.standingsSeasonUnavailableTitle,
        StandingsFailureCause.resourceFailed => resourceTitle,
      },
      message: failure.failure == null
          ? l10n.standingsSeasonUnavailableMessage
          : failureMessage(l10n, failure.failure!),
      icon: Icons.emoji_events_outlined,
      retryLabel: l10n.retry,
      onRetry: onRetry,
    );
  }
}

/// The structured loading placeholder, shown only while the selected table has
/// no materialized local representation.
class _StandingsSkeleton extends StatelessWidget {
  const _StandingsSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(
        GvLayout.screenPaddingHorizontal,
        GvSpacing.xs,
        GvLayout.screenPaddingHorizontal,
        GvSpacing.xxl,
      ),
      children: const <Widget>[
        GvSkeletonBlock(height: 56),
        SizedBox(height: GvSpacing.xxs),
        GvSkeletonBlock(height: 56),
        SizedBox(height: GvSpacing.xxs),
        GvSkeletonBlock(height: 56),
        SizedBox(height: GvSpacing.xxs),
        GvSkeletonBlock(height: 56),
        SizedBox(height: GvSpacing.xxs),
        GvSkeletonBlock(height: 56),
        SizedBox(height: GvSpacing.xxs),
        GvSkeletonBlock(height: 56),
      ],
    );
  }
}
