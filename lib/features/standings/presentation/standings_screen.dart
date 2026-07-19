import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/entity_navigation.dart';
import '../../../app/router/route_paths.dart';
import '../../../core/theme/tokens/tokens.dart';
import '../../../core/widgets/widgets.dart';
import '../../../l10n/app_localizations.dart';
import '../../shared/presentation/placeholder/placeholder_content.dart';
import '../../shared/presentation/widgets/screen_scaffold.dart';

/// Which championship table is shown.
enum StandingsTab { drivers, constructors }

/// Standings screen skeleton (App Flow §8): a drivers/constructors segmented
/// selector, restrained team-colour accents and leader emphasis without a full
/// coloured background. The selector switches route so each table deep-links.
class StandingsScreen extends StatelessWidget {
  const StandingsScreen({super.key, required this.tab, required this.season});

  final StandingsTab tab;
  final int season;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final bool isDrivers = tab == StandingsTab.drivers;
    final List<PlaceholderStanding> rows = isDrivers
        ? Placeholders.driverStandings()
        : Placeholders.constructorStandings();

    return GvScreenScaffold(
      title: l10n.standingsTitle,
      showSettingsAction: true,
      body: Column(
        children: <Widget>[
          Padding(
            padding: const EdgeInsets.fromLTRB(
              GvLayout.screenPaddingHorizontal,
              GvSpacing.md,
              GvLayout.screenPaddingHorizontal,
              GvSpacing.sm,
            ),
            child: GvSegmentedControl(
              segments: <String>[
                l10n.standingsDrivers,
                l10n.standingsConstructors,
              ],
              selectedIndex: tab.index,
              onChanged: (int index) => context.go(
                index == 0
                    ? RoutePaths.standingsDrivers(season)
                    : RoutePaths.standingsConstructors(season),
              ),
            ),
          ),
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(
                GvLayout.screenPaddingHorizontal,
                GvSpacing.xs,
                GvLayout.screenPaddingHorizontal,
                GvSpacing.xxl,
              ),
              itemCount: rows.length,
              separatorBuilder: (_, _) => const SizedBox(height: GvSpacing.xxs),
              itemBuilder: (BuildContext context, int index) {
                final PlaceholderStanding row = rows[index];
                return GvStandingsRow(
                  key: ValueKey<String>('standing-${row.entityId}'),
                  position: '${row.position}',
                  name: row.name,
                  team: row.detail,
                  points: row.points,
                  isLeader: row.isLeader,
                  accentColor: row.accent,
                  onTap: () => context.openEntity(
                    isDrivers
                        ? RoutePaths.driver(row.entityId)
                        : RoutePaths.constructor(row.entityId),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
