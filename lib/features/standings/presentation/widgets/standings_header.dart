import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../l10n/app_localizations.dart';
// The shared app-bar parts already migrated with Home and Calendar: the 48dp
// action and the S-2 adaptive title. Reused as they are (neither screen is
// modified); promoting them to one shared app bar is the open shell-step item.
import '../../../calendar/presentation/widgets/calendar_header.dart'
    show CalendarTitle;
import '../../../home/presentation/widgets/home_header.dart'
    show HomeIconButton;
import '../../application/standings_state.dart';

/// The pinned Standings header (`standings/`, light-foundations
/// `st-index-*`): the title row (adaptive title, Refresh, Settings) and the
/// season row (ST01), then the championship selector bar (ST02) with a
/// hairline below. It sits outside the tables' scroll views, so it stays
/// pinned; the selected table's caption and notices scroll with its rows.
///
/// The header budget (DD S-1, backlog XS-06: the title row scrolling away at
/// large text) is **not** applied: it is approved only with conditions that
/// require device validation first, so the whole header stays pinned at every
/// text size, as Flutter's header always has.
class StandingsHeader extends StatelessWidget {
  const StandingsHeader({
    super.key,
    required this.selected,
    required this.onSelect,
    required this.onRefresh,
    required this.onOpenSettings,
    this.season,
  });

  final StandingsChampionship selected;
  final ValueChanged<StandingsChampionship> onSelect;
  final VoidCallback onRefresh;
  final VoidCallback onOpenSettings;

  /// "2026 season", or `null` while no season is known.
  final String? season;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    // Reading order follows the prototype's markup (title, Refresh, Settings,
    // season, selector), not geometry: the 48dp buttons start above the
    // title's text box, so a geometric sort would read Refresh first.
    return Semantics(
      container: true,
      explicitChildNodes: true,
      child: ColoredBox(
        color: roles.surface.page,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Padding(
              // `.appbar`: 12px top, gutter sides (actions `margin-right:
              // -4px`); `.appbar--pinned`: 4px bottom.
              padding: const EdgeInsets.fromLTRB(
                GvPrimerLayout.gutter,
                12,
                GvPrimerLayout.gutter - 4,
                4,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  Row(
                    children: <Widget>[
                      Expanded(
                        child: Semantics(
                          sortKey: const OrdinalSortKey(0),
                          child: CalendarTitle(l10n.standingsTitle),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Semantics(
                        sortKey: const OrdinalSortKey(1),
                        child: HomeIconButton(
                          key: const ValueKey<String>('standings-refresh'),
                          icon: Icons.refresh,
                          label: l10n.standingsRefreshAction,
                          onPressed: onRefresh,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Semantics(
                        sortKey: const OrdinalSortKey(2),
                        child: HomeIconButton(
                          key: const ValueKey<String>('standings-settings'),
                          icon: Icons.settings_outlined,
                          label: l10n.settingsOpen,
                          onPressed: onOpenSettings,
                        ),
                      ),
                    ],
                  ),
                  if (season case final String label)
                    Transform.translate(
                      // `.appbar--pinned .season { margin-top: -4px }`.
                      offset: const Offset(0, -4),
                      child: Semantics(
                        container: true,
                        sortKey: const OrdinalSortKey(3),
                        child: Text(
                          label,
                          key: const ValueKey<String>('standings-season'),
                          style: GvPrimerTypography.archivo(
                            size: GvPrimerLayout.bodyFontSize,
                            weight: 500,
                            height: 1.3,
                          ).copyWith(color: roles.text.secondary),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            Semantics(
              sortKey: const OrdinalSortKey(4),
              child: StandingsSelectorBar(
                selected: selected,
                onSelect: onSelect,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The selector bar (`.pinbar`): the Drivers / Constructors segmented control
/// on the page colour, 8px above and 12px below it on the gutter, with the
/// full-width hairline under the pinned header. The group is labelled
/// "Championship" (ST02) and each option is a selected-aware button.
class StandingsSelectorBar extends StatelessWidget {
  const StandingsSelectorBar({
    super.key,
    required this.selected,
    required this.onSelect,
  });

  final StandingsChampionship selected;
  final ValueChanged<StandingsChampionship> onSelect;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    return DecoratedBox(
      key: const ValueKey<String>('standings-selector-bar'),
      decoration: BoxDecoration(
        color: roles.surface.page,
        border: Border(bottom: BorderSide(color: roles.line.subtle)),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          GvPrimerLayout.gutter,
          8,
          GvPrimerLayout.gutter,
          12,
        ),
        child: Semantics(
          label: l10n.standingsChampionshipSelector,
          container: true,
          child: GvPrimerSegmentedControl(
            segments: <String>[
              l10n.standingsDrivers,
              l10n.standingsConstructors,
            ],
            selectedIndex: selected.index,
            onChanged: (int index) =>
                onSelect(StandingsChampionship.values[index]),
          ),
        ),
      ),
    );
  }
}
