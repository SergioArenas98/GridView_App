import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/theme.dart';
import '../../core/widgets/widgets.dart';
import '../../l10n/app_localizations.dart';
import 'shell_branch_resets.dart';

/// The primary application shell: a state-preserving [IndexedStack] of the four
/// branch navigators (Home, Calendar, Standings, Explore) above the Primer V2
/// bottom navigation ([GvPrimerBottomNav], `nav.css`, LT-9; Step 55C.15).
///
/// The navigation is the scaffold's [Scaffold.bottomNavigationBar], so it
/// reserves layout space: scrolled content and a focused element in the body
/// end above it rather than behind it (Phase 3B §3). The scaffold's own
/// background is the Primer page surface, the only thing the translucent bar
/// can show through.
class AppShell extends StatefulWidget {
  const AppShell({
    super.key,
    required this.navigationShell,
    required this.branchResets,
  });

  final StatefulNavigationShell navigationShell;

  /// Branches that must reopen at their initial location (NF-02, NF-03).
  final ShellBranchResets branchResets;

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  @override
  void didUpdateWidget(AppShell oldWidget) {
    super.didUpdateWidget(oldWidget);
    final int index = widget.navigationShell.currentIndex;
    // A branch activated by any navigation other than the bar (a deep link,
    // an in-app `go`) has just had its location replaced: drop any pending
    // reset for it. Only a change of branch counts, so a rebuild between a
    // recovery's request and its navigation never clears the request.
    if (oldWidget.navigationShell.currentIndex != index) {
      widget.branchResets.discard(index);
    }
  }

  void _onSelect(int index) {
    final StatefulNavigationShell shell = widget.navigationShell;
    // Re-selecting the active branch returns it to its root; selecting another
    // branch restores that branch's preserved stack and scroll position,
    // unless a recovery asked for it to reopen at its initial location
    // (NF-02) or the branch is still showing an invalid page (NF-03).
    final bool reset =
        widget.branchResets.shouldReset(index) || index == shell.currentIndex;
    shell.goBranch(index, initialLocation: reset);
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Scaffold(
      backgroundColor: context.gvPrimer.surface.page,
      body: widget.navigationShell,
      bottomNavigationBar: GvPrimerBottomNav(
        selectedIndex: widget.navigationShell.currentIndex,
        onSelect: _onSelect,
        items: <GvPrimerNavItem>[
          GvPrimerNavItem(label: l10n.navHome, icon: Icons.home_outlined),
          GvPrimerNavItem(
            label: l10n.navCalendar,
            icon: Icons.calendar_month_outlined,
          ),
          // Standings and Explore carry the selected-label fallback of their
          // prototypes (S-3); Home and Calendar keep the regular label.
          GvPrimerNavItem(
            label: l10n.navStandings,
            glyph: GvPrimerGlyph.standings,
            selectedLabelFallback: true,
          ),
          GvPrimerNavItem(
            label: l10n.navExplore,
            icon: Icons.explore_outlined,
            selectedLabelFallback: true,
          ),
        ],
      ),
    );
  }
}
