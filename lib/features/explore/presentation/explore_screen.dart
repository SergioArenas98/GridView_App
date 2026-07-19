import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/route_paths.dart';
import '../../../core/theme/tokens/tokens.dart';
import '../../../core/widgets/widgets.dart';
import '../../../l10n/app_localizations.dart';
import '../../shared/presentation/widgets/screen_scaffold.dart';

/// Explore root skeleton (App Flow §9): entry cards to the Drivers, Teams and
/// Circuits collections. Each entry pushes its list within the Explore branch.
class ExploreScreen extends StatelessWidget {
  const ExploreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return GvScreenScaffold(
      title: l10n.exploreTitle,
      showSettingsAction: true,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          GvLayout.screenPaddingHorizontal,
          GvSpacing.md,
          GvLayout.screenPaddingHorizontal,
          GvSpacing.xxl,
        ),
        children: <Widget>[
          _EntryCard(
            icon: Icons.sports_motorsports_outlined,
            title: l10n.exploreDrivers,
            description: l10n.exploreDriversDescription,
            onTap: () => context.push(RoutePaths.exploreDrivers()),
          ),
          const SizedBox(height: GvSpacing.sm),
          _EntryCard(
            icon: Icons.groups_outlined,
            title: l10n.exploreTeams,
            description: l10n.exploreTeamsDescription,
            onTap: () => context.push(RoutePaths.exploreTeams()),
          ),
          const SizedBox(height: GvSpacing.sm),
          _EntryCard(
            icon: Icons.route_outlined,
            title: l10n.exploreCircuits,
            description: l10n.exploreCircuitsDescription,
            onTap: () => context.push(RoutePaths.exploreCircuits()),
          ),
        ],
      ),
    );
  }
}

class _EntryCard extends StatelessWidget {
  const _EntryCard({
    required this.icon,
    required this.title,
    required this.description,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String description;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GvContentCard(
      onTap: onTap,
      child: Row(
        children: <Widget>[
          Icon(icon, size: GvIconSizes.lg, color: GvColors.accentSecondary),
          const SizedBox(width: GvSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(title, style: GvTypography.cardTitle),
                const SizedBox(height: GvSpacing.xxs),
                Text(description, style: GvTypography.bodyM),
              ],
            ),
          ),
          const Icon(Icons.chevron_right, color: GvColors.textMuted),
        ],
      ),
    );
  }
}
