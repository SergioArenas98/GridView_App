// Step 55C.9R review captures: DD-06 / XS-14 long-word wrapping on the
// Driver plate (not goldens).
//
//   flutter test tool/primer_review/capture_driver_55c9r_test.dart
//
// Output in build/primer-review/55c9r/, device pixel ratio 2, never resized:
// - dd06-<theme>-<name>-<viewport>.png: the production DriverPlate with the
//   approved rule A (left) next to candidate rule B
//   (`stackForUnbrokenName: true`, right), at the same width and text scale;
// - dd06-metrics.md: name width, line count and layout per configuration.
// The plate data are development test values (the fixture identity
// "Max Verstappen" and the owner-named long-word case "Nico Hulkenberg"),
// not real-world results. Rendered by flutter_tester with the bundled Archivo;
// not device validation.
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/theme/theme.dart';
import 'package:gridview/features/drivers/presentation/widgets/driver_plate.dart';

import '../../test/support/primer_fonts.dart';

const double _dpr = 2;
const String _out = 'build/primer-review/55c9r';

const List<(String, String, String)> _drivers = <(String, String, String)>[
  ('max-verstappen', 'Max Verstappen', 'VER'),
  ('nico-hulkenberg', 'Nico Hulkenberg', 'HUL'),
];

const List<(double, double)> _viewports = <(double, double)>[
  (346, 1),
  (360, 1),
  (375, 1),
  (390, 1),
  (320, 2),
];

Widget _plate({
  required String name,
  required String code,
  required bool ruleB,
}) => DriverPlate(
  key: ValueKey<bool>(ruleB),
  name: name,
  seasonLine: '2026 season',
  nationality: 'Dutch',
  nationalityLabel: 'Nationality',
  number: const DriverPlateNumber(label: 'Race number', figure: '1'),
  code: code,
  stackForUnbrokenName: ruleB,
);

Future<void> _pump(
  WidgetTester tester, {
  required ThemeData theme,
  required double width,
  required double scale,
  required String name,
  required String code,
}) async {
  await tester.binding.setSurfaceSize(Size(width * 2 + 24, 900));
  await tester.pumpWidget(
    MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: theme,
      home: MediaQuery(
        data: MediaQueryData(
          size: Size(width * 2 + 24, 900),
          textScaler: TextScaler.linear(scale),
        ),
        child: Scaffold(
          backgroundColor: theme.extension<GvPrimerRoles>()!.surface.page,
          // Unbounded height, as in the screen's ListView.
          body: SingleChildScrollView(
            child: RepaintBoundary(
              key: const ValueKey<String>('dd06'),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  SizedBox(
                    width: width,
                    child: _plate(name: name, code: code, ruleB: false),
                  ),
                  const SizedBox(width: 24),
                  SizedBox(
                    width: width,
                    child: _plate(name: name, code: code, ruleB: true),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  expect(tester.takeException(), isNull);
}

/// (name width, name lines, stacked) for the plate with [ruleB].
(double, int, bool) _measure(WidgetTester tester, bool ruleB) {
  final Finder plate = find.byKey(ValueKey<bool>(ruleB));
  final Rect name = tester.getRect(
    find.descendant(
      of: plate,
      matching: find.byKey(const ValueKey<String>('driver-plate-name')),
    ),
  );
  final Rect board = tester.getRect(
    find.descendant(
      of: plate,
      matching: find.byKey(const ValueKey<String>('driver-plate-board')),
    ),
  );
  final Text text = tester.widget<Text>(
    find.descendant(
      of: plate,
      matching: find.byKey(const ValueKey<String>('driver-plate-name')),
    ),
  );
  final int lines = (name.height / (text.style!.fontSize! * 0.98)).round();
  return (name.width, lines, board.top >= name.bottom);
}

void main() {
  testWidgets('DD-06 A/B comparison', (WidgetTester tester) async {
    await loadArchivo(tester);
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final List<String> rows = <String>[
      '# DD-06 / XS-14: Driver plate long-word comparison (flutter_tester)',
      '',
      'A = approved rule (23em / 30em). B = candidate: also stack when the '
          "name's longest word is wider than the name column beside the board. "
          'Lines = rendered name lines; a 3-line two-word name means a word was '
          'split.',
      '',
      '| Theme | Name | Viewport | A layout | A name width | A lines | '
          'B layout | B name width | B lines |',
      '|---|---|---|---|---|---|---|---|---|',
    ];
    for (final (String theme, ThemeData data) in <(String, ThemeData)>[
      ('dark', buildGridViewDarkTheme()),
      ('light', buildGridViewLightTheme()),
    ]) {
      for (final (String id, String name, String code) in _drivers) {
        for (final (double width, double scale) in _viewports) {
          await _pump(
            tester,
            theme: data,
            width: width,
            scale: scale,
            name: name,
            code: code,
          );
          final (double aw, int al, bool astack) = _measure(tester, false);
          final (double bw, int bl, bool bstack) = _measure(tester, true);
          final String vp = '${width.toInt()}-${(scale * 100).toInt()}';
          rows.add(
            '| $theme | $name | $vp | ${astack ? 'stacked' : 'wide'} | '
            '${aw.toStringAsFixed(1)} | $al | ${bstack ? 'stacked' : 'wide'} | '
            '${bw.toStringAsFixed(1)} | $bl |',
          );
          final RenderRepaintBoundary boundary = tester
              .renderObject<RenderRepaintBoundary>(
                find.byKey(const ValueKey<String>('dd06')),
              );
          final double h = <double>[
            tester.getSize(find.byKey(const ValueKey<bool>(false))).height,
            tester.getSize(find.byKey(const ValueKey<bool>(true))).height,
          ].reduce((double a, double b) => a > b ? a : b);
          late ui.Image image;
          await tester.runAsync(() async {
            final ui.Image full = await boundary.toImage(pixelRatio: _dpr);
            final ui.PictureRecorder recorder = ui.PictureRecorder();
            final Rect crop = Rect.fromLTWH(
              0,
              0,
              (width * 2 + 24) * _dpr,
              h * _dpr,
            );
            Canvas(recorder)
              ..drawRect(
                Offset.zero & crop.size,
                Paint()..color = const Color(0xFF7F7F7F),
              )
              ..drawImageRect(full, crop, Offset.zero & crop.size, Paint());
            image = await recorder.endRecording().toImage(
              crop.width.round(),
              crop.height.round(),
            );
            final ByteData png = (await image.toByteData(
              format: ui.ImageByteFormat.png,
            ))!;
            File('$_out/dd06-$theme-$id-$vp.png')
              ..createSync(recursive: true)
              ..writeAsBytesSync(png.buffer.asUint8List());
          });
        }
      }
    }
    File('$_out/dd06-metrics.md')
      ..createSync(recursive: true)
      ..writeAsStringSync('${rows.join('\n')}\n');
  });
}
