import 'package:flutter/material.dart';

import '../../../../app/router/entity_navigation.dart';
import '../../../../app/router/route_paths.dart';
import '../../../../core/theme/tokens/tokens.dart';
import '../../../../core/time/session_time.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../shared/domain/entities/grand_prix_view.dart';
import '../../../shared/presentation/widgets/screen_sections.dart';

/// The weekend's factual block: circuit, location, dates and the two time-zone
/// contexts, plus the link to the circuit's own screen.
///
/// Every field is omitted when the value is unknown — a missing locality is
/// simply absent, never an empty row. Time zones come only from the event's own
/// IANA zone and the device's zone; neither is inferred from a country.
class GrandPrixEventInfo extends StatelessWidget {
  const GrandPrixEventInfo({
    super.key,
    required this.view,
    required this.deviceTimeZone,
  });

  final GrandPrixDetailView view;

  /// The device's current zone abbreviation, derived from the injected clock.
  final String deviceTimeZone;

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
    final String? circuitName = view.circuit?.name;
    final String? location = _location();
    final String? eventZone = view.grandPrix.timezone;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        GvInfoCard(
          children: <Widget>[
            if (circuitName != null)
              GvDetailField(label: l10n.fieldCircuit, value: circuitName),
            if (location != null)
              GvDetailField(label: l10n.fieldLocation, value: location),
            if (dateRange != null)
              GvDetailField(label: l10n.fieldDates, value: dateRange),
            if (eventZone != null)
              GvDetailField(label: l10n.fieldEventTimeZone, value: eventZone),
            GvDetailField(
              label: l10n.fieldDeviceTimeZone,
              value: deviceTimeZone,
            ),
          ],
        ),
        const SizedBox(height: GvSpacing.sm),
        GvSecondaryButton(
          label: l10n.grandPrixViewCircuit,
          icon: Icons.route_outlined,
          // The event's own season travels with the circuit, so its related
          // event resolves to this weekend rather than the current season.
          onPressed: () => context.openEntity(
            RoutePaths.circuit(view.grandPrix.circuitId),
            season: view.grandPrix.season,
          ),
        ),
      ],
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
