// Step 55B.2.1 review captures and ring measurements (not goldens).
//
//   flutter test tool/primer_review/capture_primer_55b21_test.dart
//
// Output in build/primer-review/55b21/: PNGs at device pixel ratio 2, never
// resized, and ring-visibility.md (every theme × viewport × inset × tab, for
// the superseded outward ring and the inward navigation ring). Rendered by
// the flutter_tester engine; not device validation.
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/theme/theme.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/dev/catalogue/primer_catalogue_geometry.dart';

import '../../test/support/primer_fonts.dart';
import '../../test/support/ring_probe.dart';

const double _dpr = 2;
const String _out = 'build/primer-review/55b21';

class _Vp {
  const _Vp(this.name, this.size, this.scale, this.labels);
  final String name;
  final Size size;
  final double scale;
  final List<String> labels;
}

const _Vp _en390 = _Vp('390-100', Size(390, 844), 1, <String>[
  'Home',
  'Calendar',
  'Standings',
  'Explore',
]);
const _Vp _es320 = _Vp('320-200', Size(320, 693), 2, <String>[
  'Inicio',
  'Calendario',
  'Clasificaciones',
  'Explorar',
]);

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
  Widget body, {
  Widget? nav,
  double inset = 0,
}) async {
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
              padding: EdgeInsets.only(bottom: inset),
              viewPadding: EdgeInsets.only(bottom: inset),
              disableAnimations: true,
            ),
            child: GvPrimerSurface(
              kind: GvPrimerSurfaceKind.page,
              roles: roles,
              child: Scaffold(
                backgroundColor: roles.surface.page,
                body: SafeArea(bottom: false, child: body),
                bottomNavigationBar: nav,
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

Future<void> _save(WidgetTester tester, GlobalKey key, String name) async {
  final ui.Image image = await _image(tester, key);
  await tester.runAsync(() async {
    final ByteData png = (await image.toByteData(
      format: ui.ImageByteFormat.png,
    ))!;
    File('$_out/$name.png')
      ..createSync(recursive: true)
      ..writeAsBytesSync(png.buffer.asUint8List());
  });
  image.dispose();
}

Widget _rows(GvPrimerRoles r) => ListView.builder(
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

Widget _nav(_Vp vp, GvPrimerFocusGeometry geometry) => GvPrimerBottomNav(
  items: PrimerNavSpecimen.itemsFor(vp.labels),
  selectedIndex: 0,
  onSelect: (_) {},
  // A review tool measuring the superseded ring against the approved one.
  // ignore: invalid_use_of_visible_for_testing_member
  focusGeometry: geometry,
);

Future<void> _focusTab(WidgetTester tester, int index) async {
  for (int i = 0; i <= index; i++) {
    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
  }
  await tester.pump();
}

Widget _iconScene(GvPrimerRoles r) {
  TextStyle caption() => GvPrimerTypography.archivo(
    size: 13,
    weight: 700,
  ).copyWith(color: r.text.accent);
  TextStyle small() => GvPrimerTypography.archivo(
    size: 13,
    weight: 600,
  ).copyWith(color: r.text.secondary);
  Widget pair(String name, Widget before, Widget after) => Padding(
    padding: const EdgeInsets.only(right: 20, bottom: 12),
    child: Column(
      children: <Widget>[
        Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[before, const SizedBox(width: 16), after],
        ),
        const SizedBox(height: 4),
        Text(name, style: small()),
      ],
    ),
  );
  return ListView(
    padding: const EdgeInsets.all(16),
    children: <Widget>[
      Text('Status icons (14px at 100%, 18px at 200%)', style: caption()),
      const SizedBox(height: 8),
      const PrimerStatusIconSpecimens(),
      const SizedBox(height: 20),
      Text('Before (Material) → after (Primer glyph), 48px', style: caption()),
      const SizedBox(height: 8),
      Wrap(
        children: <Widget>[
          pair(
            'Cancelled',
            Icon(Icons.block, size: 48, color: r.text.primary),
            GvPrimerIcon(
              GvPrimerGlyph.ban,
              size: 48,
              color: r.text.primary,
              strokeWidth: GvPrimerIconStroke.small,
            ),
          ),
          pair(
            'Standings',
            Icon(Icons.emoji_events_outlined, size: 48, color: r.text.primary),
            GvPrimerIcon(
              GvPrimerGlyph.standings,
              size: 48,
              color: r.text.primary,
            ),
          ),
        ],
      ),
    ],
  );
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

  testWidgets('Step 55B.2.1 captures and ring measurements', (
    WidgetTester tester,
  ) async {
    await loadArchivo(tester);
    await _loadMaterialIcons(tester);
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final GlobalKey key = GlobalKey();
    final StringBuffer table = StringBuffer()
      ..writeln('# Navigation focus-ring visibility (Step 55B.2.1)')
      ..writeln()
      ..writeln(
        'Measured on 2x flutter_tester renders: share of the ring centre line on screen in the ring colour, and the lowest contrast against the on-screen pixels just outside and inside the ring.',
      )
      ..writeln()
      ..writeln(
        '| Theme | Viewport | Inset | Tab | Before (+3 outside) | After (−2 inside) |',
      )
      ..writeln('|---|---|---|---|---|---|');

    for (final GvPrimerRoles roles in <GvPrimerRoles>[
      GvPrimerRoles.dark,
      GvPrimerRoles.light,
    ]) {
      final String t = roles.brightness.name;
      final Color ring = roles.nav.focus;

      // Measurements.
      for (final _Vp vp in <_Vp>[_en390, _es320]) {
        for (final double inset in <double>[0, 8, 24]) {
          for (int tab = 0; tab < 4; tab++) {
            final List<String> cells = <String>[];
            for (final GvPrimerFocusGeometry g in <GvPrimerFocusGeometry>[
              GvPrimerFocusGeometry.standard,
              GvPrimerFocusGeometry.navTab,
            ]) {
              await _pump(
                tester,
                key,
                vp,
                roles,
                _rows(roles),
                nav: _nav(vp, g),
                inset: inset,
              );
              await _focusTab(tester, tab);
              final Rect rect = tester.getRect(
                find.ancestor(
                  of: find.text(vp.labels[tab]),
                  matching: find.byType(GvPrimerFocusTarget),
                ),
              );
              final ui.Image image = await _image(tester, key);
              late RingVisibility v;
              await tester.runAsync(() async {
                final ByteData bytes = (await image.toByteData())!;
                v = probeRing(
                  bytes: bytes,
                  imageWidth: image.width,
                  imageHeight: image.height,
                  pixelRatio: _dpr,
                  ringCentre: g.ringPath(rect),
                  ring: ring,
                );
              });
              image.dispose();
              cells.add(
                '${(v.fraction * 100).toStringAsFixed(1)}%, min ${v.minContrast.toStringAsFixed(2)}',
              );
            }
            table.writeln(
              '| $t | ${vp.name} | ${inset.round()} | ${vp.labels[tab]} | ${cells[0]} | ${cells[1]} |',
            );
          }
        }
      }

      // Screenshots: focus on the last destination (bottom-right corner).
      await _pump(
        tester,
        key,
        _en390,
        roles,
        _rows(roles),
        nav: _nav(_en390, GvPrimerFocusGeometry.standard),
      );
      await _focusTab(tester, 3);
      await _save(tester, key, 'nav-$t-390-100-inset0-focus-last-before');
      await _pump(
        tester,
        key,
        _en390,
        roles,
        _rows(roles),
        nav: _nav(_en390, GvPrimerFocusGeometry.navTab),
      );
      await _focusTab(tester, 3);
      await _save(tester, key, 'nav-$t-390-100-inset0-focus-last-after');
      await _pump(
        tester,
        key,
        _en390,
        roles,
        _rows(roles),
        nav: _nav(_en390, GvPrimerFocusGeometry.navTab),
        inset: 24,
      );
      await _focusTab(tester, 3);
      await _save(tester, key, 'nav-$t-390-100-inset24-focus-last');
      await _pump(
        tester,
        key,
        _es320,
        roles,
        _rows(roles),
        nav: _nav(_es320, GvPrimerFocusGeometry.navTab),
        inset: 24,
      );
      await _focusTab(tester, 3);
      await _save(tester, key, 'nav-$t-320-200-inset24-stacked-focus-last');
      for (final _Vp vp in <_Vp>[_en390, _es320]) {
        await _pump(tester, key, vp, roles, _iconScene(roles));
        await _save(tester, key, 'icons-$t-${vp.name}');
      }
    }

    // Heights.
    table
      ..writeln()
      ..writeln('## Navigation height (content + system inset)')
      ..writeln()
      ..writeln('| Layout | Inset | Content | Total |')
      ..writeln('|---|---|---|---|');
    for (final (_Vp vp, String layout) in <(_Vp, String)>[
      (_en390, 'one row, 390 @100%'),
      (_es320, '2 × 2, 320 @200%'),
    ]) {
      for (final double inset in <double>[0, 24]) {
        await _pump(
          tester,
          key,
          vp,
          GvPrimerRoles.dark,
          _rows(GvPrimerRoles.dark),
          nav: _nav(vp, GvPrimerFocusGeometry.navTab),
          inset: inset,
        );
        final double total = tester
            .getSize(find.byType(GvPrimerBottomNav))
            .height;
        table.writeln(
          '| $layout | ${inset.round()} | ${(total - inset).toStringAsFixed(1)} | ${total.toStringAsFixed(1)} |',
        );
      }
    }
    File('$_out/ring-visibility.md')
      ..createSync(recursive: true)
      ..writeAsStringSync(table.toString());
  });
}
