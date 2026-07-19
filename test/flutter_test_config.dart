import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/time/timezones.dart';
import 'package:intl/date_symbol_data_local.dart';

/// Golden comparisons use a small tolerance so that cross-platform font
/// antialiasing (developer machine vs the Linux CI runner) does not cause false
/// failures. Real visual regressions (well above the threshold) still fail.
///
/// The tolerance exists ONLY to absorb platform font antialiasing and
/// rasterization differences between the machine that generated the goldens and
/// the CI runner. It must NOT be used to hide layout, spacing, colour or
/// component regressions: those change a large fraction of pixels, exceed the
/// threshold, and are expected to fail. Measured cross-platform font-AA drift is
/// ~1%; the 2% threshold leaves headroom without masking real changes.
Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  // Session-time rendering needs the IANA timezone database and intl date
  // symbols for the app locales; initialise them once for the whole run.
  ensureTimeZonesInitialized();
  await initializeDateFormatting('en');
  await initializeDateFormatting('es');

  final GoldenFileComparator current = goldenFileComparator;
  if (current is LocalFileComparator) {
    goldenFileComparator = _TolerantGoldenComparator(current.basedir);
  }
  await testMain();
}

class _TolerantGoldenComparator extends LocalFileComparator {
  _TolerantGoldenComparator(Uri baseDir)
    : super(baseDir.resolve('flutter_test_config.dart'));

  /// Maximum fraction of differing pixels tolerated. Sized to absorb only
  /// cross-platform font antialiasing/rasterization drift (~1% measured), never
  /// to mask layout, spacing, colour or component regressions.
  static const double _threshold = 0.02;

  @override
  Future<bool> compare(Uint8List imageBytes, Uri golden) async {
    final ComparisonResult result = await GoldenFileComparator.compareLists(
      imageBytes,
      await getGoldenBytes(golden),
    );
    if (result.passed || result.diffPercent <= _threshold) {
      return true;
    }
    final String error = await generateFailureOutput(result, golden, basedir);
    throw FlutterError(error);
  }
}
