import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/theme/gridview_theme.dart';
import '../l10n/app_localizations.dart';
import 'router/app_router.dart';

/// Root widget of the GridView application.
///
/// Owns the [GoRouter] for the app's lifetime (built once, never rebuilt).
/// Tests may inject a router with a specific initial location.
class GridViewApp extends StatefulWidget {
  const GridViewApp({super.key, this.router});

  /// Optional router override for tests / deep-link entry. When null, the
  /// default GridView router is built.
  final GoRouter? router;

  @override
  State<GridViewApp> createState() => _GridViewAppState();
}

class _GridViewAppState extends State<GridViewApp> {
  late final GoRouter _router = widget.router ?? buildGridViewRouter();

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      onGenerateTitle: (BuildContext context) =>
          AppLocalizations.of(context).appTitle,
      theme: buildGridViewDarkTheme(),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      routerConfig: _router,
    );
  }
}
