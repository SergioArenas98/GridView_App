import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/widgets/widgets.dart';
import '../../l10n/app_localizations.dart';

/// The primary application shell: a state-preserving [IndexedStack] of the four
/// branch navigators (Home, Calendar, Standings, Explore) with a floating
/// elevated pill bottom navigation.
///
/// The pill is placed as the scaffold's [Scaffold.bottomNavigationBar] so it
/// reserves layout space: scrollable content is never hidden behind it
/// (Phase 3B §3 "No overlap with scrollable page content"). Its margins,
/// rounded shape and shadow give the floating-pill appearance.
class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  void _onSelect(int index) {
    // Re-selecting the active branch returns it to its root; selecting another
    // branch restores that branch's preserved stack and scroll position.
    navigationShell.goBranch(
      index,
      initialLocation: index == navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: GvBottomNav(
        selectedIndex: navigationShell.currentIndex,
        onSelect: _onSelect,
        items: <GvBottomNavItem>[
          GvBottomNavItem(icon: Icons.home_outlined, label: l10n.navHome),
          GvBottomNavItem(
            icon: Icons.calendar_month_outlined,
            label: l10n.navCalendar,
          ),
          GvBottomNavItem(
            icon: Icons.emoji_events_outlined,
            label: l10n.navStandings,
          ),
          GvBottomNavItem(icon: Icons.explore_outlined, label: l10n.navExplore),
        ],
      ),
    );
  }
}
