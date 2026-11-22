import 'package:flutter/material.dart';

import '../../../../app/router/entity_navigation.dart';
import '../../../../app/router/route_paths.dart';
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../home/domain/home_race_winner.dart';
import '../../../shared/domain/entities/enums.dart';
import '../../../shared/domain/entities/race_result.dart';
import '../../../shared/presentation/domain_status.dart';
import '../../../shared/presentation/primer_status_kinds.dart';
import '../../../shared/presentation/result_formatting.dart';
import '../../../shared/presentation/widgets/primer_detail_notices.dart';
import '../../application/grand_prix_results_state.dart';

/// The result area of Grand Prix Detail (`gpd.css` `.sec` + `.cls`, R01–R15;
/// Step 55C.12). Independent of the detail above it: it can be loading,
/// unavailable or failed without ever removing the weekend information.
///
/// - Unavailable: "Results" and the inline "Results not available yet".
/// - Loading (nothing stored): "Results" and two static 56px placeholders,
///   announced once as loading.
/// - Error (nothing stored): "Results", the inline error with the retry
///   pill.
/// - Ready: one section per stored classification document, in persisted
///   order, never merged ([GrandPrixClassificationSection]). The results
///   resource's own notices ([notices]) sit under the first section's title
///   and status chip, above its rows (states frame 18).
class GrandPrixResultsArea extends StatelessWidget {
  const GrandPrixResultsArea({
    super.key,
    required this.state,
    required this.notices,
    required this.onRetry,
  });

  final GrandPrixResultsState state;

  /// The results-scoped notices (see `grandPrixResultsNotices`); ignored
  /// unless [state] is ready.
  final List<DetailNoticeSpec> notices;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final GrandPrixResultsState results = state;
    return switch (results) {
      GrandPrixResultsUnavailable() => _titled(
        l10n.grandPrixResults,
        GvPrimerEmptyState(
          key: const ValueKey<String>('gp-results-unavailable'),
          icon: Icons.flag_outlined,
          title: l10n.grandPrixResultsUnavailableTitle,
          message: l10n.grandPrixResultsPending,
          padding: GvPrimerEmptyState.inlinePadding,
          announceTitle: true,
        ),
      ),
      GrandPrixResultsLoading() => _titled(
        l10n.grandPrixResults,
        const _ResultsSkeleton(),
      ),
      GrandPrixResultsError(:final failure) => _titled(
        l10n.grandPrixResults,
        GvPrimerEmptyState(
          key: const ValueKey<String>('gp-results-error'),
          icon: Icons.flag_outlined,
          title: l10n.grandPrixResultsErrorTitle,
          message: failureMessage(l10n, failure),
          padding: GvPrimerEmptyState.inlinePadding,
          announceTitle: true,
          action: Align(
            alignment: Alignment.centerLeft,
            child: GvPrimerButton(label: l10n.retry, onPressed: onRetry),
          ),
        ),
      ),
      final GrandPrixResultsReady ready => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          for (int i = 0; i < ready.documents.length; i++)
            GrandPrixClassificationSection(
              key: ValueKey<String>('results-${ready.documents[i].id}'),
              document: ready.documents[i],
              notices: i == 0 ? notices : const <DetailNoticeSpec>[],
            ),
        ],
      ),
    };
  }

  static Widget _titled(String title, Widget body) => Padding(
    key: const ValueKey<String>('gp-results-section'),
    padding: const EdgeInsets.only(top: 32),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: GvPrimerLayout.gutter,
          ),
          child: GvPrimerSectionTitle(title),
        ),
        body,
      ],
    ),
  );
}

/// `.skel.skel--rows`: 12px above, two 56px rows on the gutter 8px apart,
/// 8px below; static, announced once as loading.
class _ResultsSkeleton extends StatelessWidget {
  const _ResultsSkeleton();

  @override
  Widget build(BuildContext context) => GvPrimerLoading(
    semanticLabel: AppLocalizations.of(context).a11yLoading,
    child: const Padding(
      key: ValueKey<String>('gp-results-loading'),
      padding: EdgeInsets.fromLTRB(GvPrimerLayout.gutter, 12, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          GvPrimerSkeleton(height: 56),
          SizedBox(height: 8),
          GvPrimerSkeleton(height: 56),
        ],
      ),
    ),
  );
}

/// One stored classification (`.sec` with `.sec__head` and `.cls`): its
/// title ("Race results", "Sprint results", or the generic "Results" for
/// any other type) and status chip on one wrapping line, the results
/// notices when given, then every entry in delivered order as a
/// [GvPrimerResultRow], 12px below.
///
/// Rules carried over unchanged from the legacy section:
/// - entries are never reordered or deduplicated; a missing position is
///   "—", duplicates render as delivered;
/// - only values the entry carries are shown: no false zero, no invented
///   points; timing is elapsed → gap → laps behind (> 0) → supplied text;
/// - the fastest lap comes from the entry's flag or the document's
///   fastest-lap driver; "Finished" is hidden visually and kept in the
///   label; every other finish is a chip (G-7);
/// - an unresolved name is localized copy, never the identifier, and the
///   identifiers keep navigating, with the classification's season.
///
/// The confirmed race winner (G-5) is `resolveHomeRaceWinner`: a race
/// document, not unavailable, exactly one `position == 1` entry, with a
/// resolved driver name. Never for a sprint (GPD-02), a tied or unresolved
/// P1. Its row gets the gradient cell and the "Winner" kicker, and its label
/// ends with ", Winner".
class GrandPrixClassificationSection extends StatelessWidget {
  const GrandPrixClassificationSection({
    super.key,
    required this.document,
    this.notices = const <DetailNoticeSpec>[],
  });

  final RaceResult document;
  final List<DetailNoticeSpec> notices;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final ResultFormatter formatter = ResultFormatter(
      Localizations.localeOf(context).languageCode,
    );
    final HomeRaceWinner? winner = resolveHomeRaceWinner(document);
    final RaceResultEntry? winnerEntry = winner == null ? null : _winnerEntry();
    final String pointsUnit = _pointsUnit(l10n);
    final List<RaceResultEntry> entries = document.entries;
    return Padding(
      padding: const EdgeInsets.only(top: 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: GvPrimerLayout.gutter,
            ),
            child: Wrap(
              key: ValueKey<String>('results-head-${document.id}'),
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 12,
              runSpacing: 8,
              children: <Widget>[
                GvPrimerSectionTitle(_title(l10n)),
                GvPrimerStatusChip(
                  key: ValueKey<String>('results-status-${document.id}'),
                  label: resultStatusLabel(l10n, document.status),
                  kind: primerResultStatusKind(document.status),
                ),
              ],
            ),
          ),
          if (notices.isEmpty)
            const SizedBox(height: 12)
          else
            PrimerDetailNotices(
              notices: notices,
              blockKey: const ValueKey<String>('gp-results-notices'),
            ),
          for (int i = 0; i < entries.length; i++)
            _row(
              context,
              l10n,
              formatter,
              entries[i],
              pointsUnit: pointsUnit,
              winner: identical(entries[i], winnerEntry),
              dividerAbove: i > 0,
            ),
        ],
      ),
    );
  }

  /// The single confirmed position-1 entry, when [resolveHomeRaceWinner]
  /// established one (it returns `null` for a tie, so there is at most one).
  RaceResultEntry? _winnerEntry() {
    for (final RaceResultEntry entry in document.entries) {
      if (entry.position == 1) return entry;
    }
    return null;
  }

  /// Race and sprint get their own titles; any other (or future) type falls
  /// back to the generic "Results" rather than being hidden or mislabelled.
  String _title(AppLocalizations l10n) => switch (document.sessionType) {
    SessionType.race => l10n.grandPrixRaceResults,
    SessionType.sprint => l10n.grandPrixSprintResults,
    _ => l10n.grandPrixResults,
  };

  /// The unit of `homePointsValue` ("pts"), whichever side of the number
  /// the locale puts it (G-6).
  static String _pointsUnit(AppLocalizations l10n) {
    const String marker = '\u0000';
    return l10n.homePointsValue(marker).replaceAll(marker, '').trim();
  }

  Widget _row(
    BuildContext context,
    AppLocalizations l10n,
    ResultFormatter formatter,
    RaceResultEntry entry, {
    required String pointsUnit,
    required bool winner,
    required bool dividerAbove,
  }) {
    final String? resolvedDriver = entry.driverName;
    final String? resolvedTeam = entry.constructorName;
    final String driverName = resolvedDriver ?? l10n.driverNameUnavailable;
    final String teamName = resolvedTeam ?? l10n.constructorNameUnavailable;
    final String statusLabel = finishStatusLabel(l10n, entry.status);
    final GvPrimerChipKind? finishKind = primerFinishStatusKind(entry.status);
    final String? points = formatter.points(entry.points);
    final String? timing = _timing(l10n, formatter, entry);
    final String? fastestLapDriver = document.fastestLap?.driverId;
    final bool fastest =
        entry.fastestLap == true ||
        (fastestLapDriver != null && fastestLapDriver == entry.driverId);
    final String winnerLabel = l10n.homeWinnerLabel;

    return GvPrimerResultRow(
      key: ValueKey<String>('result-${document.id}-${entry.driverId}'),
      position: entry.position?.toString() ?? '—',
      driverName: driverName,
      driverNameIsFallback: resolvedDriver == null,
      winner: winner,
      winnerLabel: winner ? winnerLabel : null,
      teamName: teamName,
      teamNameIsFallback: resolvedTeam == null,
      // The action label never embeds an identifier: with no team name it is
      // the plain localized action.
      teamSemanticLabel: resolvedTeam == null
          ? l10n.grandPrixOpenConstructorUnnamed
          : l10n.grandPrixOpenConstructor(resolvedTeam),
      points: points,
      pointsUnit: points == null ? null : pointsUnit,
      timing: timing,
      statuses: <GvPrimerStatusLabel>[
        if (finishKind != null) GvPrimerStatusLabel(statusLabel, finishKind),
        if (fastest)
          GvPrimerStatusLabel(
            l10n.resultsFastestLap,
            GvPrimerChipKind.fastestLap,
          ),
      ],
      dividerAbove: dividerAbove,
      semanticLabel: <String>[
        if (entry.position != null) '${entry.position}',
        driverName,
        teamName,
        statusLabel,
        if (points != null) '$points ${l10n.fieldPoints}',
        ?timing,
        if (fastest) l10n.resultsFastestLap,
        if (winner) winnerLabel,
      ].join(', '),
      // The classification's own season travels with the competitor.
      onOpen: () => context.openEntity(
        RoutePaths.driver(entry.driverId),
        season: document.season,
      ),
      onOpenTeam: () => context.openEntity(
        RoutePaths.constructor(entry.constructorId),
        season: document.season,
      ),
    );
  }

  /// Elapsed time when the entry has one, else the gap to the leader, else
  /// the whole laps behind, else the delivered display fallback. Any
  /// combination of nulls simply yields no timing text.
  static String? _timing(
    AppLocalizations l10n,
    ResultFormatter formatter,
    RaceResultEntry entry,
  ) {
    final String? elapsed = formatter.elapsed(entry.elapsedTime);
    if (elapsed != null) return elapsed;
    final String? gap = formatter.gap(entry.gapToLeader);
    if (gap != null) return gap;
    final int? laps = entry.lapsBehind;
    if (laps != null && laps > 0) return l10n.resultLapsBehind(laps);
    return entry.gapText;
  }
}
