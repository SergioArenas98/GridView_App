import 'package:flutter/material.dart';

import '../../../../core/theme/tokens/tokens.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../shared/domain/entities/enums.dart';
import '../../../shared/presentation/domain_status.dart';
import '../../application/home_state.dart';
import '../../domain/home_race_winner.dart';
import '../home_formatting.dart';

/// The latest completed Grand Prix, optionally enriched with an already-cached
/// race result.
///
/// The event summary is the card: name, round, circuit/location, status and
/// date all come from the calendar and are useful on their own. Result
/// enrichment is strictly additive —
///
/// - a missing cached result shows localized "result unavailable" copy and never
///   turns the card into an error;
/// - a winner is shown only when exactly one authoritative, resolved entry held
///   a confirmed position 1 in the **race** classification; a sprint winner is
///   never substituted, and no winner is taken from a row's position in the list;
/// - the classification's status is reported through the same formatter the
///   Grand Prix screen uses, so nothing is called final unless the stored status
///   says so.
///
/// Home never requests a result document to fill this in.
class HomeLatestResultCard extends StatelessWidget {
  const HomeLatestResultCard({
    super.key,
    required this.module,
    required this.format,
    required this.onOpen,
  });

  final HomeLatestResultModule module;
  final HomeFormatter format;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final String statusLabel = requiredEventStatusLabel(
      l10n,
      module.event.grandPrix.status,
    );
    final String? location = format.locationLine(module.event);
    final String? dateRange = format.dateRange(
      module.event.grandPrix.startDate,
      module.event.grandPrix.endDate,
    );
    final HomeRaceWinner? winner = module.winner;
    final ResultStatus? resultStatus = module.resultStatus;

    return Semantics(
      button: true,
      label: <String>[
        module.event.grandPrix.name,
        l10n.roundLabel('${module.round}'),
        ?location,
        ?dateRange,
        statusLabel,
        if (winner != null)
          '${l10n.homeWinnerLabel}, ${winner.name}'
        else
          l10n.homeWinnerUnavailable,
        if (resultStatus != null) resultStatusLabel(l10n, resultStatus),
      ].join(', '),
      child: ExcludeSemantics(
        child: GvContentCard(
          key: const ValueKey<String>('home-latest-result'),
          onTap: onOpen,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Text(
                module.event.grandPrix.name,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: GvTypography.cardTitle,
              ),
              Text(
                <String>[
                  l10n.roundLabel('${module.round}'),
                  ?location,
                  ?dateRange,
                ].join(' · '),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: GvTypography.label,
              ),
              const SizedBox(height: GvSpacing.xs),
              Wrap(
                spacing: GvSpacing.xs,
                runSpacing: GvSpacing.xxs,
                children: <Widget>[
                  GvStatusChip(
                    label: statusLabel,
                    tone: toneForEventStatus(module.event.grandPrix.status),
                  ),
                  if (resultStatus != null)
                    GvStatusChip(label: resultStatusLabel(l10n, resultStatus)),
                ],
              ),
              const SizedBox(height: GvSpacing.sm),
              const Divider(height: 1),
              const SizedBox(height: GvSpacing.sm),
              if (winner != null)
                Row(
                  children: <Widget>[
                    Text(l10n.homeWinnerLabel, style: GvTypography.label),
                    const SizedBox(width: GvSpacing.sm),
                    Expanded(
                      child: Text(
                        <String>[winner.name, ?winner.teamName].join(' · '),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.right,
                        style: GvTypography.bodyM.copyWith(
                          color: GvColors.textPrimary,
                        ),
                      ),
                    ),
                  ],
                )
              else
                Text(
                  // A cached classification that named no resolvable winner is
                  // a different fact from having no classification at all.
                  resultStatus == null
                      ? l10n.homeResultUnavailable
                      : l10n.homeWinnerUnavailable,
                  style: GvTypography.bodyM.copyWith(
                    color: GvColors.textSecondary,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
