import 'package:flutter/material.dart';

import '../../../app/router/entity_navigation.dart';
import '../../../app/router/route_paths.dart';
import '../../../core/theme/tokens/tokens.dart';
import '../../../core/widgets/widgets.dart';
import '../../../l10n/app_localizations.dart';
import '../../shared/presentation/placeholder/placeholder_content.dart';
import '../../shared/presentation/widgets/screen_scaffold.dart';
import '../../shared/presentation/widgets/screen_sections.dart';

/// Driver detail skeleton (App Flow §10). Identity and season-specific
/// information are visually separated; optional sections are hidden cleanly when
/// the id is not in the placeholder catalogue. Includes a related-entity
/// navigation placeholder to the current team.
class DriverDetailScreen extends StatelessWidget {
  const DriverDetailScreen({super.key, required this.driverId});

  final String driverId;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final PlaceholderDriver? driver = Placeholders.driverById(driverId);
    final PlaceholderStanding? standing = Placeholders.standingForDriver(
      driverId,
    );
    final String name = driver?.name ?? l10n.genericEntityName;

    return GvScreenScaffold(
      title: l10n.driverTitle,
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
              icon: Icons.person_outline,
              borderRadius: BorderRadius.zero,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.end,
              children: <Widget>[
                if (driver != null) GvStatusChip(label: '#${driver.number}'),
                const SizedBox(height: GvSpacing.sm),
                Text(name, style: GvTypography.pageTitle),
                if (driver != null)
                  Text(driver.team, style: GvTypography.bodyM),
              ],
            ),
          ),
          const SizedBox(height: GvSpacing.xl),

          // Related-entity navigation placeholder: current team.
          if (driver != null) ...<Widget>[
            GvScreenSection(
              title: l10n.driverCurrentTeam,
              child: GvTeamRow(
                name: driver.team,
                subtitle: l10n.constructorTitle,
                accentColor: driver.accent,
                onTap: () => context.openEntity(
                  RoutePaths.constructor(driver.constructorId),
                ),
              ),
            ),
            const SizedBox(height: GvSpacing.xl),
          ],

          // Season-specific information (hidden when unavailable).
          if (standing != null) ...<Widget>[
            GvScreenSection(
              title: l10n.driverSeasonStanding,
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

          // Identity (stable id shown as a technical detail, never as the name).
          GvScreenSection(
            title: l10n.driverStatistics,
            child: GvInfoCard(
              children: <Widget>[
                GvDetailField(label: l10n.fieldIdentifier, value: driverId),
                if (driver != null)
                  GvDetailField(label: l10n.fieldNumber, value: driver.number),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
