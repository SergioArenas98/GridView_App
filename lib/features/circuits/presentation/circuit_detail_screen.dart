import 'package:flutter/material.dart';

import '../../../app/router/entity_navigation.dart';
import '../../../app/router/route_paths.dart';
import '../../../core/theme/tokens/tokens.dart';
import '../../../core/widgets/widgets.dart';
import '../../../l10n/app_localizations.dart';
import '../../shared/presentation/placeholder/placeholder_content.dart';
import '../../shared/presentation/widgets/event_row.dart';
import '../../shared/presentation/widgets/screen_scaffold.dart';
import '../../shared/presentation/widgets/screen_sections.dart';

/// Circuit detail skeleton (App Flow §12). The related-Grand-Prix navigation
/// placeholder routes back through [BuildContext.openEntity] so a
/// `Grand Prix → Circuit → Grand Prix` loop collapses instead of stacking.
class CircuitDetailScreen extends StatelessWidget {
  const CircuitDetailScreen({super.key, required this.circuitId});

  final String circuitId;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final PlaceholderCircuit? circuit = Placeholders.circuitById(circuitId);
    final PlaceholderEvent? event = Placeholders.eventForCircuit(circuitId);
    final String name = circuit?.name ?? l10n.genericEntityName;

    return GvScreenScaffold(
      title: l10n.circuitTitle,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          GvLayout.screenPaddingHorizontal,
          GvSpacing.md,
          GvLayout.screenPaddingHorizontal,
          GvSpacing.xxl,
        ),
        children: <Widget>[
          GvHeroCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.end,
              children: <Widget>[
                Text(name, style: GvTypography.pageTitle),
                if (circuit != null)
                  Text(circuit.country, style: GvTypography.bodyM),
              ],
            ),
          ),
          const SizedBox(height: GvSpacing.xl),

          // Layout image placeholder.
          GvScreenSection(
            title: l10n.circuitLayout,
            child: const GvImagePlaceholder(
              aspectRatio: 16 / 9,
              icon: Icons.route_outlined,
            ),
          ),
          const SizedBox(height: GvSpacing.xl),

          if (circuit != null) ...<Widget>[
            GvScreenSection(
              title: l10n.circuitInformation,
              child: GvInfoCard(
                children: <Widget>[
                  GvDetailField(label: l10n.fieldIdentifier, value: circuitId),
                  GvDetailField(
                    label: l10n.fieldCountry,
                    value: circuit.country,
                  ),
                  GvDetailField(
                    label: l10n.fieldLength,
                    value: '${circuit.lengthKm} km',
                  ),
                  GvDetailField(
                    label: l10n.fieldLaps,
                    value: '${circuit.laps}',
                  ),
                ],
              ),
            ),
            const SizedBox(height: GvSpacing.xl),
          ] else ...<Widget>[
            GvScreenSection(
              title: l10n.circuitInformation,
              child: GvInfoCard(
                children: <Widget>[
                  GvDetailField(label: l10n.fieldIdentifier, value: circuitId),
                ],
              ),
            ),
            const SizedBox(height: GvSpacing.xl),
          ],

          // Related-entity navigation placeholder: this season's Grand Prix.
          if (event != null)
            GvScreenSection(
              title: l10n.circuitRelatedGrandPrix,
              child: EventRow(
                event: event,
                onTap: () => context.openEntity(
                  RoutePaths.grandPrix(
                    season: event.season,
                    round: event.round,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
