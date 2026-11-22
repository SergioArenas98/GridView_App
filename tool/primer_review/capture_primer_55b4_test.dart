// Step 55B.4 review captures (not goldens).
//
//   node tool/primer_review/capture_primer_55b4_refs.mjs   (Chrome references)
//   flutter test tool/primer_review/capture_primer_55b4_test.dart
//
// Output in build/primer-review/55b4/, every PNG at device pixel ratio 2 and
// never resized:
// - cmp-<family>-<theme>-<viewport>.png: the Chrome reference crop (left)
//   next to the same window of the Flutter component (right);
// - catalogue-<theme>-<viewport>.png: every Step 55B.4 specimen, full
//   content height at the viewport width (English 390 @100%, Spanish
//   320 @200%);
// - states-<theme>.png: the retry button and the link row focused through
//   the keyboard, and the link row pressed (390 @100%).
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
import 'package:gridview/features/dev/catalogue/primer_catalogue_shared.dart';

import '../../test/support/primer_fonts.dart';

const double _dpr = 2;
const String _out = 'build/primer-review/55b4';
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

const EdgeInsets _gutter = EdgeInsets.symmetric(
  horizontal: GvPrimerLayout.gutter,
);

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

/// Lays [crops] side by side or stacked on a grey ground; nothing scaled.
Future<ui.Image> _compose(
  WidgetTester tester,
  List<(ui.Image, Rect)> crops, {
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
    ..drawRect(
      Rect.fromLTWH(0, 0, w, h),
      Paint()..color = const Color(0xFF7F7F7F),
    );
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

/// The Flutter side of each comparison: the same content as the reference.
Widget _scene(String family, GvPrimerRoles roles, bool es) {
  switch (family) {
    case 'notice':
      return Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            // The Dark reference shows the N-2 notice above the partial one.
            if (roles.brightness == Brightness.dark) ...<Widget>[
              GvPrimerNotice(
                cause: GvPrimerNoticeCause.failure,
                message: es
                    ? 'No se pudo actualizar. Los datos guardados pueden '
                          'estar desactualizados.'
                    : "Couldn't refresh. Saved data may be out of date.",
              ),
              const SizedBox(height: 12),
            ],
            GvPrimerNotice(
              cause: GvPrimerNoticeCause.incomplete,
              message: es
                  ? 'Parte de la información del perfil no está disponible'
                  : 'Some profile information is unavailable',
            ),
          ],
        ),
      );
    case 'facts':
      return Padding(
        padding: _gutter,
        child: GvPrimerFactGrid(
          children: <Widget>[
            GvPrimerFact(
              label: es ? 'Fecha de nacimiento' : 'Date of birth',
              value: es ? '30 sept 1997' : 'Sep 30, 1997',
            ),
            GvPrimerFact(
              label: es ? 'Lugar de nacimiento' : 'Place of birth',
              value: 'Hasselt, Belgium',
            ),
            GvPrimerFact(
              label: es ? 'Dorsal permanente' : 'Permanent number',
              value: '33',
            ),
          ],
        ),
      );
    case 'strip':
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          // The reference crop starts 15px above the strip (its section
          // wrapper, measured in Chrome): screen placement, not component.
          const SizedBox(height: 15),
          Padding(
            padding: _gutter,
            child: GvPrimerStatStrip(
              stats: <GvPrimerStat>[
                GvPrimerStat(
                  label: es ? 'Posición' : 'Position',
                  value: '6',
                  kind: GvPrimerStatKind.lead,
                ),
                GvPrimerStat(label: es ? 'Puntos' : 'Points', value: '22'),
                GvPrimerStat(label: es ? 'Victorias' : 'Wins', value: '0'),
              ],
            ),
          ),
          const SizedBox(height: 16),
          GvPrimerLinkRow(
            label: es
                ? 'Ver clasificación de constructores'
                : "View constructors' standings",
            onActivate: () {},
          ),
        ],
      );
    default:
      return GvPrimerEmptyState(
        glyph: GvPrimerGlyph.alert,
        title: es ? 'Temporada no disponible' : 'Season unavailable',
        message: es
            ? 'GridView no ha podido determinar qué temporada mostrar. '
                  'Comprueba tu conexión e inténtalo de nuevo.'
            : 'GridView could not determine which season to show. Check '
                  'your connection and try again.',
        action: GvPrimerButton(
          label: es ? 'Reintentar' : 'Try again',
          onPressed: () {},
        ),
      );
  }
}

Future<void> _tabTo(WidgetTester tester, Finder target) async {
  final FocusNode node = Focus.of(
    tester.element(
      find.descendant(of: target, matching: find.byType(GestureDetector)).first,
    ),
  );
  for (int i = 0; i < 40 && !node.hasPrimaryFocus; i++) {
    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.pump();
  }
  expect(node.hasPrimaryFocus, isTrue);
}

void main() {
  testWidgets('Step 55B.4 review captures', (WidgetTester tester) async {
    await loadArchivo(tester);
    await _loadMaterialIcons(tester);
    final GlobalKey key = GlobalKey();
    for (final MapEntry<String, GvPrimerRoles> theme in _themes.entries) {
      final GvPrimerRoles roles = theme.value;
      for (final _Vp vp in <_Vp>[_en390, _es320]) {
        // 1. Chrome | Flutter comparisons.
        for (final String family in <String>[
          'notice',
          'facts',
          'strip',
          'empty',
        ]) {
          await _pump(
            tester,
            key,
            vp,
            roles,
            _scene(family, roles, vp.spanish),
          );
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
            final ui.Image cmp = await _compose(tester, <(ui.Image, Rect)>[
              (ref, window),
              (flutter, window),
            ], horizontal: true);
            await _write(tester, cmp, 'cmp-$family-${theme.key}-${vp.name}');
            cmp.dispose();
            ref.dispose();
          }
          flutter.dispose();
        }

        // 2. Every specimen, full content height at the viewport width.
        final Widget section = PrimerSharedComponentsSection(
          spanish: vp.spanish,
        );
        await _pump(tester, key, vp, roles, section);
        final double content = tester
            .getRect(find.byType(PrimerSharedComponentsSection))
            .bottom;
        await _pump(
          tester,
          key,
          _Vp(
            vp.name,
            Size(vp.size.width, content + 16),
            vp.scale,
            spanish: vp.spanish,
          ),
          roles,
          section,
        );
        final ui.Image all = await _image(tester, key);
        await _write(tester, all, 'catalogue-${theme.key}-${vp.name}');
        all.dispose();
      }

      // 3. Interaction states at 390 @100%.
      final List<(ui.Image, Rect)> crops = <(ui.Image, Rect)>[];
      Future<void> crop(Finder target) async {
        final Rect r = tester.getRect(target);
        crops.add((
          await _image(tester, key),
          Rect.fromLTRB(
            0,
            (r.top - 10).clamp(0, _en390.size.height) * _dpr,
            _en390.size.width * _dpr,
            (r.bottom + 10).clamp(0, _en390.size.height) * _dpr,
          ),
        ));
      }

      await _pump(tester, key, _en390, roles, _scene('empty', roles, false));
      final Finder button = find.byType(GvPrimerButton);
      await _tabTo(tester, button);
      await crop(button);
      await _pump(tester, key, _en390, roles, _scene('strip', roles, false));
      final Finder link = find.byType(GvPrimerLinkRow);
      await _tabTo(tester, link);
      await crop(link);
      await _pump(tester, key, _en390, roles, _scene('strip', roles, false));
      final TestGesture press = await tester.startGesture(
        tester.getCenter(link),
      );
      await tester.pump(kPressTimeout + const Duration(milliseconds: 10));
      await crop(link);
      await press.up();
      await tester.pump();
      final ui.Image states = await _compose(tester, crops, horizontal: false);
      await _write(tester, states, 'states-${theme.key}');
      states.dispose();
      for (final (ui.Image image, Rect _) in crops) {
        image.dispose();
      }
    }
    await tester.binding.setSurfaceSize(null);
  });
}
