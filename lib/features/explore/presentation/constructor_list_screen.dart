import 'package:flutter/material.dart';

import '../../../app/router/entity_navigation.dart';
import '../../../app/router/route_paths.dart';
import '../../../core/theme/tokens/tokens.dart';
import '../../../core/widgets/widgets.dart';
import '../../../l10n/app_localizations.dart';
import '../../shared/presentation/placeholder/placeholder_content.dart';
import '../../shared/presentation/widgets/screen_scaffold.dart';

/// Constructor (teams) list skeleton (Explore → Teams). Team-colour accents are
/// restrained to the row's leading accent bar, never a full background.
class ConstructorListScreen extends StatelessWidget {
  const ConstructorListScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return GvScreenScaffold(
      title: l10n.exploreTeams,
      body: ListView.separated(
        padding: const EdgeInsets.fromLTRB(
          GvLayout.screenPaddingHorizontal,
          GvSpacing.md,
          GvLayout.screenPaddingHorizontal,
          GvSpacing.xxl,
        ),
        itemCount: Placeholders.constructors.length,
        separatorBuilder: (_, _) => const SizedBox(height: GvSpacing.xxs),
        itemBuilder: (BuildContext context, int index) {
          final PlaceholderConstructor team = Placeholders.constructors[index];
          return GvTeamRow(
            key: ValueKey<String>('team-${team.id}'),
            name: team.name,
            subtitle: team.base,
            accentColor: team.accent,
            leading: const SizedBox(
              width: 40,
              child: GvImagePlaceholder(
                aspectRatio: 1,
                icon: Icons.shield_outlined,
              ),
            ),
            onTap: () => context.openEntity(RoutePaths.constructor(team.id)),
          );
        },
      ),
    );
  }
}
