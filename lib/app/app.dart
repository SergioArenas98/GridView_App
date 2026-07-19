import 'package:flutter/material.dart';

import '../core/theme/gridview_theme.dart';
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
      theme: buildGridViewDarkTheme(),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: const ShellHomeScreen(),
    );
  }
}
