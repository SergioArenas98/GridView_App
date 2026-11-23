// Step 55B.2 review captures: focused viewport screenshots, not goldens.
//
// Run explicitly (not part of `flutter test`, which only runs test/):
//
//   flutter test tool/primer_review/capture_primer_viewports_test.dart
//
// Output: build/primer-review/55b2/*.png, rendered at device pixel ratio 2
// (390x844 -> 780x1688, 320x693 -> 640x1386) and never resized. The
// flutter_tester engine renders with the bundled Archivo and the SDK's
// Material Icons; this is a review aid, not device validation.
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/theme/theme.dart';
import 'package:gridview/features/dev/catalogue/primer_catalogue_geometry.dart';

import '../../test/support/primer_fonts.dart';

const double _pixelRatio = 2;

class _Viewport {
  const _Viewport(this.name, this.size, this.textScale, {this.spanish = false});
  final String name;
  final Size size;
  final double textScale;
  final bool spanish;
}

const _Viewport _en390 = _Viewport('390-100', Size(390, 844), 1);
const _Viewport _es320 = _Viewport('320-200', Size(320, 693), 2, spanish: true);

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

Future<void> _pumpScene(
  WidgetTester tester,
  _Viewport vp,
  GvPrimerRoles roles,
  GlobalKey key,
  Widget Function(BuildContext) body, {
  Widget? bottomNavigationBar,
  double bottomInset = 0,
}) async {
  await tester.binding.setSurfaceSize(vp.size);
  tester.view.devicePixelRatio = 1;
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
              textScaler: TextScaler.linear(vp.textScale),
              padding: EdgeInsets.only(bottom: bottomInset),
              viewPadding: EdgeInsets.only(bottom: bottomInset),
              disableAnimations: true,
            ),
            child: GvPrimerSurface(
              kind: GvPrimerSurfaceKind.page,
              roles: roles,
              child: Scaffold(
                backgroundColor: roles.surface.page,
                body: SafeArea(bottom: false, child: Builder(builder: body)),
                bottomNavigationBar: bottomNavigationBar,
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

Future<void> _tab(WidgetTester tester, int times) async {
  for (int i = 0; i < times; i++) {
    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
  }
  await tester.pump();
}

Future<void> _save(WidgetTester tester, GlobalKey key, String name) async {
  await tester.runAsync(() async {
    final RenderRepaintBoundary boundary =
        key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
    final ui.Image image = await boundary.toImage(pixelRatio: _pixelRatio);
    final ByteData png = (await image.toByteData(
      format: ui.ImageByteFormat.png,
    ))!;
    File('build/primer-review/55b2/$name.png')
      ..createSync(recursive: true)
      ..writeAsBytesSync(png.buffer.asUint8List());
    image.dispose();
  });
}

Widget _caption(BuildContext context, String text) {
  final GvPrimerSurfaceData s = GvPrimerSurface.of(context);
  return Padding(
    padding: const EdgeInsets.only(top: 12, bottom: 6),
    child: Text(
      text,
      style: GvPrimerTypography.archivo(
        size: 13,
        weight: 700,
      ).copyWith(color: s.roles.text.accent),
    ),
  );
}

Widget _selectorScene(BuildContext context, _Viewport vp) {
  final List<String> two = vp.spanish
      ? <String>['Pilotos', 'Constructores']
      : <String>['Drivers', 'Constructors'];
  final List<String> three = vp.spanish
      ? <String>['Pilotos', 'Equipos', 'Circuitos']
      : <String>['Drivers', 'Teams', 'Circuits'];
  return ListView(
    padding: const EdgeInsets.all(16),
    children: <Widget>[
      _caption(context, 'Focus (Tab): selected, then unselected'),
      PrimerSelectorSpecimen(segments: two),
      _caption(context, 'At rest: Standings, Explore'),
      ExcludeFocus(
        child: PrimerSelectorSpecimen(segments: two, initialIndex: 1),
      ),
      const SizedBox(height: 8),
      ExcludeFocus(
        child: PrimerSelectorSpecimen(
          segments: three,
          initialIndex: 1,
          optionPadding: 10,
        ),
      ),
      _caption(context, '12° cut'),
      const PrimerCutSpecimens(),
    ],
  );
}

Widget _navBody(BuildContext context) {
  final GvPrimerRoles r = GvPrimerSurface.of(context).roles;
  return ListView.builder(
    itemCount: 24,
    itemBuilder: (BuildContext context, int i) => Container(
      height: 56,
      margin: const EdgeInsets.only(bottom: 1),
      color: r.surface.band,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      alignment: Alignment.centerLeft,
      child: Text(
        'Row ${i + 1}',
        style: GvPrimerTypography.body.copyWith(color: r.text.secondary),
      ),
    ),
  );
}

List<String> _navLabels(_Viewport vp) => vp.spanish
    ? const <String>['Inicio', 'Calendario', 'Clasificaciones', 'Explorar']
    : const <String>['Home', 'Calendar', 'Standings', 'Explore'];

Widget _iconScene(BuildContext context) {
  return ListView(
    padding: const EdgeInsets.all(16),
    children: <Widget>[
      _caption(context, 'Status icons'),
      const PrimerStatusIconSpecimens(),
      _caption(context, 'Icon fidelity: Material (left) vs prototype (right)'),
      const _FidelityGrid(),
    ],
  );
}

/// Material placeholders next to the prototype's stroke icons, drawn from
/// their SVG coordinates (24 viewBox). Review-only drawing, not shipped.
class _FidelityGrid extends StatelessWidget {
  const _FidelityGrid();

  @override
  Widget build(BuildContext context) {
    final GvPrimerSurfaceData s = GvPrimerSurface.of(context);
    Widget pair(
      String name,
      IconData material,
      _Proto proto,
      double size,
      double stroke,
    ) => Padding(
      padding: const EdgeInsets.only(right: 14, bottom: 10),
      child: Column(
        children: <Widget>[
          Row(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Icon(material, size: size, color: s.foreground),
              const SizedBox(width: 8),
              CustomPaint(
                size: Size.square(size),
                painter: _ProtoIconPainter(proto, s.foreground, stroke),
              ),
            ],
          ),
          Text(
            name,
            style: GvPrimerTypography.archivo(
              size: 13,
              weight: 600,
            ).copyWith(color: s.roles.text.secondary),
          ),
        ],
      ),
    );
    return Wrap(
      children: <Widget>[
        pair('check 14', Icons.check_rounded, _Proto.check, 14, 2.25),
        pair('ban 14', Icons.block, _Proto.ban, 14, 2.25),
        pair('pause 14', Icons.pause_circle_outline, _Proto.pause, 14, 2.25),
        pair('home', Icons.home_outlined, _Proto.home, 24, 1.75),
        pair(
          'calendar',
          Icons.calendar_month_outlined,
          _Proto.calendar,
          24,
          1.75,
        ),
        pair(
          'standings',
          Icons.emoji_events_outlined,
          _Proto.standings,
          24,
          1.75,
        ),
        pair('explore', Icons.explore_outlined, _Proto.explore, 24, 1.75),
      ],
    );
  }
}

enum _Proto { check, ban, pause, home, calendar, standings, explore }

class _ProtoIconPainter extends CustomPainter {
  _ProtoIconPainter(this.icon, this.color, this.stroke);
  final _Proto icon;
  final Color color;

  /// Stroke width in the 24 viewBox (CSS `stroke-width`).
  final double stroke;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 24);
    final Paint p = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    void line(double x1, double y1, double x2, double y2) =>
        canvas.drawLine(Offset(x1, y1), Offset(x2, y2), p);
    switch (icon) {
      case _Proto.check:
        canvas.drawPath(
          Path()
            ..moveTo(20, 6)
            ..lineTo(9, 17)
            ..lineTo(4, 12),
          p,
        );
      case _Proto.ban:
        canvas.drawCircle(const Offset(12, 12), 10, p);
        line(4.9, 4.9, 19.1, 19.1);
      case _Proto.pause:
        canvas.drawCircle(const Offset(12, 12), 10, p);
        line(10, 15, 10, 9);
        line(14, 15, 14, 9);
      case _Proto.home:
        // Approximation of the Lucide house (corner arcs omitted).
        canvas.drawPath(
          Path()
            ..moveTo(3, 10)
            ..lineTo(12, 2.6)
            ..lineTo(21, 10)
            ..lineTo(21, 21)
            ..lineTo(3, 21)
            ..close(),
          p,
        );
        canvas.drawPath(
          Path()
            ..moveTo(9, 21)
            ..lineTo(9, 12)
            ..lineTo(15, 12)
            ..lineTo(15, 21),
          p,
        );
      case _Proto.calendar:
        canvas.drawRRect(
          RRect.fromLTRBR(3, 4, 21, 22, const Radius.circular(2)),
          p,
        );
        line(16, 2, 16, 6);
        line(8, 2, 8, 6);
        line(3, 10, 21, 10);
      case _Proto.standings:
        line(18, 20, 18, 10);
        line(12, 20, 12, 4);
        line(6, 20, 6, 14);
      case _Proto.explore:
        canvas.drawCircle(const Offset(12, 12), 10, p);
        canvas.drawPath(
          Path()
            ..moveTo(16.24, 7.76)
            ..lineTo(14.12, 14.12)
            ..lineTo(7.76, 16.24)
            ..lineTo(9.88, 9.88)
            ..close(),
          p,
        );
    }
  }

  @override
  bool shouldRepaint(_ProtoIconPainter old) => false;
}

void main() {
  setUp(
    () => FocusManager.instance.highlightStrategy =
        FocusHighlightStrategy.alwaysTraditional,
  );
  tearDown(
    () => FocusManager.instance.highlightStrategy =
        FocusHighlightStrategy.automatic,
  );

  testWidgets('capture Step 55B.2 review viewports', (
    WidgetTester tester,
  ) async {
    await loadArchivo(tester);
    await _loadMaterialIcons(tester);
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final GlobalKey key = GlobalKey();

    for (final GvPrimerRoles roles in <GvPrimerRoles>[
      GvPrimerRoles.dark,
      GvPrimerRoles.light,
    ]) {
      final String t = roles.brightness.name;

      // Segmented control and 12° cut.
      await _pumpScene(
        tester,
        _en390,
        roles,
        key,
        (BuildContext c) => _selectorScene(c, _en390),
      );
      await _tab(tester, 1);
      await _save(tester, key, 'seg-$t-390-100-selected-focus');
      await _tab(tester, 1);
      await _save(tester, key, 'seg-$t-390-100-unselected-focus');
      await _pumpScene(
        tester,
        _es320,
        roles,
        key,
        (BuildContext c) => _selectorScene(c, _es320),
      );
      await _tab(tester, 2);
      await _save(tester, key, 'seg-$t-320-200-unselected-focus');

      // Bottom navigation with a 24dp gesture inset; focus on "Calendar".
      for (final _Viewport vp in <_Viewport>[_en390, _es320]) {
        await _pumpScene(
          tester,
          vp,
          roles,
          key,
          _navBody,
          bottomNavigationBar: PrimerNavSpecimen(labels: _navLabels(vp)),
          bottomInset: 24,
        );
        await _tab(tester, 2);
        await _save(tester, key, 'nav-$t-${vp.name}-inset24-focus');
      }

      // Icon scaling and fidelity.
      for (final _Viewport vp in <_Viewport>[_en390, _es320]) {
        await _pumpScene(tester, vp, roles, key, _iconScene);
        await _save(tester, key, 'icons-$t-${vp.name}');
      }
    }

    // XS-31 illustration: no bottom inset, focused tab ring meets the edge.
    await _pumpScene(
      tester,
      _en390,
      GvPrimerRoles.dark,
      key,
      _navBody,
      bottomNavigationBar: const PrimerNavSpecimen(),
    );
    await _tab(tester, 2);
    await _save(tester, key, 'nav-dark-390-100-inset0-focus');
  });
}
