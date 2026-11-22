import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/entity_navigation.dart';
import '../../../app/router/route_paths.dart';
import '../../../core/theme/theme.dart';
import '../../../core/time/session_time.dart';
import '../../../core/time/session_time_scope.dart';
import '../../../core/widgets/widgets.dart';
import '../../../l10n/app_localizations.dart';
import '../../shared/application/providers.dart';
import '../../shared/domain/entities/enums.dart';
import '../../shared/domain/entities/grand_prix.dart';
import '../../shared/domain/entities/grand_prix_view.dart';
import '../../shared/domain/entities/session.dart';
import '../../shared/presentation/domain_status.dart';
import '../../shared/presentation/primer_status_kinds.dart';
import '../../shared/presentation/widgets/mock_data_banner.dart';
import '../../shared/presentation/widgets/primer_detail_app_bar.dart';
import '../../shared/presentation/widgets/primer_detail_notices.dart';
import '../application/grand_prix_detail_providers.dart';
import '../application/grand_prix_detail_state.dart';
import '../application/grand_prix_results_state.dart';
import 'widgets/grand_prix_band.dart';
import 'widgets/grand_prix_circuit_row.dart';
import 'widgets/grand_prix_detail_skeleton.dart';
import 'widgets/grand_prix_notices.dart';
import 'widgets/grand_prix_results.dart';
import 'widgets/grand_prix_schedule.dart';

/// Grand Prix detail in Primer V2 (Step 55C.12; Dark and Light; frozen
/// reference `light-rollout-b2/gp-*`, the VS-1 dashed unknowns of
/// `light-coverage-gaps/gp-states-*`, VS-4 notice icons, N-1/N-2, LT-17).
///
/// Identity band (no image: GP10 / XS-15), the circuit row, the weekend
/// schedule and the stored classifications, top to bottom in one primary
/// scrollable under the Primer detail app bar.
///
/// Everything renders from Drift. Detail and results are two independent
/// on-demand resources: each is requested at most once when the route opens,
/// cached content stays visible while either refreshes, and a failure in one
/// never blanks the other. [season] and [round] are already validated by the
/// router. State, providers, routing and refresh scope are unchanged; this
/// file only presents them.
class GrandPrixDetailScreen extends ConsumerWidget {
  const GrandPrixDetailScreen({
    super.key,
    required this.season,
    required this.round,
  });

  final int season;
  final int round;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final GrandPrixKey key = (season: season, round: round);
    final GrandPrixDetailState state = ref.watch(grandPrixStateProvider(key));
    // Mounting the results controller is what makes the result resource
    // eligible; it decides for itself whether a request is warranted.
    ref.watch(grandPrixResultsControllerProvider(key));

    return Scaffold(
      backgroundColor: context.gvPrimer.surface.page,
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            PrimerDetailAppBar(
              title: grandPrixScreenTitle(l10n, state),
              backKey: const ValueKey<String>('gp-detail-back'),
            ),
            Expanded(
              child: switch (state) {
                GrandPrixLoading() => const GrandPrixDetailSkeleton(),
                GrandPrixNotFound() => _PageMessage(
                  key: const ValueKey<String>('gp-not-found'),
                  icon: Icons.event_busy_outlined,
                  title: l10n.grandPrixNotFoundTitle,
                  message: l10n.grandPrixNotFoundMessage,
                  actionLabel: l10n.notFoundGoHome,
                  onAction: () => context.go(RoutePaths.home),
                ),
                GrandPrixFirstLoadError(:final failure) => _PageMessage(
                  key: const ValueKey<String>('gp-first-load-error'),
                  glyph: GvPrimerGlyph.alert,
                  title: l10n.grandPrixErrorTitle,
                  message: failureMessage(l10n, failure),
                  actionLabel: l10n.retry,
                  onAction: () => ref
                      .read(grandPrixControllerProvider(key).notifier)
                      .refresh(),
                ),
                final GrandPrixReady ready => _GrandPrixBody(
                  gpKey: key,
                  state: ready,
                ),
              },
            ),
          ],
        ),
      ),
    );
  }
}

/// The app-bar title: the event's own name once it is known locally, so the
/// race stays identifiable after the header has scrolled away (for example
/// while reading its classification).
///
/// Before the detail is available (loading, not found, first-load failure), or
/// when the stored name is blank, it falls back to the generic localized
/// "Grand Prix" label. It never derives a name from the stable identifier.
@visibleForTesting
String grandPrixScreenTitle(AppLocalizations l10n, GrandPrixDetailState state) {
  if (state is GrandPrixReady) {
    final String name = state.view.grandPrix.name.trim();
    if (name.isNotEmpty) return name;
  }
  return l10n.grandPrixTitle;
}

/// A full-page state (confirmed not found, first-load failure; states
/// frames 2 and 3): the detail-size Primer empty block inside its own scroll
/// view, so 200% text never overflows, with the inverse pill for its action
/// (no hover on Grand Prix Detail, XS-09). Not found keeps the existing
/// "event busy" placeholder icon (the prototype's `#i-event-x`) and "Go to
/// Home"; the failure keeps the alert glyph and retry.
///
/// The title is a heading and the page's one live region, so arriving here
/// is announced, as the legacy `GvErrorState` was.
///
/// A list item merges every descendant into a single semantics node, so
/// without the boundary below the heading and live region would carry the
/// title and the message as one label (GPD-13). `explicitChildNodes` keeps
/// the title as the heading and the message as its own node, as
/// `NotFoundScreen` does (DD NF-6). Nothing visual changes.
class _PageMessage extends StatelessWidget {
  const _PageMessage({
    super.key,
    this.icon,
    this.glyph,
    required this.title,
    required this.message,
    required this.actionLabel,
    required this.onAction,
  });

  final IconData? icon;
  final GvPrimerGlyph? glyph;
  final String title;
  final String message;
  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) => ListView(
    padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom),
    children: <Widget>[
      Semantics(
        explicitChildNodes: true,
        child: GvPrimerEmptyState(
          icon: icon,
          glyph: glyph,
          title: title,
          message: message,
          announceTitle: true,
          action: Align(
            alignment: Alignment.centerLeft,
            child: GvPrimerButton(label: actionLabel, onPressed: onAction),
          ),
        ),
      ),
    ],
  );
}

/// The ready detail: the fixture banner and the event's notices, the
/// identity band, the circuit row, Sessions 32px below and the results
/// sections, ending 32px above the bottom inset.
class _GrandPrixBody extends ConsumerWidget {
  const _GrandPrixBody({required this.gpKey, required this.state});

  final GrandPrixKey gpKey;
  final GrandPrixReady state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final GrandPrixDetailView view = state.view;
    final GrandPrix gp = view.grandPrix;
    final bool showMock = ref.watch(usesMockDataProvider);
    final GrandPrixResultsState results = ref.watch(
      grandPrixResultsStateProvider(gpKey),
    );
    final String deviceTimeZone = ref.watch(deviceTimeZoneLabelProvider);
    final bool remoteFreshness = ref.watch(remoteFreshnessNoticesProvider);
    final SessionTimePresenter presenter = sessionTimePresenterOf(context, ref);
    final List<DetailNoticeSpec> notices = grandPrixEventNotices(
      detail: state,
      results: results,
      remoteFreshness: remoteFreshness,
      l10n: l10n,
    );

    return ListView(
      key: const ValueKey<String>('gp-detail-list'),
      padding: EdgeInsets.only(
        bottom: 32 + MediaQuery.paddingOf(context).bottom,
      ),
      children: <Widget>[
        if (showMock)
          Padding(
            padding: EdgeInsets.fromLTRB(
              GvPrimerLayout.gutter,
              12,
              GvPrimerLayout.gutter,
              notices.isEmpty ? 12 : 0,
            ),
            child: const MockDataBanner(),
          ),
        PrimerDetailNotices(
          notices: notices,
          blockKey: const ValueKey<String>('gp-detail-notices'),
        ),
        _band(
          l10n,
          presenter,
          view,
          topHairline: showMock || notices.isNotEmpty,
        ),
        GrandPrixCircuitRow(
          kicker: l10n.grandPrixCircuit,
          name: view.circuit?.name,
          action: l10n.grandPrixViewCircuit,
          semanticLabel: <String>[
            l10n.grandPrixViewCircuit,
            ?view.circuit?.name,
          ].join(', '),
          // The event's own season travels with the circuit, so its related
          // event resolves to this weekend rather than the current season.
          onOpen: () => context.openEntity(
            RoutePaths.circuit(gp.circuitId),
            season: gp.season,
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 32),
          child: GrandPrixSchedule(
            title: l10n.grandPrixSessions,
            zones: <GrandPrixZoneFact>[
              if (gp.timezone case final String zone)
                GrandPrixZoneFact(l10n.fieldEventTimeZone, zone),
              GrandPrixZoneFact(l10n.fieldDeviceTimeZone, deviceTimeZone),
            ],
            days: _days(l10n, presenter, gp),
            emptyTitle: l10n.grandPrixNoSessionsTitle,
            emptyMessage: l10n.grandPrixNoSessionsMessage,
          ),
        ),
        GrandPrixResultsArea(
          state: results,
          notices: results is GrandPrixResultsReady
              ? grandPrixResultsNotices(
                  results: results,
                  remoteFreshness: remoteFreshness,
                  l10n: l10n,
                )
              : const <DetailNoticeSpec>[],
          onRetry: () => ref
              .read(grandPrixResultsControllerProvider(gpKey).notifier)
              .refresh(),
        ),
      ],
    );
  }

  Widget _band(
    AppLocalizations l10n,
    SessionTimePresenter presenter,
    GrandPrixDetailView view, {
    required bool topHairline,
  }) {
    final GrandPrix gp = view.grandPrix;
    final String name = gp.name.trim();
    final String? official = gp.officialName;
    final String? dates = _unbreakableParts(
      presenter.formatDateRange(gp.startDate, gp.endDate),
    );
    final String? location = _location(view);
    return GrandPrixBand(
      chips: <GvPrimerStatusLabel>[
        GvPrimerStatusLabel(
          requiredEventStatusLabel(l10n, gp.status),
          primerEventStatusKind(gp.status),
        ),
        GvPrimerStatusLabel(
          weekendFormatLabel(l10n, gp.format),
          // An explicit unknown format is dashed (VS-1, the 54A correction).
          gp.format == WeekendFormat.unknown
              ? GvPrimerChipKind.unknown
              : GvPrimerChipKind.context,
        ),
      ],
      roundWord: _roundWord(l10n),
      round: '${gp.round}',
      roundSpoken: l10n.roundLabel('${gp.round}'),
      season: l10n.seasonLabel('${gp.season}'),
      // GPD-03: a blank stored name is localized unavailable copy in the
      // secondary style, still the heading; never an identifier.
      name: name.isEmpty ? l10n.grandPrixNameUnavailable : name,
      nameUnavailable: name.isEmpty,
      // The official name only when it says something the short name does
      // not.
      officialName:
          official != null && official.trim().isNotEmpty && official != gp.name
          ? official
          : null,
      facts: <GrandPrixBandFact>[
        if (dates != null) GrandPrixBandFact(l10n.fieldDates, dates),
        if (location != null) GrandPrixBandFact(l10n.fieldLocation, location),
      ],
      topHairline: topHairline,
    );
  }

  /// Every delivered session in delivered order, grouped only where
  /// consecutive sessions share the primary clock's day (G-4). A session
  /// without a start time has no time and no day header.
  static List<GrandPrixScheduleDay> _days(
    AppLocalizations l10n,
    SessionTimePresenter presenter,
    GrandPrix gp,
  ) {
    final List<(Session, PresentedTime?)> presented =
        <(Session, PresentedTime?)>[
          for (final Session s in gp.sessions)
            (s, presenter.present(s.startTime, eventTimeZone: gp.timezone)),
        ];
    return <GrandPrixScheduleDay>[
      for (final (String?, List<(Session, PresentedTime?)>) run in runsByDay(
        presented,
        ((Session, PresentedTime?) item) => item.$2?.primary.dayLabel,
      ))
        GrandPrixScheduleDay(
          label: run.$1,
          sessions: <GrandPrixScheduleSession>[
            for (final (Session session, PresentedTime? shown) in run.$2)
              GrandPrixScheduleSession(
                id: session.id,
                name: sessionDisplayName(l10n, session),
                status: requiredSessionStatusLabel(l10n, session.status),
                statusKind: primerSessionStatusKind(session.status),
                time: shown?.primary.time,
                zone: shown?.primary.zoneLabel,
                // A conversion that moves the session onto a different
                // calendar day keeps that day on the second line.
                secondaryTime: shown?.secondary == null
                    ? null
                    : <String>[
                        if (shown!.crossesDay) shown.secondary!.dayLabel,
                        shown.secondary!.time,
                        shown.secondary!.zoneLabel,
                      ].join(' '),
              ),
          ],
        ),
    ];
  }

  /// Locality and country, joined, either omitted without a dangling
  /// separator.
  static String? _location(GrandPrixDetailView view) {
    final List<String> parts = <String>[
      ?view.circuit?.locality,
      ?view.circuit?.country,
    ];
    return parts.isEmpty ? null : parts.join(', ');
  }

  /// Keeps each side of a date range on one line ("Jul 24" – "Sun, Jul 26",
  /// the prototype's `.nw` spans): spaces inside a part become no-break
  /// spaces; the range may still wrap around its dash. The text is
  /// otherwise the presenter's, unchanged (GPD-06 open).
  static String? _unbreakableParts(String? range) {
    if (range == null) return null;
    const String dash = ' – ';
    return range
        .split(dash)
        .map((String part) => part.replaceAll(' ', ' '))
        .join(dash);
  }

  /// The word of `roundLabel` without its number ("Round" / "Ronda"),
  /// whichever side of the number the locale puts it.
  static String _roundWord(AppLocalizations l10n) {
    const String marker = '\u0000';
    return l10n.roundLabel(marker).replaceAll(marker, '').trim();
  }
}
