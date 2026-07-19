import 'package:flutter/material.dart';

import '../../../app/router/entity_navigation.dart';
import '../../../app/router/route_paths.dart';
import '../../../core/theme/tokens/tokens.dart';
import '../../../core/widgets/widgets.dart';
import '../../../l10n/app_localizations.dart';
import '../../shared/presentation/placeholder/placeholder_content.dart';
import '../../shared/presentation/widgets/screen_scaffold.dart';

/// Driver list skeleton (Explore → Drivers). Scrollable list of driver rows.
class DriverListScreen extends StatelessWidget {
  const DriverListScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return GvScreenScaffold(
      title: l10n.exploreDrivers,
      body: ListView.separated(
        padding: const EdgeInsets.fromLTRB(
          GvLayout.screenPaddingHorizontal,
          GvSpacing.md,
          GvLayout.screenPaddingHorizontal,
          GvSpacing.xxl,
        ),
        itemCount: Placeholders.drivers.length,
        separatorBuilder: (_, _) => const SizedBox(height: GvSpacing.xxs),
        itemBuilder: (BuildContext context, int index) {
          final PlaceholderDriver driver = Placeholders.drivers[index];
          return GvDriverRow(
            key: ValueKey<String>('driver-${driver.id}'),
            name: driver.name,
            team: driver.team,
            number: driver.number,
            leading: const SizedBox(
              width: 40,
              child: GvImagePlaceholder(
                aspectRatio: 1,
                icon: Icons.person_outline,
              ),
            ),
            onTap: () => context.openEntity(RoutePaths.driver(driver.id)),
          );
        },
      ),
    );
  }
}
