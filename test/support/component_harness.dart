import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:gridview/core/theme/gridview_theme.dart';

/// Pumps a design-system component inside a GridView theme, optionally at a
/// fixed text scale, surface size, locale and brightness.
///
/// [brightness] selects the dark (default, flagship) or light theme so a single
/// component test can assert the same behaviour in both.
Future<void> pumpComponent(
  WidgetTester tester,
  Widget child, {
  double textScale = 1.0,
  Size? surfaceSize,
  Locale locale = const Locale('en'),
  Brightness brightness = Brightness.dark,

  /// Reports the platform "remove animations" accessibility setting as on, so a
  /// component test can prove it honours reduced motion.
  bool disableAnimations = false,
}) async {
  if (surfaceSize != null) {
    await tester.binding.setSurfaceSize(surfaceSize);
    addTearDown(() => tester.binding.setSurfaceSize(null));
  }
  await tester.pumpWidget(
    MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: brightness == Brightness.dark
          ? buildGridViewDarkTheme()
          : buildGridViewLightTheme(),
      locale: locale,
      home: Scaffold(
        body: Builder(
          builder: (BuildContext context) {
            final Widget content = MediaQuery.withClampedTextScaling(
              minScaleFactor: textScale,
              maxScaleFactor: textScale,
              child: Center(
                child: Padding(padding: const EdgeInsets.all(16), child: child),
              ),
            );
            if (!disableAnimations) return content;
            return MediaQuery(
              data: MediaQuery.of(context).copyWith(disableAnimations: true),
              child: content,
            );
          },
        ),
      ),
    ),
  );
  await tester.pump();
}
