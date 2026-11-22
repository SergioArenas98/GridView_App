// Step 55B.3.1 review capture: the Standings leader card at rest, hovered,
// pressed (mouse, while hovering) and focused + pressed (not goldens).
//
//   flutter test tool/primer_review/capture_primer_55b31_test.dart
//
// Output in build/primer-review/55b31/: leader-<theme>.png (left column EN
// 390×844 @100%, right column ES 320×693 @200%; rows: rest, hover, pressed,
// focused + pressed; DPR 2, never resized) and leader-states.md (sampled card
// pixels, state-to-state and text contrast, ring visibility). Rendered by the
// flutter_tester engine; not device validation.
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/theme/theme.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/dev/catalogue/primer_catalogue_rows.dart';

import '../../test/support/contrast.dart';
import '../../test/support/primer_fonts.dart';
import '../../test/support/ring_probe.dart';

const double _dpr = 2;
const String _out = 'build/primer-review/55b31';

class _Vp {
  const _Vp(this.name, this.size, this.scale, {required this.spanish});
  final String name;
  final Size size;
  final double scale;
  final bool spanish;
}

const List<_Vp> _viewports = <_Vp>[
  _Vp('390-100', Size(390, 844), 1, spanish: false),
  _Vp('320-200', Size(320, 693), 2, spanish: true),
];

const List<String> _states = <String>[
  'rest',
  'hover',
  'pressed',
  'focused + pressed',
];

Future<void> _pump(
  WidgetTester tester,
  GlobalKey key,
  _Vp vp,
  GvPrimerRoles roles,
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
                body: ListView(
                  children: <Widget>[
                    PrimerStandingsRowsSpecimen(
                      spanish: vp.spanish,
                      states: false,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pump();
}

Future<(ui.Image, ByteData)> _render(WidgetTester tester, GlobalKey key) async {
  late ui.Image image;
  late ByteData bytes;
  await tester.runAsync(() async {
    image =
        await (key.currentContext!.findRenderObject()! as RenderRepaintBoundary)
            .toImage(pixelRatio: _dpr);
    bytes = (await image.toByteData(format: ui.ImageByteFormat.rawRgba))!;
  });
  return (image, bytes);
}

Color _pixel(ByteData bytes, int width, Offset logical) {
  final int x = (logical.dx * _dpr).round();
  final int y = (logical.dy * _dpr).round();
  final int i = (y * width + x) * 4;
  return Color.fromARGB(
    255,
    bytes.getUint8(i),
    bytes.getUint8(i + 1),
    bytes.getUint8(i + 2),
  );
}

String _hex(Color c) =>
    '#${c.toARGB32().toRadixString(16).padLeft(8, '0').substring(2).toUpperCase()}';

void main() {
  testWidgets('Step 55B.3.1 leader-card states', (WidgetTester tester) async {
    await loadArchivo(tester);
    final GlobalKey key = GlobalKey();
    final StringBuffer md = StringBuffer()
      ..writeln('# Step 55B.3.1 leader-card states (flutter_tester, DPR 2)')
      ..writeln()
      ..writeln(
        'Card pixels sampled 6px inside the top edge and 5px inside the '
        'bottom edge, at the card centre line (padding only, no text). '
        'Not device validation.',
      )
      ..writeln()
      ..writeln(
        '| Theme | Viewport | State | Top | Bottom | vs rest (top / bottom) '
        '| Name vs top | Ring |',
      )
      ..writeln('|---|---|---|---|---|---|---|---|');

    for (final MapEntry<String, GvPrimerRoles> theme in <String, GvPrimerRoles>{
      'dark': GvPrimerRoles.dark,
      'light': GvPrimerRoles.light,
    }.entries) {
      final GvPrimerRoles roles = theme.value;
      final Color name = roles.forScope(GvPrimerScope.inverse).text.primary;
      final List<List<(ui.Image, Rect)>> columns = <List<(ui.Image, Rect)>>[];
      for (final _Vp vp in _viewports) {
        final List<(ui.Image, Rect)> column = <(ui.Image, Rect)>[];
        Color? restTop;
        Color? restBottom;
        Rect? restCard;
        for (final String state in _states) {
          await _pump(tester, key, vp, roles);
          final Finder card = find
              .descendant(
                of: find.byType(GvPrimerStandingsRow).first,
                matching: find.byType(GvPrimerFocusTarget),
              )
              .first;
          final Rect rect = tester.getRect(card);
          restCard ??= rect;
          expect(rect, restCard, reason: 'no layout change ($state)');
          TestGesture? mouse;
          if (state == 'focused + pressed') {
            final FocusNode node = Focus.of(
              tester.element(
                find
                    .descendant(
                      of: card,
                      matching: find.byType(GestureDetector),
                    )
                    .first,
              ),
            );
            for (int i = 0; i < 20 && !node.hasPrimaryFocus; i++) {
              await tester.sendKeyEvent(LogicalKeyboardKey.tab);
              await tester.pump();
            }
          }
          if (state != 'rest') {
            mouse = await tester.createGesture(kind: PointerDeviceKind.mouse);
            await mouse.addPointer(location: Offset.zero);
            await mouse.moveTo(rect.center);
            await tester.pump();
            if (state != 'hover') {
              await mouse.down(rect.center);
              await tester.pump(
                kPressTimeout + const Duration(milliseconds: 10),
              );
            }
          }
          final (ui.Image image, ByteData bytes) = await _render(tester, key);
          final Offset topPoint = Offset(rect.center.dx, rect.top + 6);
          final Offset bottomPoint = Offset(rect.center.dx, rect.bottom - 5);
          final Color top = _pixel(bytes, image.width, topPoint);
          final Color bottom = _pixel(bytes, image.width, bottomPoint);
          restTop ??= top;
          restBottom ??= bottom;
          final GvPrimerFocusRingPainter ring = tester
              .widgetList<CustomPaint>(
                find.descendant(of: card, matching: find.byType(CustomPaint)),
              )
              .map((CustomPaint p) => p.foregroundPainter)
              .whereType<GvPrimerFocusRingPainter>()
              .first;
          String ringCell = '—';
          if (ring.visible) {
            final RingVisibility v = probeRing(
              bytes: bytes,
              imageWidth: image.width,
              imageHeight: image.height,
              pixelRatio: _dpr,
              ringCentre: ring.geometry.ringPath(rect),
              ring: ring.color,
            );
            ringCell =
                '${(v.fraction * 100).toStringAsFixed(1)}%, '
                'min ${v.minContrast.toStringAsFixed(2)}';
          }
          md.writeln(
            '| ${theme.key} | ${vp.name} | $state | ${_hex(top)} | '
            '${_hex(bottom)} | ${contrastRatio(top, restTop).toStringAsFixed(3)}'
            ' / ${contrastRatio(bottom, restBottom).toStringAsFixed(3)} | '
            '${contrastRatio(name, top).toStringAsFixed(2)} | $ringCell |',
          );
          column.add((
            image,
            Rect.fromLTRB(
              0,
              (rect.top - 8) * _dpr,
              vp.size.width * _dpr,
              (rect.bottom + 10) * _dpr,
            ),
          ));
          if (mouse != null) {
            if (state != 'hover') await mouse.up();
            await mouse.removePointer();
            await tester.pump();
          }
        }
        columns.add(column);
      }

      // Compose: one column per viewport, states stacked, 24px gaps.
      const double gap = 24 * _dpr;
      double width = 0;
      double height = 0;
      for (final List<(ui.Image, Rect)> column in columns) {
        width += column.first.$2.width + (width == 0 ? 0 : gap);
        double h = 0;
        for (final (ui.Image _, Rect r) in column) {
          h += r.height + (h == 0 ? 0 : gap);
        }
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
        for (final (ui.Image image, Rect r) in column) {
          canvas.drawImageRect(image, r, Offset(x, y) & r.size, Paint());
          y += r.height + gap;
        }
        x += column.first.$2.width + gap;
      }
      late ui.Image out;
      await tester.runAsync(() async {
        out = await recorder.endRecording().toImage(
          width.round(),
          height.round(),
        );
        final ByteData png = (await out.toByteData(
          format: ui.ImageByteFormat.png,
        ))!;
        File('$_out/leader-${theme.key}.png')
          ..createSync(recursive: true)
          ..writeAsBytesSync(png.buffer.asUint8List());
      });
      out.dispose();
      for (final List<(ui.Image, Rect)> column in columns) {
        for (final (ui.Image image, Rect _) in column) {
          image.dispose();
        }
      }
    }
    File('$_out/leader-states.md')
      ..createSync(recursive: true)
      ..writeAsStringSync(md.toString());
    await tester.binding.setSurfaceSize(null);
  });
}
