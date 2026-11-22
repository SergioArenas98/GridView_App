// Step 55C.12R review evidence: the GPD-12 team-link focus before and after
// (not goldens).
//
//   flutter test tool/primer_review/capture_gp_55c12_test.dart  (after)
//   flutter test tool/primer_review/compose_gp_55c12r_test.dart
//
// Reads build/primer-review/55c12r/before-focus-team-<config>.png (the Step
// 55C.12 captures, copied before the change) and the current
// build/primer-review/55c12/gp-focus-team-<config>.png, crops both to the
// classification (the result-row boxes in flutter-geometry.json) and writes
// build/primer-review/55c12r/team-link-<config>.png: before (left) and after
// (right), at device pixel ratio 2, never resized. The focused link is the
// second row's ("McLaren").
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/painting.dart';
import 'package:flutter_test/flutter_test.dart';

const double _dpr = 2;
const double _gap = 24 * _dpr;

Future<ui.Image> _read(String path) async {
  final ui.Codec codec = await ui.instantiateImageCodec(
    File(path).readAsBytesSync(),
  );
  return (await codec.getNextFrame()).image;
}

void main() {
  for (final String config in <String>[
    'dark-en-390-100',
    'dark-es-320-200',
    'light-en-390-100',
    'light-es-320-200',
  ]) {
    testWidgets('team link: $config', (WidgetTester tester) async {
      final Map<String, Object?> geometry =
          jsonDecode(
                File(
                  'build/primer-review/55c12/flutter-geometry.json',
                ).readAsStringSync(),
              )
              as Map<String, Object?>;
      final Map<String, Object?> page =
          geometry['focus-team-$config']! as Map<String, Object?>;
      final List<Object?> rows =
          (page['boxes']! as Map<String, Object?>)['.cl']! as List<Object?>;
      List<double> box(Object? b) => <double>[
        for (final Object? v in b! as List<Object?>) (v! as num).toDouble(),
      ];
      final List<double> first = box(rows.first);
      final List<double> last = box(rows.last);
      final Rect crop = Rect.fromLTRB(
        0,
        (first[1] - 8) * _dpr,
        first[2] * _dpr,
        (last[1] + last[3] + 8) * _dpr,
      );
      await tester.runAsync(() async {
        final ui.Image before = await _read(
          'build/primer-review/55c12r/before-focus-team-$config.png',
        );
        final ui.Image after = await _read(
          'build/primer-review/55c12/gp-focus-team-$config.png',
        );
        final ui.PictureRecorder recorder = ui.PictureRecorder();
        Canvas(recorder)
          ..drawRect(
            Rect.fromLTWH(0, 0, crop.width * 2 + _gap, crop.height),
            Paint()..color = const Color(0xFF7F7F7F),
          )
          ..drawImageRect(before, crop, Offset.zero & crop.size, Paint())
          ..drawImageRect(
            after,
            crop,
            Offset(crop.width + _gap, 0) & crop.size,
            Paint(),
          );
        final ui.Image out = await recorder.endRecording().toImage(
          (crop.width * 2 + _gap).round(),
          crop.height.round(),
        );
        final ByteData png = (await out.toByteData(
          format: ui.ImageByteFormat.png,
        ))!;
        File('build/primer-review/55c12r/team-link-$config.png')
          ..createSync(recursive: true)
          ..writeAsBytesSync(png.buffer.asUint8List());
      });
    });
  }
}
