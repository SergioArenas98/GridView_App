import 'package:flutter/material.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/time/session_time.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../shared/domain/entities/grand_prix_view.dart';
import '../../../shared/presentation/domain_status.dart';
import '../../../shared/presentation/widgets/event_hero_image.dart';

/// The Grand Prix identity header: name, official name, season and round,
/// location, event state, weekend format and the weekend date range.
///
/// Typographic by default, and image-backed when there is an image.
///
/// The header carries the event's imagery when it is available locally, falling
/// back to the host circuit's, exactly as Home does — both use [EventHeroImage],
/// so the two screens cannot show different pictures for the same event.
///
/// Unlike Home, this header reserves no image area when there is nothing to show:
/// the identity, chips and dates are complete on their own, which is the approved
/// Phase 7 design, and an empty placeholder behind a scrim would add visual weight
/// carrying no information. Media availability is not domain availability, so a
/// missing, rejected, uncached or failed image leaves every line here untouched.
class GrandPrixHero extends StatelessWidget {
  const GrandPrixHero({super.key, required this.view});

  final GrandPrixDetailView view;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final SessionTimePresenter presenter = SessionTimePresenter(
      locale: Localizations.localeOf(context).languageCode,
    );
    final String? dateRange = presenter.formatDateRange(
      view.grandPrix.startDate,
      view.grandPrix.endDate,
    );
    final String? officialName = view.grandPrix.officialName;
    final String? location = _location();

    return GvHeroCard(
      // Only when imagery actually exists. The approved header is typographic, so
      // an absent image is not a gap to fill with an empty placeholder and a
      // scrim — it is the design. The hero's height comes from `GvHeroCard`
      // either way, so gaining or losing a background never shifts the layout.
      background: EventHeroImage.backgroundOrNull(
        eventMedia: view.eventMedia,
        circuitMedia: view.circuitMedia,
        circuitName: view.circuit?.name,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.end,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Wrap(
            spacing: GvSpacing.xs,
            runSpacing: GvSpacing.xxs,
            children: <Widget>[
              GvStatusChip(
                label: requiredEventStatusLabel(l10n, view.grandPrix.status),
                tone: toneForEventStatus(view.grandPrix.status),
              ),
              GvStatusChip(
                label: weekendFormatLabel(l10n, view.grandPrix.format),
              ),
            ],
          ),
          const SizedBox(height: GvSpacing.sm),
          Text(view.grandPrix.name, style: context.gvText.pageTitle),
          // The official name is only useful when it says something the short
          // name does not.
          if (officialName != null && officialName != view.grandPrix.name)
            Text(officialName, style: context.gvText.label),
          const SizedBox(height: GvSpacing.xxs),
          Text(
            <String>[
              l10n.roundLabel('${view.grandPrix.round}'),
              l10n.seasonLabel('${view.grandPrix.season}'),
              ?location,
              ?dateRange,
            ].join(' · '),
            style: context.gvText.bodyM,
          ),
        ],
      ),
    );
  }

  String? _location() {
    final List<String> parts = <String>[
      ?view.circuit?.locality,
      ?view.circuit?.country,
    ];
    return parts.isEmpty ? null : parts.join(', ');
  }
}
