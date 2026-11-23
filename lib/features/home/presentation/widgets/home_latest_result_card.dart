import 'package:flutter/material.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../shared/domain/entities/enums.dart';
import '../../../shared/presentation/domain_status.dart';
import '../../application/home_state.dart';
import '../../domain/home_race_winner.dart';
import '../home_formatting.dart';
import '../home_status_kinds.dart';
import 'home_primer_parts.dart';

/// The latest completed Grand Prix (`refinement-01` `.result`): an open
/// composition on the page with the section title and status chips, the
/// condensed event name, the round and location line, the oxide "Winner" tag
/// with the winner and team, and the "View Grand Prix" link, over a faint
/// outlined watermark of the event's own round number. The whole section opens
/// the Grand Prix; only the link is focusable and announced as the link.
///
/// Result enrichment stays strictly additive:
/// - a winner is shown only when the read model resolved one from an already
///   cached **race** classification; a sprint winner is never substituted;
/// - a cached classification that named no resolvable winner says "Winner
///   unavailable"; with no cached classification the section says whether a
///   classified result exists to open, or that none is available;
/// - the classification's own status is shown with the event status, so
///   nothing is called final unless the stored status says so. The one
///   exception is a completed event whose stored classification is final:
///   there "Final" alone says both (the approved reference shows a single
///   indicator), so the "Completed" chip is not repeated. Any other pairing
///   (unknown, postponed or cancelled events; provisional, unavailable or
///   unknown classifications; no cached classification) keeps both facts.
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
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final EventStatus status = module.event.grandPrix.status;
    final HomeRaceWinner? winner = module.winner;
    final ResultStatus? resultStatus = module.resultStatus;
    final bool showEventStatus = !homeFinalResultCoversEvent(
      status,
      resultStatus,
    );
    final String meta = <String>[
      l10n.roundLabel('${module.round}'),
      ?format.locationLine(module.event),
      ?format.dateRange(
        module.event.grandPrix.startDate,
        module.event.grandPrix.endDate,
      ),
    ].join(' · ');
    final bool dark = roles.brightness == Brightness.dark;

    return HomeStretchedLink(
      key: const ValueKey<String>('home-latest-result'),
      onOpen: onOpen,
      child: Stack(
        clipBehavior: Clip.none,
        children: <Widget>[
          Positioned(
            right: -8,
            bottom: 4,
            child: ExcludeSemantics(
              child: _Watermark(
                text: '${module.round}',
                // Chalk 11% (Dark) / Graphite 10% (Light) stroke: token map §5.
                color: roles.text.primary.withValues(alpha: dark ? 0.11 : 0.10),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                // `.result__head`: flex-wrap with space-between. The row takes
                // the full width so the heading sits at the start and the
                // chips at the end; when both cannot fit, the chips wrap to
                // the start of the next line (a run of one), never clipped.
                // Wrap follows the ambient text direction (RTL mirrors it).
                SizedBox(
                  key: const ValueKey<String>('home-latest-result-head'),
                  width: double.infinity,
                  child: Wrap(
                    alignment: WrapAlignment.spaceBetween,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    spacing: 12,
                    runSpacing: 8,
                    children: <Widget>[
                      GvPrimerSectionTitle(l10n.homeLatestResult),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: <Widget>[
                          if (showEventStatus)
                            GvPrimerStatusChip(
                              label: requiredEventStatusLabel(l10n, status),
                              kind: homeEventStatusKind(status),
                            ),
                          if (resultStatus != null)
                            GvPrimerStatusChip(
                              label: resultStatusLabel(l10n, resultStatus),
                              kind: homeResultStatusKind(resultStatus),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                Semantics(
                  header: true,
                  child: HomeDisplayText(
                    module.event.grandPrix.name,
                    size: 26,
                    cap: 38,
                    weight: 800,
                    width: 80,
                    height: 1.05,
                    tracking: -0.02,
                    color: roles.text.primary,
                  ),
                ),
                const SizedBox(height: 4),
                HomeReadable(
                  child: Text(
                    meta,
                    style: homeTextStyle(color: roles.text.secondary),
                  ),
                ),
                const SizedBox(height: 18),
                if (winner != null)
                  MergeSemantics(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        HomeLiveryTag(l10n.homeWinnerLabel),
                        const SizedBox(height: 8),
                        HomeDisplayText(
                          winner.name,
                          size: 28,
                          cap: 40,
                          weight: 800,
                          width: 84,
                          height: 1.05,
                          tracking: -0.02,
                          color: roles.text.primary,
                        ),
                        if (winner.teamName case final String team)
                          Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: Text(
                              team,
                              style: homeTextStyle(color: roles.text.secondary),
                            ),
                          ),
                      ],
                    ),
                  )
                else
                  HomeReadable(
                    child: Text(
                      // A cached classification that named no resolvable
                      // winner is a different fact from having none at all.
                      resultStatus != null
                          ? l10n.homeWinnerUnavailable
                          : _uncachedResultMessage(l10n),
                      style: homeTextStyle(color: roles.text.secondary),
                    ),
                  ),
                const SizedBox(height: 8),
                HomeStretchedLinkAnchor(
                  semanticLabel: l10n.homeOpenGrandPrix,
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(
                      minHeight: GvPrimerLayout.minTarget,
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        Flexible(
                          child: Text(
                            l10n.homeOpenGrandPrix,
                            style: homeTextStyle(
                              weight: 700,
                              height: 1.3,
                              color: roles.text.primary,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        GvPrimerIcon(
                          GvPrimerGlyph.arrowRight,
                          size: 24,
                          color: roles.text.primary,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// With no classification cached: a published classified result exists
  /// (open the Grand Prix to read it), or no result is available.
  String _uncachedResultMessage(AppLocalizations l10n) =>
      module.event.grandPrix.hasResults
      ? l10n.homeResultNotLoaded
      : l10n.homeResultUnavailable;
}

/// The outlined round numeral behind the section (`.result__mark`): 160px
/// capped at 170, weight 900, `wdth` 125, 1.5px stroke, no fill. Decoration
/// that repeats a real value; never read.
class _Watermark extends StatelessWidget {
  const _Watermark({required this.text, required this.color});

  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final TextStyle base = homeDisplayStyle(
      MediaQuery.textScalerOf(context),
      size: 160,
      cap: 170,
      weight: 900,
      width: 125,
      height: 0.8,
      tracking: -0.06,
      tabular: true,
    );
    return Text(
      text,
      textScaler: TextScaler.noScaling,
      style: base.copyWith(
        foreground: Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5
          ..color = color,
      ),
    );
  }
}
