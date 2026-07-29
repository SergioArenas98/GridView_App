import 'package:flutter/material.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/time/session_time.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../shared/domain/entities/grand_prix_view.dart';
import '../../../shared/presentation/domain_status.dart';

/// The Grand Prix identity header: name, official name, season and round,
/// location, event state, weekend format and the weekend date range.
///
/// Deliberately typographic — no remote hero image is loaded and no imagery is
/// required for the header to be complete.
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
