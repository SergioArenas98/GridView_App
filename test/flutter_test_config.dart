import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';

/// Golden comparisons use a small tolerance so that cross-platform font
/// antialiasing (developer machine vs the Linux CI runner) does not cause false
/// failures. Real visual regressions (well above the threshold) still fail.
Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  final GoldenFileComparator current = goldenFileComparator;
  if (current is LocalFileComparator) {
    goldenFileComparator = _TolerantGoldenComparator(current.basedir);
  }
  await testMain();
}

class _TolerantGoldenComparator extends LocalFileComparator {
  _TolerantGoldenComparator(Uri baseDir)
    : super(baseDir.resolve('flutter_test_config.dart'));

  /// Maximum fraction of differing pixels tolerated.
  static const double _threshold = 0.05;

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
