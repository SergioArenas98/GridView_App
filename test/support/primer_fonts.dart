import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/theme/tokens/gv_primer_typography.dart';

/// The bundled Archivo asset path (`pubspec.yaml`).
const String archivoAsset = 'assets/fonts/archivo/Archivo-Variable.ttf';

bool _archivoLoaded = false;

/// Loads the bundled Archivo into the test engine.
///
/// `flutter test` renders every family with its own test font unless a font
/// is loaded explicitly; this loads the real asset from the test bundle, so
/// metrics and rasterization are Archivo's. Fonts stay loaded for the rest of
/// the test file, so it only loads once.
Future<void> loadArchivo(WidgetTester tester) async {
  if (_archivoLoaded) return;
  await tester.runAsync(() async {
    final FontLoader loader = FontLoader(GvPrimerFonts.archivo)
      ..addFont(rootBundle.load(archivoAsset));
    await loader.load();
  });
  _archivoLoaded = true;
}
