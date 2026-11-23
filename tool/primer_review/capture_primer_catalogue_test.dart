// Renders the Primer V2 catalogue panels to PNG for owner review.
//
// NOT a golden test and not part of `flutter test` (it lives outside test/).
// Run explicitly:
//
//   flutter test tool/primer_review/capture_primer_catalogue_test.dart
//
// Output: build/primer-review/*.png (ignored). Rendered by the flutter_tester
// engine with the bundled Archivo and the SDK's Material Icons loaded; this is
// a review aid, not device validation and not a canonical (Linux) golden.
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/theme/theme.dart';
import 'package:gridview/features/dev/catalogue/primer_catalogue_section.dart';

import '../../test/support/primer_fonts.dart';

Future<void> _loadMaterialIcons(WidgetTester tester) async {
  final String? root = Platform.environment['FLUTTER_ROOT'];
  if (root == null) return;
  final File file = File(
    '$root/bin/cache/artifacts/material_fonts/materialicons-regular.otf',
  );
  if (!file.existsSync()) return;
  await tester.runAsync(() async {
    final FontLoader loader = FontLoader('MaterialIcons')
      ..addFont(
        Future<ByteData>.value(ByteData.sublistView(file.readAsBytesSync())),
      );
    await loader.load();
  });
}

Future<void> _capture(
  WidgetTester tester, {
  required String name,
  required GvPrimerRoles roles,
  required double width,
  required double textScale,
}) async {
  final GlobalKey key = GlobalKey();
  await tester.binding.setSurfaceSize(Size(width, 6000));
  await tester.pumpWidget(
    MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: buildGridViewDarkTheme(),
      themeAnimationDuration: Duration.zero,
      home: MediaQuery.withClampedTextScaling(
        minScaleFactor: textScale,
        maxScaleFactor: textScale,
        child: Scaffold(
          body: SingleChildScrollView(
            child: RepaintBoundary(
              key: key,
              child: PrimerThemePanel(
                name: roles.brightness.name,
                roles: roles,
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pump();
  expect(tester.takeException(), isNull);
  await tester.runAsync(() async {
    final RenderRepaintBoundary boundary =
        key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
    final ui.Image image = await boundary.toImage(pixelRatio: 2);
    final ByteData png = (await image.toByteData(
      format: ui.ImageByteFormat.png,
    ))!;
    final File out = File('build/primer-review/$name.png')
      ..createSync(recursive: true);
    out.writeAsBytesSync(png.buffer.asUint8List());
    image.dispose();
  });
}

void main() {
  testWidgets('capture Primer V2 catalogue panels', (
    WidgetTester tester,
  ) async {
    await loadArchivo(tester);
    await _loadMaterialIcons(tester);
    addTearDown(() => tester.binding.setSurfaceSize(null));
    for (final GvPrimerRoles roles in <GvPrimerRoles>[
      GvPrimerRoles.dark,
      GvPrimerRoles.light,
    ]) {
      final String theme = roles.brightness.name;
      await _capture(
        tester,
        name: 'primer-$theme-390-100',
        roles: roles,
        width: 390,
        textScale: 1,
      );
      await _capture(
        tester,
        name: 'primer-$theme-320-200',
        roles: roles,
        width: 320,
        textScale: 2,
      );
    }
  });
}
