import 'package:flutter/material.dart';

import '../../../../app/router/entity_navigation.dart';
import '../../../../app/router/route_paths.dart';
import '../../../../core/theme/tokens/tokens.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../shared/domain/entities/enums.dart';
import '../../../shared/domain/entities/race_result.dart';
import '../../../shared/presentation/domain_status.dart';
import '../../../shared/presentation/result_formatting.dart';
import '../../../shared/presentation/widgets/screen_sections.dart';

/// One stored classification, rendered in its delivered entry order.
///
/// Sprint and race documents each get their own section and are never merged.
/// Only values the document actually carries are shown: a missing time, gap or
/// score is simply absent rather than a false zero, and duplicate displayed
/// positions are rendered as delivered.
class GrandPrixResultSection extends StatelessWidget {
  const GrandPrixResultSection({super.key, required this.document});

  final RaceResult document;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final String locale = Localizations.localeOf(context).languageCode;
    final ResultFormatter formatter = ResultFormatter(locale);
    final String? fastestLapDriver = document.fastestLap?.driverId;

    return GvScreenSection(
      title: _title(l10n),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Align(
            alignment: Alignment.centerLeft,
            child: GvStatusChip(
              label: resultStatusLabel(l10n, document.status),
              tone: document.status == ResultStatus.finalResult
                  ? GvStatusTone.success
                  : GvStatusTone.info,
            ),
          ),
          const SizedBox(height: GvSpacing.sm),
          for (final RaceResultEntry entry in document.entries)
            _row(context, l10n, formatter, entry, fastestLapDriver),
        ],
      ),
    );
  }

  /// Race and sprint get their own localized titles; any other (or future)
  /// session type falls back to the shared session naming rather than being
  /// hidden or mislabelled.
  String _title(AppLocalizations l10n) => switch (document.sessionType) {
    SessionType.race => l10n.grandPrixRaceResults,
    SessionType.sprint => l10n.grandPrixSprintResults,
    _ => l10n.grandPrixResults,
  };

  Widget _row(
    BuildContext context,
    AppLocalizations l10n,
    ResultFormatter formatter,
    RaceResultEntry entry,
    String? fastestLapDriver,
  ) {
    // A competitor whose profile has not synchronised yet has no name (its
    // identity is still a referential stub — GridView_Local_Data.md §9). The
    // stable identifier is never turned into display text: the row shows
    // localized unavailable copy, and the identifier keeps driving navigation.
    final String? resolvedDriver = entry.driverName;
    final String? resolvedTeam = entry.constructorName;
    final String driverName = resolvedDriver ?? l10n.driverNameUnavailable;
    final String teamName = resolvedTeam ?? l10n.constructorNameUnavailable;
    final String statusLabel = finishStatusLabel(l10n, entry.status);
    final String? points = formatter.points(entry.points);
    final String? timing = _timing(l10n, formatter, entry);
    final bool fastest =
        entry.fastestLap == true ||
        (fastestLapDriver != null && fastestLapDriver == entry.driverId);

    return Padding(
      padding: const EdgeInsets.only(bottom: GvSpacing.xxs),
      child: GvResultRow(
        key: ValueKey<String>('result-${document.id}-${entry.driverId}'),
        position: entry.position?.toString() ?? '—',
        driverName: driverName,
        team: teamName,
        // "Finished" on every row is noise; the exception is what matters
        // visually. The full status stays in the row's semantic label.
        statusLabel: entry.status == FinishStatus.finished ? null : statusLabel,
        badgeLabel: fastest ? l10n.resultsFastestLap : null,
        timeOrGap: timing,
        score: points,
        accentColor: entry.status == FinishStatus.finished
            ? null
            : gvToneColor(context, toneForFinishStatus(entry.status)),
        semanticLabel: <String>[
          if (entry.position != null) '${entry.position}',
          driverName,
          teamName,
          statusLabel,
          if (points != null) '$points ${l10n.fieldPoints}',
          ?timing,
          if (fastest) l10n.resultsFastestLap,
        ].join(', '),
        // The classification's own season travels with the competitor.
        onTap: () => context.openEntity(
          RoutePaths.driver(entry.driverId),
          season: document.season,
        ),
        onTeamTap: () => context.openEntity(
          RoutePaths.constructor(entry.constructorId),
          season: document.season,
        ),
        // The action label never embeds an identifier either: with no team name
        // it is the plain localized action.
        teamSemanticLabel: resolvedTeam == null
            ? l10n.grandPrixOpenConstructorUnnamed
            : l10n.grandPrixOpenConstructor(resolvedTeam),
      ),
    );
  }

  /// Elapsed time when the entry has one, else the gap to the leader, else the
  /// whole laps behind, else the delivered display fallback. Any combination of
  /// nulls simply yields no timing text.
  String? _timing(
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
