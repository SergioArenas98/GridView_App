import 'package:flutter/material.dart';

import '../l10n/app_localizations.dart';
import 'shell_home_screen.dart';

/// Root widget of the GridView application shell.
class GridViewApp extends StatelessWidget {
  const GridViewApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      onGenerateTitle: (BuildContext context) =>
          AppLocalizations.of(context).appTitle,
      theme: _darkTheme,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: const ShellHomeScreen(),
    );
  }
}

/// Dark-first baseline theme. The full GridView design-token system is
/// implemented in Phase 3; this only establishes the dark default and the
/// primary accent defined in docs/product/GridView_UI_UX_Design.md.
final ThemeData _darkTheme = ThemeData(
  useMaterial3: true,
  colorScheme: ColorScheme.fromSeed(
    seedColor: const Color(0xFFFF3B30),
    brightness: Brightness.dark,
  ),
);
