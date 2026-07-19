import 'package:flutter/material.dart';

import '../../../app/router/entity_navigation.dart';
import '../../../app/router/route_paths.dart';
import '../../../core/theme/tokens/tokens.dart';
import '../../../core/widgets/widgets.dart';
import '../../../l10n/app_localizations.dart';
import '../../shared/presentation/placeholder/placeholder_content.dart';
import '../../shared/presentation/widgets/screen_scaffold.dart';

/// Circuit list skeleton (Explore → Circuits). Scrollable list of circuit rows.
class CircuitListScreen extends StatelessWidget {
  const CircuitListScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return GvScreenScaffold(
      title: l10n.exploreCircuits,
      body: ListView.separated(
        padding: const EdgeInsets.fromLTRB(
          GvLayout.screenPaddingHorizontal,
          GvSpacing.md,
          GvLayout.screenPaddingHorizontal,
          GvSpacing.xxl,
        ),
        itemCount: Placeholders.circuits.length,
        separatorBuilder: (_, _) => const SizedBox(height: GvSpacing.xxs),
        itemBuilder: (BuildContext context, int index) {
          final PlaceholderCircuit circuit = Placeholders.circuits[index];
          return GvCircuitRow(
            key: ValueKey<String>('circuit-${circuit.id}'),
            name: circuit.name,
            location: circuit.country,
            leading: const SizedBox(
              width: 40,
              child: GvImagePlaceholder(
                aspectRatio: 1,
                icon: Icons.route_outlined,
              ),
            ),
            onTap: () => context.openEntity(RoutePaths.circuit(circuit.id)),
          );
        },
      ),
    );
  }
}
