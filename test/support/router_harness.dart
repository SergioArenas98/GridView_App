import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:gridview/app/router/app_router.dart';
import 'package:gridview/core/theme/gridview_theme.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/l10n/app_localizations.dart';

/// A test host that mirrors [GridViewApp] but exposes locale, text-scale,
/// surface size and animation control so navigation, resilience and golden
/// tests can drive the real router.
class TestApp extends StatelessWidget {
  const TestApp({
    super.key,
    required this.router,
    this.textScale = 1.0,
    this.locale = const Locale('en'),
    this.disableAnimations = false,
    this.padding = EdgeInsets.zero,
  });

  final GoRouter router;
  final double textScale;
  final Locale locale;
  final bool disableAnimations;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      debugShowCheckedModeBanner: false,
      theme: buildGridViewDarkTheme(),
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      routerConfig: router,
      builder: (BuildContext context, Widget? child) {
        Widget content = MediaQuery.withClampedTextScaling(
          minScaleFactor: textScale,
          maxScaleFactor: textScale,
          child: child!,
        );
        if (disableAnimations || padding != EdgeInsets.zero) {
          final MediaQueryData data = MediaQuery.of(context);
          content = MediaQuery(
            data: data.copyWith(
              disableAnimations: disableAnimations
                  ? true
                  : data.disableAnimations,
              padding: padding != EdgeInsets.zero ? padding : data.padding,
              viewPadding: padding != EdgeInsets.zero
                  ? padding
                  : data.viewPadding,
            ),
            child: content,
          );
        }
        return content;
      },
    );
  }
}

/// Pumps the GridView router at [initialLocation] and settles.
Future<GoRouter> pumpApp(
  WidgetTester tester, {
  String initialLocation = '/',
  double textScale = 1.0,
  Size? surfaceSize,
  Locale locale = const Locale('en'),
  bool disableAnimations = false,
  EdgeInsets padding = EdgeInsets.zero,
}) async {
  if (surfaceSize != null) {
    await tester.binding.setSurfaceSize(surfaceSize);
    addTearDown(() => tester.binding.setSurfaceSize(null));
  }
  final GoRouter router = buildGridViewRouter(initialLocation: initialLocation);
  await tester.pumpWidget(
    TestApp(
      router: router,
      textScale: textScale,
      locale: locale,
      disableAnimations: disableAnimations,
      padding: padding,
    ),
  );
  await tester.pumpAndSettle();
  return router;
}

/// Pumps a single widget inside the GridView theme + localizations, without the
/// router. Used for screens exercised in isolation (e.g. Settings with an
/// injected environment).
Future<void> pumpStandalone(
  WidgetTester tester,
  Widget child, {
  Locale locale = const Locale('en'),
}) async {
  await tester.pumpWidget(
    MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: buildGridViewDarkTheme(),
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: child,
    ),
  );
  await tester.pumpAndSettle();
}

/// Taps a primary destination in the pill navigation by its label.
Future<void> tapNav(WidgetTester tester, String label) async {
  await tester.tap(
    find.descendant(of: find.byType(GvBottomNav), matching: find.text(label)),
  );
  await tester.pumpAndSettle();
}

/// The router's current location, read via the public route-information
/// provider (no dependency on internal routing-match types).
String shellLocation(GoRouter router) =>
    router.routeInformationProvider.value.uri.toString();
