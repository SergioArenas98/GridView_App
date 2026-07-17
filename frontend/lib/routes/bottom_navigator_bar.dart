import 'package:gridview/l10n/app_localizations.dart';
import 'package:gridview/pages/grand_prix_list_page.dart';
import 'package:gridview/pages/standings_page.dart';
import 'package:gridview/pages/list_page.dart';
import 'package:flutter/material.dart';
import '../pages/home_page.dart';
import '../pages/settings_page.dart';

class BottomNavigatorBar extends StatefulWidget {
  const BottomNavigatorBar({super.key});

  @override
  State<BottomNavigatorBar> createState() => _BottomNavigatorBarState();
}

class _BottomNavigatorBarState extends State<BottomNavigatorBar> {
  int _selectedIndex = 2;

  // List of pages
  final List<Widget Function()> _pageBuilders = [
    () => const DriverListPage(),
    () => const StandingsPage(),
    () => const HomePage(),
    () => const GrandPrixListPage(),
    () => const SettingsPage(),
  ];

  void _onItemTapped(int index) {
    setState(() {
      _selectedIndex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return Scaffold(
      body: _pageBuilders[_selectedIndex](),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _selectedIndex,
        selectedItemColor: Colors.red,
        unselectedItemColor: Colors.grey,
        onTap: _onItemTapped,
        items: [
          BottomNavigationBarItem(
            icon: Icon(Icons.sports_motorsports),
            label: l10n.driversTeams,
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.leaderboard),
            label: l10n.standings,
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.home),
            label: l10n.home,
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.calendar_month),
            label: l10n.calendar,
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.settings),
            label: l10n.settings,
          ),
        ],
      ),
    );
  }
}
