// Step 55B.3 review captures and ring measurements (not goldens).
//
//   node tool/primer_review/capture_primer_55b3_refs.mjs   (Chrome references)
//   flutter test tool/primer_review/capture_primer_55b3_test.dart
//
// Output in build/primer-review/55b3/, every PNG at device pixel ratio 2 and
// never resized:
// - cmp-<family>-<theme>-<viewport>.png: the Chrome reference crop (left)
//   next to the same window of the Flutter rows (right), when the reference
//   exists;
// - edge-<family>-<theme>-320-200.png: the edge-state rows, Spanish,
//   320×693 at 200% text (viewport);
// - focus-<theme>-<viewport>.png: keyboard-focused rows, one crop each;
// - ring-visibility.md: the measured visibility and adjacent contrast of
//   every focused ring.
// Rendered by the flutter_tester engine; not device validation.
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/theme/theme.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/dev/catalogue/primer_catalogue_rows.dart';

import '../../test/support/primer_fonts.dart';
import '../../test/support/ring_probe.dart';

const double _dpr = 2;
const String _out = 'build/primer-review/55b3';
const double _gap = 24;

class _Vp {
  const _Vp(this.name, this.size, this.scale, {required this.spanish});
  final String name;
  final Size size;
  final double scale;
  final bool spanish;
}

const _Vp _en390 = _Vp('390-100', Size(390, 844), 1, spanish: false);
const _Vp _es320 = _Vp('320-200', Size(320, 693), 2, spanish: true);

final Map<String, GvPrimerRoles> _themes = <String, GvPrimerRoles>{
  'dark': GvPrimerRoles.dark,
  'light': GvPrimerRoles.light,
};

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

Future<void> _pump(
  WidgetTester tester,
  GlobalKey key,
  _Vp vp,
  GvPrimerRoles roles,
  Widget body,
) async {
  await tester.binding.setSurfaceSize(vp.size);
  await tester.pumpWidget(const SizedBox());
  await tester.pumpWidget(
    RepaintBoundary(
      key: key,
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: roles.brightness == Brightness.dark
            ? buildGridViewDarkTheme()
            : buildGridViewLightTheme(),
        themeAnimationDuration: Duration.zero,
        home: Builder(
          builder: (BuildContext context) => MediaQuery(
            data: MediaQuery.of(context).copyWith(
              textScaler: TextScaler.linear(vp.scale),
              disableAnimations: true,
            ),
            child: GvPrimerSurface(
              kind: GvPrimerSurfaceKind.page,
              roles: roles,
              child: Scaffold(
                backgroundColor: roles.surface.page,
                body: ListView(children: <Widget>[body]),
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pump();
  expect(tester.takeException(), isNull);
}

Future<ui.Image> _image(WidgetTester tester, GlobalKey key) async {
  late ui.Image image;
  await tester.runAsync(() async {
    image =
        await (key.currentContext!.findRenderObject()! as RenderRepaintBoundary)
            .toImage(pixelRatio: _dpr);
  });
  return image;
}

Future<void> _write(WidgetTester tester, ui.Image image, String name) async {
  await tester.runAsync(() async {
    final ByteData png = (await image.toByteData(
      format: ui.ImageByteFormat.png,
    ))!;
    File('$_out/$name.png')
      ..createSync(recursive: true)
      ..writeAsBytesSync(png.buffer.asUint8List());
  });
}

Future<ui.Image?> _readRef(WidgetTester tester, String name) async {
  final File file = File('$_out/$name.png');
  if (!file.existsSync()) return null;
  ui.Image? image;
  await tester.runAsync(() async {
    final ui.Codec codec = await ui.instantiateImageCodec(
      file.readAsBytesSync(),
    );
    image = (await codec.getNextFrame()).image;
  });
  return image;
}

/// Lays [crops] (each an image and a device-pixel source rect) side by side
/// or stacked on [background], with a gap; nothing is scaled.
Future<ui.Image> _compose(
  WidgetTester tester,
  List<(ui.Image, Rect)> crops,
  Color background, {
  required bool horizontal,
}) async {
  const double gap = _gap * _dpr;
  double w = 0;
  double h = 0;
  for (final (ui.Image _, Rect r) in crops) {
    if (horizontal) {
      w += r.width + (w == 0 ? 0 : gap);
      h = h < r.height ? r.height : h;
    } else {
      h += r.height + (h == 0 ? 0 : gap);
      w = w < r.width ? r.width : w;
    }
  }
  final ui.PictureRecorder recorder = ui.PictureRecorder();
  final Canvas canvas = Canvas(recorder)
    ..drawRect(Rect.fromLTWH(0, 0, w, h), Paint()..color = background);
  double at = 0;
  for (final (ui.Image image, Rect r) in crops) {
    final Offset origin = horizontal ? Offset(at, 0) : Offset(0, at);
    canvas.drawImageRect(image, r, origin & r.size, Paint());
    at += (horizontal ? r.width : r.height) + gap;
  }
  late ui.Image out;
  await tester.runAsync(() async {
    out = await recorder.endRecording().toImage(w.round(), h.round());
  });
  return out;
}

Widget _main(String family, bool spanish) => switch (family) {
  'results' => PrimerResultRowsSpecimen(spanish: spanish, states: false),
  'standings' => PrimerStandingsRowsSpecimen(spanish: spanish, states: false),
  _ => PrimerRaceRowsSpecimen(spanish: spanish, states: false),
};

Widget _edge(String family) => switch (family) {
  'results' => const PrimerResultRowsSpecimen(spanish: true, main: false),
  'standings' => const PrimerStandingsRowsSpecimen(spanish: true, main: false),
  _ => const PrimerRaceRowsSpecimen(spanish: true, main: false),
};

/// One focused target to capture: the row widget type, which target inside
/// it (0 = the row, 1 = the GP team link) and which instance of the row.
class _FocusCase {
  const _FocusCase(this.name, this.family, this.rowType, this.row, this.target);
  final String name;
  final String family;
  final Type rowType;
  final int row;
  final int target;
}

const List<_FocusCase> _focusCases = <_FocusCase>[
  _FocusCase('GP winner row', 'results', GvPrimerResultRow, 0, 0),
  _FocusCase('GP team link', 'results', GvPrimerResultRow, 0, 1),
  _FocusCase('GP classified row', 'results', GvPrimerResultRow, 1, 0),
  _FocusCase('Standings leader card', 'standings', GvPrimerStandingsRow, 0, 0),
  _FocusCase('Standings row', 'standings', GvPrimerStandingsRow, 2, 0),
  _FocusCase('Calendar completed row', 'calendar', GvPrimerRaceRow, 0, 0),
  _FocusCase('Calendar next event', 'calendar', GvPrimerRaceRow, 4, 0),
];

void main() {
  testWidgets('Step 55B.3 review captures', (WidgetTester tester) async {
    await loadArchivo(tester);
    await _loadMaterialIcons(tester);
    final GlobalKey key = GlobalKey();
    final StringBuffer report = StringBuffer()
      ..writeln('# Step 55B.3 focus-ring visibility (flutter_tester, DPR 2)')
      ..writeln()
      ..writeln(
        'Ring centre line sampled every logical pixel; adjacent pixels '
        '2.5px either side. Not device validation.',
      )
      ..writeln()
      ..writeln('| Theme | Viewport | Case | Ring | Visible | Min adjacent |')
      ..writeln('|---|---|---|---|---|---|');

    for (final MapEntry<String, GvPrimerRoles> theme in _themes.entries) {
      final GvPrimerRoles roles = theme.value;
      for (final _Vp vp in <_Vp>[_en390, _es320]) {
        // 1. Chrome | Flutter comparisons of the approved fixture rows.
        for (final String family in <String>[
          'results',
          'standings',
          'calendar',
        ]) {
          await _pump(tester, key, vp, roles, _main(family, vp.spanish));
          final ui.Image flutter = await _image(tester, key);
          final ui.Image? ref = await _readRef(
            tester,
            'ref-$family-${theme.key}-${vp.name}',
          );
          if (ref != null) {
            final Rect window = Rect.fromLTWH(
              0,
              0,
              ref.width.toDouble(),
              ref.height.toDouble(),
            );
            final ui.Image cmp = await _compose(
              tester,
              <(ui.Image, Rect)>[(ref, window), (flutter, window)],
              const Color(0xFF7F7F7F),
              horizontal: true,
            );
            await _write(tester, cmp, 'cmp-$family-${theme.key}-${vp.name}');
            cmp.dispose();
            ref.dispose();
          }
          flutter.dispose();
        }

        // 2. Edge states, Spanish at 320 @200% only.
        if (vp == _es320) {
          for (final String family in <String>[
            'results',
            'standings',
            'calendar',
          ]) {
            // Full content height at the viewport width (still DPR 2, not
            // resized), so every edge state is in one image.
            await _pump(tester, key, vp, roles, _edge(family));
            final double height = tester
                .getSize(find.byType(ListView))
                .height
                .clamp(0, double.infinity)
                .toDouble();
            final double content = tester
                .getRect(
                  find.byWidgetPredicate(
                    (Widget w) =>
                        w is PrimerResultRowsSpecimen ||
                        w is PrimerStandingsRowsSpecimen ||
                        w is PrimerRaceRowsSpecimen,
                  ),
                )
                .bottom;
            await _pump(
              tester,
              key,
              _Vp(
                vp.name,
                Size(vp.size.width, content > height ? content : height),
                vp.scale,
                spanish: vp.spanish,
              ),
              roles,
              _edge(family),
            );
            final ui.Image image = await _image(tester, key);
            await _write(tester, image, 'edge-$family-${theme.key}-320-200');
            image.dispose();
          }
        }

        // 3. Focus: each case focused through the keyboard highlight mode.
        final List<(ui.Image, Rect)> crops = <(ui.Image, Rect)>[];
        for (final _FocusCase c in _focusCases) {
          await _pump(tester, key, vp, roles, _main(c.family, vp.spanish));
          final Finder target = find
              .descendant(
                of: find.byType(c.rowType).at(c.row),
                matching: find.byType(GvPrimerFocusTarget),
              )
              .at(c.target);
          final Finder detector = find
              .descendant(of: target, matching: find.byType(GestureDetector))
              .first;
          // Tab until the target holds focus: real keyboard traversal, which
          // also switches Flutter to the keyboard highlight mode.
          final FocusNode node = Focus.of(tester.element(detector));
          for (int i = 0; i < 60 && !node.hasPrimaryFocus; i++) {
            await tester.sendKeyEvent(LogicalKeyboardKey.tab);
            await tester.pump();
          }
          expect(node.hasPrimaryFocus, isTrue, reason: c.name);
          final GvPrimerFocusRingPainter painter = tester
              .widgetList<CustomPaint>(
                find.descendant(of: target, matching: find.byType(CustomPaint)),
              )
              .map((CustomPaint p) => p.foregroundPainter)
              .whereType<GvPrimerFocusRingPainter>()
              .first;
          expect(painter.visible, isTrue, reason: c.name);
          final Rect bounds = tester.getRect(
            find
                .descendant(
                  of: target,
                  matching: find.byType(GvPrimerFocusRing),
                )
                .first,
          );
          final ui.Image image = await _image(tester, key);
          late ByteData bytes;
          await tester.runAsync(() async {
            bytes = (await image.toByteData(
              format: ui.ImageByteFormat.rawRgba,
            ))!;
          });
          final RingVisibility v = probeRing(
            bytes: bytes,
            imageWidth: image.width,
            imageHeight: image.height,
            pixelRatio: _dpr,
            ringCentre: painter.geometry.ringPath(bounds),
            ring: painter.color,
          );
          final String hex = painter.color
              .toARGB32()
              .toRadixString(16)
              .padLeft(8, '0')
              .substring(2)
              .toUpperCase();
          report.writeln(
            '| ${theme.key} | ${vp.name} | ${c.name} | #$hex '
            '${painter.backing == null ? '' : '+ backing'}| '
            '${(v.fraction * 100).toStringAsFixed(1)}% | '
            '${v.minContrast.toStringAsFixed(2)} |',
          );
          final Rect crop = Rect.fromLTRB(
            0,
            (bounds.top - 8).clamp(0, vp.size.height) * _dpr,
            vp.size.width * _dpr,
            (bounds.bottom + 8).clamp(0, vp.size.height) * _dpr,
          );
          crops.add((image, crop));
        }
        final ui.Image focus = await _compose(
          tester,
          crops,
          const Color(0xFF7F7F7F),
          horizontal: false,
        );
        await _write(tester, focus, 'focus-${theme.key}-${vp.name}');
        focus.dispose();
        for (final (ui.Image image, Rect _) in crops) {
          image.dispose();
        }
      }
    }
    File('$_out/ring-visibility.md')
      ..createSync(recursive: true)
      ..writeAsStringSync(report.toString());
    await tester.binding.setSurfaceSize(null);
  });
}
