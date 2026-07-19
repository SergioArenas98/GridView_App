import 'package:flutter/material.dart';

import '../../../app/router/entity_navigation.dart';
import '../../../app/router/route_paths.dart';
import '../../../core/theme/tokens/tokens.dart';
import '../../../core/widgets/widgets.dart';
import '../../../l10n/app_localizations.dart';
import '../../shared/presentation/placeholder/placeholder_content.dart';
import '../../shared/presentation/widgets/screen_scaffold.dart';
import '../../shared/presentation/widgets/screen_sections.dart';

/// Constructor (team) detail skeleton (App Flow §11). Related-entity navigation
/// placeholders link to each current driver; optional sections hide cleanly.
class ConstructorDetailScreen extends StatelessWidget {
  const ConstructorDetailScreen({super.key, required this.constructorId});

  final String constructorId;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final PlaceholderConstructor? team = Placeholders.constructorById(
      constructorId,
    );
    final PlaceholderStanding? standing = Placeholders.standingForConstructor(
      constructorId,
    );
    final List<PlaceholderDriver> drivers = Placeholders.driversForConstructor(
      constructorId,
    );
    final String name = team?.name ?? l10n.genericEntityName;

    return GvScreenScaffold(
      title: l10n.constructorTitle,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          GvLayout.screenPaddingHorizontal,
          GvSpacing.md,
          GvLayout.screenPaddingHorizontal,
          GvSpacing.xxl,
        ),
        children: <Widget>[
          GvHeroCard(
            background: const GvImagePlaceholder(
              aspectRatio: 1,
              icon: Icons.shield_outlined,
              borderRadius: BorderRadius.zero,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.end,
              children: <Widget>[
                Text(name, style: GvTypography.pageTitle),
                if (team != null) Text(team.base, style: GvTypography.bodyM),
              ],
            ),
          ),
          const SizedBox(height: GvSpacing.xl),

          // Related-entity navigation placeholders: current drivers.
          if (drivers.isNotEmpty) ...<Widget>[
            GvScreenSection(
              title: l10n.constructorDrivers,
              child: Column(
                children: <Widget>[
                  for (final PlaceholderDriver driver in drivers)
                    GvDriverRow(
                      key: ValueKey<String>('team-driver-${driver.id}'),
                      name: driver.name,
                      number: driver.number,
                      onTap: () =>
                          context.openEntity(RoutePaths.driver(driver.id)),
                    ),
                ],
              ),
            ),
            const SizedBox(height: GvSpacing.xl),
          ],

          if (standing != null) ...<Widget>[
            GvScreenSection(
              title: l10n.constructorStanding,
              child: GvInfoCard(
                children: <Widget>[
                  GvDetailField(
                    label: l10n.fieldPosition,
                    value: '${standing.position}',
                  ),
                  GvDetailField(
                    label: l10n.fieldPoints,
                    value: standing.points,
                  ),
                ],
              ),
            ),
            const SizedBox(height: GvSpacing.xl),
          ],

          GvScreenSection(
            title: l10n.constructorInformation,
            child: GvInfoCard(
              children: <Widget>[
                GvDetailField(
                  label: l10n.fieldIdentifier,
                  value: constructorId,
                ),
                if (team != null) ...<Widget>[
                  GvDetailField(label: l10n.fieldBase, value: team.base),
                  GvDetailField(
                    label: l10n.fieldPowerUnit,
                    value: team.powerUnit,
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
