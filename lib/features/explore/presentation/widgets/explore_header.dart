import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../l10n/app_localizations.dart';
// The shared app-bar parts already migrated with Home, Calendar and
// Standings: the 48dp action and the S-2 adaptive title. Reused as they are
// (none of those screens is modified); promoting them to one shared app bar
// is the open shell-step item.
import '../../../calendar/presentation/widgets/calendar_header.dart'
    show CalendarTitle;
import '../../../home/presentation/widgets/home_header.dart'
    show HomeIconButton;
import '../../application/explore_state.dart';

/// The pinned Explore header (`cue.html`, `.appbar--pinned` + `.pinbar`):
/// the title row (adaptive title, Settings only: Explore has no refresh
/// action), the season, then the category selector bar with the hairline
/// below.
///
/// Only these stay pinned. The selected collection's caption, progress line
/// and notices scroll with its rows (owner-approved DD EF-1, Explore only;
/// the prototype pinned them under the selector). The title / selector
/// scroll-away of the header budget (S-1, XS-06, EXP-01 difference 7) is not
/// applied: the header stays pinned at every text size until Android device
/// validation.
class ExploreHeader extends StatelessWidget {
  const ExploreHeader({
    super.key,
    required this.selected,
    required this.onSelect,
    required this.onOpenSettings,
    this.season,
  });

  final ExploreCategory selected;
  final ValueChanged<ExploreCategory> onSelect;
  final VoidCallback onOpenSettings;

  /// "2026 season", or `null` while no season is known.
  final String? season;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    // Reading order follows the prototype's markup (title, Settings, season,
    // selector), not geometry: the 48dp button starts above the
    // title's text box.
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
                          child: CalendarTitle(l10n.exploreTitle),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Semantics(
                        sortKey: const OrdinalSortKey(1),
                        child: HomeIconButton(
                          key: const ValueKey<String>('explore-settings'),
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
                        sortKey: const OrdinalSortKey(2),
                        child: Text(
                          label,
                          key: const ValueKey<String>('explore-season'),
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
              sortKey: const OrdinalSortKey(3),
              child: ExploreSelectorBar(selected: selected, onSelect: onSelect),
            ),
          ],
        ),
      ),
    );
  }
}

/// The selector bar (`.pinbar`): the Drivers / Teams / Circuits segmented
/// control on the page colour, 8px above and 12px below on the gutter, and
/// the full-width hairline under the pinned header. The group is labelled "Explore category" and each
/// option is a selected-aware button. Options use Explore's 10px padding.
class ExploreSelectorBar extends StatelessWidget {
  const ExploreSelectorBar({
    super.key,
    required this.selected,
    required this.onSelect,
  });

  final ExploreCategory selected;
  final ValueChanged<ExploreCategory> onSelect;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    return DecoratedBox(
      key: const ValueKey<String>('explore-selector-bar'),
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
          label: l10n.exploreCategorySelector,
          container: true,
          child: GvPrimerSegmentedControl(
            optionPadding: 10,
            segments: <String>[
              l10n.exploreDrivers,
              l10n.exploreTeams,
              l10n.exploreCircuits,
            ],
            selectedIndex: selected.index,
            onChanged: (int index) => onSelect(ExploreCategory.values[index]),
          ),
        ),
      ),
    );
  }
}
