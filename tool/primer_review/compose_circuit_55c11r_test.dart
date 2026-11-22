// Step 55C.11R review evidence: the Light dimension ticks before and after
// (not goldens).
//
//   flutter test tool/primer_review/capture_circuit_55c11_test.dart  (after)
//   flutter test tool/primer_review/compose_circuit_55c11r_test.dart
//
// Reads build/primer-review/55c11r/before-light-<lang>-<viewport>.png (the
// Step 55C.11 captures, copied before the change) and the current
// build/primer-review/55c11/cd-index-light-<lang>-<viewport>.png, crops both
// to the circuit sheet (box from flutter-geometry.json) and writes
// build/primer-review/55c11r/ticks-light-<lang>-<viewport>.png: before (left)
// and after (right), at device pixel ratio 2, never resized.
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
  for (final String config in <String>['en-390-100', 'es-320-200']) {
    testWidgets('ticks: $config', (WidgetTester tester) async {
      final Map<String, Object?> geometry =
          jsonDecode(
                File(
                  'build/primer-review/55c11/flutter-geometry.json',
                ).readAsStringSync(),
              )
              as Map<String, Object?>;
      final Map<String, Object?> page =
          geometry['index-light-$config']! as Map<String, Object?>;
      final List<Object?> sheet =
          ((page['boxes']! as Map<String, Object?>)['.ch']! as List<Object?>)
                  .first!
              as List<Object?>;
      final List<double> box = <double>[
        for (final Object? v in sheet) (v! as num).toDouble(),
      ];
      final Rect crop = Rect.fromLTWH(
        box[0] * _dpr,
        box[1] * _dpr,
        box[2] * _dpr,
        box[3] * _dpr,
      );
      await tester.runAsync(() async {
        final ui.Image before = await _read(
          'build/primer-review/55c11r/before-light-$config.png',
        );
        final ui.Image after = await _read(
          'build/primer-review/55c11/cd-index-light-$config.png',
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
        File('build/primer-review/55c11r/ticks-light-$config.png')
          ..createSync(recursive: true)
          ..writeAsBytesSync(png.buffer.asUint8List());
      });
    });
  }
}
