// Step 55B.4.1 review captures of the refined specimens only (not goldens).
//
//   node tool/primer_review/capture_primer_55b41_refs.mjs   (Chrome references)
//   flutter test tool/primer_review/capture_primer_55b41_test.dart
//
// Output in build/primer-review/55b41/, every PNG at device pixel ratio 2 and
// never resized:
// - cmp-strip-<team|driver>-<theme>-<viewport>.png: the Chrome crop of the
//   strip element alone (left) next to the Flutter strip with its style
//   (right);
// - button-<theme>.png: the retry button at rest, hovered, pressed (mouse,
//   while hovering) and focused + pressed; left column English 390 @100%,
//   right column Spanish 320 @200%.
// Rendered by the flutter_tester engine; not device validation.
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/theme/theme.dart';
import 'package:gridview/core/widgets/widgets.dart';

import '../../test/support/primer_fonts.dart';

const double _dpr = 2;
const String _out = 'build/primer-review/55b41';
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

/// Lays columns of crops side by side (each column stacked), on grey.
Future<ui.Image> _grid(
  WidgetTester tester,
  List<List<(ui.Image, Rect)>> columns,
) async {
  const double gap = _gap * _dpr;
  double width = 0;
  double height = 0;
  for (final List<(ui.Image, Rect)> column in columns) {
    double w = 0;
    double h = 0;
    for (final (ui.Image _, Rect r) in column) {
      w = w < r.width ? r.width : w;
      h += r.height + (h == 0 ? 0 : gap);
    }
    width += w + (width == 0 ? 0 : gap);
    height = height < h ? h : height;
  }
  final ui.PictureRecorder recorder = ui.PictureRecorder();
  final Canvas canvas = Canvas(recorder)
    ..drawRect(
      Rect.fromLTWH(0, 0, width, height),
      Paint()..color = const Color(0xFF7F7F7F),
    );
  double x = 0;
  for (final List<(ui.Image, Rect)> column in columns) {
    double y = 0;
    double w = 0;
    for (final (ui.Image image, Rect r) in column) {
      canvas.drawImageRect(image, r, Offset(x, y) & r.size, Paint());
      y += r.height + gap;
      w = w < r.width ? r.width : w;
    }
    x += w + gap;
  }
  late ui.Image out;
  await tester.runAsync(() async {
    out = await recorder.endRecording().toImage(width.round(), height.round());
  });
  return out;
}

Widget _strip(String family, bool es) => Padding(
  padding: const EdgeInsets.symmetric(horizontal: GvPrimerLayout.gutter),
  child: family == 'strip-team'
      ? GvPrimerStatStrip(
          stats: <GvPrimerStat>[
            GvPrimerStat(
              label: es ? 'Posición' : 'Position',
              value: '6',
              kind: GvPrimerStatKind.lead,
            ),
            GvPrimerStat(label: es ? 'Puntos' : 'Points', value: '22'),
            GvPrimerStat(label: es ? 'Victorias' : 'Wins', value: '0'),
          ],
        )
      : GvPrimerStatStrip(
          style: GvPrimerStatStripStyle.driver,
          stats: <GvPrimerStat>[
            GvPrimerStat(
              label: es ? 'Posición' : 'Position',
              value: '2',
              kind: GvPrimerStatKind.lead,
            ),
            GvPrimerStat(
              label: es ? 'Puntos' : 'Points',
              value: es ? '402,5' : '402.5',
            ),
          ],
        ),
);

void main() {
  testWidgets('Step 55B.4.1 review captures', (WidgetTester tester) async {
    await loadArchivo(tester);
    final GlobalKey key = GlobalKey();
    for (final MapEntry<String, GvPrimerRoles> theme in _themes.entries) {
      final GvPrimerRoles roles = theme.value;
      final List<List<(ui.Image, Rect)>> buttonColumns =
          <List<(ui.Image, Rect)>>[];
      for (final _Vp vp in <_Vp>[_en390, _es320]) {
        // 1. Strips beside the Chrome crop of the strip element alone.
        for (final String family in <String>['strip-team', 'strip-driver']) {
          await _pump(tester, key, vp, roles, _strip(family, vp.spanish));
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
            final ui.Image cmp = await _grid(tester, <List<(ui.Image, Rect)>>[
              <(ui.Image, Rect)>[(ref, window)],
              <(ui.Image, Rect)>[(flutter, window)],
            ]);
            await _write(tester, cmp, 'cmp-$family-${theme.key}-${vp.name}');
            cmp.dispose();
            ref.dispose();
          }
          flutter.dispose();
        }

        // 2. Button states.
        final List<(ui.Image, Rect)> column = <(ui.Image, Rect)>[];
        for (final String state in <String>[
          'rest',
          'hover',
          'pressed',
          'focused + pressed',
        ]) {
          await _pump(
            tester,
            key,
            vp,
            roles,
            Padding(
              padding: const EdgeInsets.all(GvPrimerLayout.gutter),
              child: Align(
                alignment: Alignment.centerLeft,
                child: GvPrimerButton(
                  label: vp.spanish ? 'Reintentar' : 'Try again',
                  onPressed: () {},
                  hover: true,
                ),
              ),
            ),
          );
          final Finder button = find.byType(GvPrimerButton);
          if (state == 'focused + pressed') {
            await tester.sendKeyEvent(LogicalKeyboardKey.tab);
            await tester.pump();
          }
          TestGesture? mouse;
          if (state != 'rest') {
            mouse = await tester.createGesture(kind: PointerDeviceKind.mouse);
            await mouse.addPointer(location: tester.getCenter(button));
            await tester.pump();
            if (state != 'hover') {
              await mouse.down(tester.getCenter(button));
              await tester.pump(
                kPressTimeout + const Duration(milliseconds: 10),
              );
            }
          }
          final Rect r = tester.getRect(button);
          column.add((
            await _image(tester, key),
            Rect.fromLTRB(
              0,
              (r.top - 8) * _dpr,
              vp.size.width * _dpr,
              (r.bottom + 8) * _dpr,
            ),
          ));
          if (mouse != null) {
            if (state != 'hover') await mouse.up();
            await mouse.removePointer();
            await tester.pump();
          }
        }
        buttonColumns.add(column);
      }
      final ui.Image buttons = await _grid(tester, buttonColumns);
      await _write(tester, buttons, 'button-${theme.key}');
      buttons.dispose();
      for (final List<(ui.Image, Rect)> column in buttonColumns) {
        for (final (ui.Image image, Rect _) in column) {
          image.dispose();
        }
      }
    }
    await tester.binding.setSurfaceSize(null);
  });
}
