import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:gridview/core/theme/gridview_theme.dart';

/// Pumps a design-system component inside the GridView dark theme, optionally
/// at a fixed text scale, surface size and locale.
Future<void> pumpComponent(
  WidgetTester tester,
  Widget child, {
  double textScale = 1.0,
  Size? surfaceSize,
  Locale locale = const Locale('en'),
}) async {
  if (surfaceSize != null) {
    await tester.binding.setSurfaceSize(surfaceSize);
    addTearDown(() => tester.binding.setSurfaceSize(null));
  }
  await tester.pumpWidget(
    MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: buildGridViewDarkTheme(),
      locale: locale,
      home: Scaffold(
        body: MediaQuery.withClampedTextScaling(
          minScaleFactor: textScale,
          maxScaleFactor: textScale,
          child: Center(
            child: Padding(padding: const EdgeInsets.all(16), child: child),
          ),
        ),
      ),
    ),
  );
  await tester.pump();
}
