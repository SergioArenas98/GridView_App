// Step 55C.15 review captures of the global surfaces: the Primer V2 bottom
// navigation in the app shell, the environment strip and badge, and the
// fixture-data banner (not goldens).
//
//   node tool/primer_review/capture_shell_55c15_refs.mjs   # Chrome refs first
//   flutter test tool/primer_review/capture_shell_55c15_test.dart
//
// Output goes to build/primer-review/55c15/. Every PNG is at device pixel
// ratio 2 and is never resized. Screens are the whole app surface at the
// stated viewport, through the real router, with Archivo and the Material
// icons loaded (real glyphs, unlike the goldens' test font):
// - shell-<screen>-<theme>-<lang>-<viewport>.png: a branch with its
//   destination selected; nested routes, the in-shell NotFound and a Grand
//   Prix above the shell;
// - focus-<dest>-<theme>-<lang>-<viewport>.png: keyboard focus on a
//   destination (reached with Tab);
// - env-<env>-<screen>-...png: the DEV / STAGING strip (status-bar inset 24);
// - banner-<screen>-...png: the fixture-data banner; combo-*: strip, banner
//   and navigation together;
// - cmp-<surface>-<theme>-<lang>-<viewport>.png: Chrome reference (left,
//   from capture_shell_55c15_refs.mjs) next to Flutter (right), same crop
//   rule;
// - before-after-*.png: the Step 55C.14 capture with the legacy pill (left)
//   next to the same state now (right);
// - metrics.md: measured geometry next to the Chrome reference metrics.
// Rendered by the flutter_tester engine; not device validation.
import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:gridview/app/environment/app_environment.dart';
import 'package:gridview/core/preferences/preference_values.dart';
import 'package:gridview/core/time/timezones.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/shared/presentation/widgets/environment_badge.dart';
import 'package:gridview/features/shared/presentation/widgets/mock_data_banner.dart';
import 'package:intl/date_symbol_data_local.dart';

import '../../test/support/primer_fonts.dart';
import '../../test/support/router_harness.dart';

const double _dpr = 2;
const String _out = 'build/primer-review/55c15';
const double _gap = 24;

class _Config {
  const _Config(this.theme, this.lang, this.width, this.height, this.scale);
  final AppThemePreference theme;
  final String lang;
  final double width;
  final double height;
  final double scale;

  String get viewport => height == 844 || height == 693
      ? '${width.toInt()}-${(scale * 100).toInt()}'
      : '${width.toInt()}x${height.toInt()}-${(scale * 100).toInt()}';
  String get name => '${theme.wire}-$lang-$viewport';
}

const AppThemePreference _d = AppThemePreference.dark;
const AppThemePreference _l = AppThemePreference.light;
const _Config _darkEn = _Config(_d, 'en', 390, 844, 1);
const _Config _lightEn = _Config(_l, 'en', 390, 844, 1);
const _Config _darkEs = _Config(_d, 'es', 390, 844, 1);
const _Config _darkEs320 = _Config(_d, 'es', 320, 693, 2);
const _Config _lightEs320 = _Config(_l, 'es', 320, 693, 2);
const _Config _darkEn320 = _Config(_d, 'en', 320, 693, 2);
const _Config _darkEsShort = _Config(_d, 'es', 320, 480, 2);

const EdgeInsets _statusBar = EdgeInsets.only(top: 24);

final StringBuffer _metrics = StringBuffer();
final StringBuffer _exceptions = StringBuffer();

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

Future<GoRouter> _pump(
  WidgetTester tester,
  _Config config,
  String location, {
  String? pushFrom,
  AppEnvironment environment = AppEnvironment.development,
  bool badge = false,
  bool mockData = false,
  String? focusDestination,
  EdgeInsets? padding,
}) async {
  FocusManager.instance.highlightStrategy = FocusHighlightStrategy.automatic;
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.pump();
  final GoRouter router = await pumpApp(
    tester,
    initialLocation: pushFrom ?? location,
    surfaceSize: Size(config.width, config.height),
    locale: Locale(config.lang),
    textScale: config.scale,
    disableAnimations: true,
    environment: environment,
    environmentBadge: badge,
    mockData: mockData,
    padding: padding ?? (badge ? _statusBar : EdgeInsets.zero),
    preferences: AppPreferences.defaults.copyWith(theme: config.theme),
  );
  if (pushFrom != null) unawaited(router.push(location));
  await tester.pumpAndSettle();
  if (focusDestination != null) {
    FocusManager.instance.highlightStrategy =
        FocusHighlightStrategy.alwaysTraditional;
    final GvPrimerBottomNav nav = tester.widget(find.byType(GvPrimerBottomNav));
    final int index = nav.items.indexWhere(
      (GvPrimerNavItem i) => i.label == focusDestination,
    );
    // Focus the previous destination, then Tab, as a keyboard user would.
    _focusOf(tester, nav.items[index - 1].label).requestFocus();
    await tester.pump();
    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.pumpAndSettle();
  }
  // Recorded, not fatal: an overflow is review evidence, and the capture
  // shows it (the debug stripes).
  final Object? error = tester.takeException();
  if (error != null) {
    _exceptions.writeln(
      '- `${config.name}` `$location`'
      '${badge ? ' (${environment.label} strip)' : ''}'
      '${mockData ? ' (fixture banner)' : ''}: '
      '${error.toString().split('\n').first}',
    );
  }
  return router;
}

FocusNode _focusOf(WidgetTester tester, String label) => Focus.of(
  tester.element(
    find
        .descendant(
          of: find.ancestor(
            of: find.descendant(
              of: find.byType(GvPrimerBottomNav),
              matching: find.text(label),
            ),
            matching: find.byType(GvPrimerFocusTarget),
          ),
          matching: find.byType(GestureDetector),
        )
        .first,
  ),
);

/// The whole surface, environment strip included: the root view's layer.
/// The strip sits above the navigator, outside every route's repaint
/// boundary, so a boundary capture would miss it.
Future<ui.Image> _surface(WidgetTester tester) async {
  final RenderView view = tester.binding.renderViews.first;
  final double viewRatio = tester.view.devicePixelRatio;
  final OffsetLayer layer = view.debugLayer! as OffsetLayer;
  final Size logical = view.size;
  late ui.Image full;
  await tester.runAsync(() async {
    // The view layer already scales by the view's pixel ratio.
    full = await layer.toImage(
      Offset.zero & (logical * viewRatio),
      pixelRatio: _dpr / viewRatio,
    );
  });
  return full;
}

Future<ui.Image> _capture(
  WidgetTester tester,
  _Config config, [
  Rect? logical,
]) async {
  final ui.Image full = await _surface(tester);
  final Rect r = logical ?? Rect.fromLTWH(0, 0, config.width, config.height);
  return _compose(tester, <(ui.Image, Rect)>[
    (
      full,
      Rect.fromLTRB(
        r.left * _dpr,
        r.top * _dpr,
        r.right * _dpr,
        r.bottom * _dpr,
      ),
    ),
  ]);
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

Future<ui.Image?> _readPng(WidgetTester tester, String path) async {
  final File file = File(path);
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

Future<ui.Image> _compose(
  WidgetTester tester,
  List<(ui.Image, Rect)> crops,
) async {
  const double gap = _gap * _dpr;
  double w = 0;
  double h = 0;
  for (final (ui.Image _, Rect r) in crops) {
    w += r.width + (w == 0 ? 0 : gap);
    h = h < r.height ? r.height : h;
  }
  final ui.PictureRecorder recorder = ui.PictureRecorder();
  final Canvas canvas = Canvas(recorder)
    ..drawRect(
      Rect.fromLTWH(0, 0, w, h),
      Paint()..color = const Color(0xFF7F7F7F),
    );
  double at = 0;
  for (final (ui.Image image, Rect r) in crops) {
    canvas.drawImageRect(image, r, Offset(at, 0) & r.size, Paint());
    at += r.width + gap;
  }
  late ui.Image out;
  await tester.runAsync(() async {
    out = await recorder.endRecording().toImage(w.round(), h.round());
  });
  return out;
}

Rect _whole(ui.Image image) =>
    Rect.fromLTWH(0, 0, image.width.toDouble(), image.height.toDouble());

Future<void> _screen(
  WidgetTester tester,
  String name,
  _Config config,
  String location, {
  String? pushFrom,
  AppEnvironment environment = AppEnvironment.development,
  bool badge = false,
  bool mockData = false,
  String? focus,
}) async {
  await _pump(
    tester,
    config,
    location,
    pushFrom: pushFrom,
    environment: environment,
    badge: badge,
    mockData: mockData,
    focusDestination: focus,
  );
  await _write(tester, await _capture(tester, config), '$name-${config.name}');
}

/// Chrome reference (left) next to the Flutter crop (right).
Future<void> _cmp(
  WidgetTester tester,
  String surface,
  _Config config,
  Rect flutterCrop,
) async {
  final ui.Image flutter = await _capture(tester, config, flutterCrop);
  final ui.Image? ref = await _readPng(
    tester,
    '$_out/ref-$surface-${config.name}.png',
  );
  await _write(
    tester,
    await _compose(tester, <(ui.Image, Rect)>[
      if (ref != null) (ref, _whole(ref)),
      (flutter, _whole(flutter)),
    ]),
    'cmp-$surface-${config.name}',
  );
}

/// Scrolls the visible page to its end: the outer page scroll when the
/// header is not pinned, and the list.
Future<void> _scrollPageToEnd(WidgetTester tester) async {
  for (int i = 0; i < 4; i++) {
    for (final ScrollableState s in tester.stateList<ScrollableState>(
      find.descendant(
        of: find.byType(Scaffold).first,
        matching: find.byType(Scrollable),
      ),
    )) {
      if (s.position.axis == Axis.vertical) {
        s.position.jumpTo(s.position.maxScrollExtent);
      }
    }
    await tester.pumpAndSettle();
  }
}

String _r(Rect r) =>
    '${r.left.toStringAsFixed(1)},${r.top.toStringAsFixed(1)} '
    '${r.width.toStringAsFixed(1)}×${r.height.toStringAsFixed(1)}';

void _navMetrics(WidgetTester tester, _Config config) {
  final Rect nav = tester.getRect(find.byType(GvPrimerBottomNav));
  final GvPrimerBottomNav bar = tester.widget(find.byType(GvPrimerBottomNav));
  final List<String> tabs = <String>[
    for (final GvPrimerNavItem i in bar.items)
      _r(
        tester.getRect(
          find.ancestor(
            of: find.descendant(
              of: find.byType(GvPrimerBottomNav),
              matching: find.text(i.label),
            ),
            matching: find.byType(GvPrimerFocusTarget),
          ),
        ),
      ),
  ];
  final Text label = tester.widget<Text>(
    find.descendant(
      of: find.byType(GvPrimerBottomNav),
      matching: find.text(bar.items.first.label),
    ),
  );
  _metrics.writeln(
    '| nav | ${config.name} | ${nav.height.toStringAsFixed(1)} | '
    '${label.style!.fontSize} × ${config.scale} | ${tabs.join('<br>')} |',
  );
}

void main() {
  setUpAll(() async {
    ensureTimeZonesInitialized();
    await initializeDateFormatting('en');
    await initializeDateFormatting('es');
    _metrics
      ..writeln('# Step 55C.15 measured geometry (flutter_tester, Archivo)')
      ..writeln()
      ..writeln('Logical px. Chrome reference metrics: `ref-metrics.json`.')
      ..writeln()
      ..writeln('| Surface | Config | Height | Font | Detail |')
      ..writeln('|---|---|---|---|---|');
  });

  tearDownAll(() {
    final File refs = File('$_out/ref-metrics.json');
    if (refs.existsSync()) {
      final Map<String, dynamic> json =
          jsonDecode(refs.readAsStringSync()) as Map<String, dynamic>;
      _metrics
        ..writeln()
        ..writeln('## Chrome reference heights')
        ..writeln()
        ..writeln('| Reference | Height | Font | Fit |')
        ..writeln('|---|---|---|---|');
      for (final MapEntry<String, dynamic> e in json.entries) {
        final Map<String, dynamic> m = e.value as Map<String, dynamic>;
        final Map<String, dynamic> inner = m['inner'] as Map<String, dynamic>;
        _metrics.writeln(
          '| ${e.key} | ${(inner['h'] as num).toStringAsFixed(1)} | '
          '${m['fontSize']} / ${m['fontWeight']} | ${m['fit'] ?? ''} |',
        );
      }
    }
    _metrics
      ..writeln()
      ..writeln('## Exceptions while capturing')
      ..writeln()
      ..write(_exceptions.isEmpty ? 'None.\n' : _exceptions.toString());
    File('$_out/metrics.md')
      ..createSync(recursive: true)
      ..writeAsStringSync(_metrics.toString());
  });

  tearDown(() {
    FocusManager.instance.highlightStrategy = FocusHighlightStrategy.automatic;
  });

  testWidgets('shell screens', (WidgetTester tester) async {
    await loadArchivo(tester);
    await _loadMaterialIcons(tester);
    for (final _Config c in <_Config>[_darkEn, _lightEn, _darkEn320]) {
      await _screen(tester, 'shell-home', c, '/');
      _navMetrics(tester, c);
    }
    await _screen(tester, 'shell-calendar', _darkEn, '/calendar');
    await _screen(tester, 'shell-calendar', _lightEs320, '/calendar');
    await _screen(tester, 'shell-standings', _lightEn, '/standings');
    for (final _Config c in <_Config>[_darkEs320, _lightEs320, _darkEsShort]) {
      await _screen(tester, 'shell-standings', c, '/standings');
      _navMetrics(tester, c);
    }
    await _screen(tester, 'shell-explore', _darkEs, '/explore');
    await _screen(tester, 'shell-explore', _darkEs320, '/explore');
  });

  testWidgets('focus, nested routes and NotFound', (WidgetTester tester) async {
    await loadArchivo(tester);
    await _loadMaterialIcons(tester);
    for (final _Config c in <_Config>[_darkEn, _lightEn]) {
      await _screen(tester, 'focus-calendar', c, '/', focus: 'Calendar');
    }
    await _screen(
      tester,
      'focus-explorar',
      _lightEs320,
      '/',
      focus: 'Explorar',
    );
    await _screen(
      tester,
      'shell-nested-constructors-2025',
      _darkEn,
      '/standings/constructors/2025',
    );
    await _screen(
      tester,
      'shell-nested-explore-teams',
      _lightEn,
      '/explore/teams',
    );
    await _screen(
      tester,
      'above-shell-grand-prix',
      _darkEn,
      '/calendar/2026/13',
      pushFrom: '/calendar',
    );
    for (final _Config c in <_Config>[_darkEn, _lightEs320]) {
      await _screen(
        tester,
        'shell-notfound-standings',
        c,
        '/standings/drivers/abc',
      );
    }
  });

  testWidgets('environment strip and fixture banner', (
    WidgetTester tester,
  ) async {
    await loadArchivo(tester);
    await _loadMaterialIcons(tester);
    for (final _Config c in <_Config>[_darkEn, _lightEn]) {
      await _screen(tester, 'env-dev-home', c, '/', badge: true);
      _metrics.writeln(
        '| strip | ${c.name} inset 24 | '
        '${tester.getSize(find.byKey(const ValueKey<String>('environment-badge-strip'))).height.toStringAsFixed(1)} | '
        '13 × ${c.scale} | badge ${_r(tester.getRect(find.byType(GvEnvironmentBadge)))} |',
      );
    }
    for (final _Config c in <_Config>[_darkEs320, _lightEs320]) {
      await _screen(
        tester,
        'env-staging-standings',
        c,
        '/standings',
        badge: true,
        environment: AppEnvironment.staging,
      );
      _metrics.writeln(
        '| strip | ${c.name} inset 24 | '
        '${tester.getSize(find.byKey(const ValueKey<String>('environment-badge-strip'))).height.toStringAsFixed(1)} | '
        '13 × ${c.scale} | badge ${_r(tester.getRect(find.byType(GvEnvironmentBadge)))} |',
      );
    }
    await _screen(
      tester,
      'env-staging-grand-prix',
      _darkEn,
      '/calendar/2026/13',
      pushFrom: '/calendar',
      badge: true,
      environment: AppEnvironment.staging,
    );
    for (final _Config c in <_Config>[_darkEn, _lightEn, _darkEs320]) {
      await _screen(tester, 'banner-home', c, '/', mockData: true);
      _metrics.writeln(
        '| banner | ${c.name} | '
        '${tester.getSize(find.byType(MockDataBanner)).height.toStringAsFixed(1)} | '
        '14 × ${c.scale} | ${_r(tester.getRect(find.byType(MockDataBanner)))} |',
      );
    }
    await _screen(
      tester,
      'banner-calendar',
      _lightEn,
      '/calendar',
      mockData: true,
    );
    for (final _Config c in <_Config>[_darkEs320, _lightEs320]) {
      await _screen(
        tester,
        'combo-staging-banner-calendar',
        c,
        '/calendar',
        badge: true,
        environment: AppEnvironment.staging,
        mockData: true,
      );
    }
    // The configuration that overflowed in Step 55C.15 (Step 55C.15R fix):
    // opening, then scrolled to the end (the header has scrolled away).
    const _Config lightEsShort = _Config(_l, 'es', 320, 480, 2);
    for (final _Config c in <_Config>[_darkEsShort, lightEsShort]) {
      for (final String location in <String>['/standings', '/explore']) {
        final String screen = location.substring(1);
        await _screen(
          tester,
          'combo-staging-banner-$screen',
          c,
          location,
          badge: true,
          environment: AppEnvironment.staging,
          mockData: true,
        );
        // Step 55C.15F: the banner sits in the scrolling status block, below
        // the visible area on opening at this size; this frame scrolls to it.
        await tester.ensureVisible(find.byType(MockDataBanner));
        await tester.pumpAndSettle();
        await _write(
          tester,
          await _capture(tester, c),
          'combo-staging-banner-$screen-at-banner-${c.name}',
        );
        await _scrollPageToEnd(tester);
        await _write(
          tester,
          await _capture(tester, c),
          'combo-staging-banner-$screen-scrolled-${c.name}',
        );
      }
    }
  });

  testWidgets('large-text lists (Step 55C.15R)', (WidgetTester tester) async {
    await loadArchivo(tester);
    await _loadMaterialIcons(tester);
    for (final _Config c in <_Config>[_darkEs320, _lightEs320]) {
      await _screen(tester, 'shell-explore', c, '/explore');
      await _screen(tester, 'shell-explore-circuits', c, '/explore/circuits');
      await _scrollPageToEnd(tester);
      await _write(
        tester,
        await _capture(tester, c),
        'shell-explore-circuits-end-${c.name}',
      );
      await _screen(tester, 'shell-standings', c, '/standings');
    }
    await _screen(tester, 'shell-standings', _darkEn320, '/standings');
  });

  testWidgets('NF-02 recovery sequence', (WidgetTester tester) async {
    await loadArchivo(tester);
    await _loadMaterialIcons(tester);
    for (final _Config c in <_Config>[_darkEn, _lightEs320]) {
      await _pump(tester, c, '/standings/drivers/abc');
      final ui.Image invalid = await _capture(tester, c);
      await tester.tap(find.byKey(const ValueKey<String>('not-found-home')));
      await tester.pumpAndSettle();
      final ui.Image home = await _capture(tester, c);
      final GvPrimerBottomNav bar = tester.widget(
        find.byType(GvPrimerBottomNav),
      );
      await tester.tap(
        find.descendant(
          of: find.byType(GvPrimerBottomNav),
          matching: find.text(bar.items[2].label),
        ),
      );
      await tester.pumpAndSettle();
      final ui.Image standings = await _capture(tester, c);
      await _write(
        tester,
        await _compose(tester, <(ui.Image, Rect)>[
          (invalid, _whole(invalid)),
          (home, _whole(home)),
          (standings, _whole(standings)),
        ]),
        'nf02-sequence-${c.name}',
      );
    }
  });

  testWidgets('Chrome references next to Flutter', (WidgetTester tester) async {
    await loadArchivo(tester);
    await _loadMaterialIcons(tester);
    const List<_Config> configs = <_Config>[
      _darkEn,
      _Config(_d, 'en', 320, 693, 2),
      _Config(_d, 'es', 390, 844, 1),
      _darkEs320,
      _lightEn,
      _Config(_l, 'en', 320, 693, 2),
      _Config(_l, 'es', 390, 844, 1),
      _lightEs320,
    ];
    for (final _Config c in configs) {
      // Navigation: the bar plus 8px above, over Home (Home selected).
      await _pump(tester, c, '/');
      final Rect nav = tester.getRect(find.byType(GvPrimerBottomNav));
      await _cmp(
        tester,
        'nav',
        c,
        Rect.fromLTRB(0, nav.top - 8, c.width, c.height),
      );

      // Strip: Settings root as in the reference (no status-bar inset, so
      // the badge sits 6px from the top), strip plus 24px below.
      await _pump(
        tester,
        c,
        '/settings',
        pushFrom: '/',
        badge: true,
        padding: EdgeInsets.zero,
      );
      final Rect strip = tester.getRect(
        find.byKey(const ValueKey<String>('environment-badge-strip')),
      );
      await _cmp(
        tester,
        'envstrip',
        c,
        Rect.fromLTRB(0, strip.top, c.width, strip.bottom + 24),
      );

      // Banner: Grand Prix detail as the reference, page-notice padding.
      await _pump(
        tester,
        c,
        '/calendar/2026/13',
        pushFrom: '/calendar',
        mockData: true,
      );
      final Rect banner = tester.getRect(find.byType(MockDataBanner));
      await _cmp(
        tester,
        'banner',
        c,
        Rect.fromLTRB(0, banner.top - 12, c.width, banner.bottom),
      );
    }
  });

  testWidgets('before and after', (WidgetTester tester) async {
    await loadArchivo(tester);
    await _loadMaterialIcons(tester);
    for (final _Config c in <_Config>[_darkEn, _lightEs320]) {
      final String name = 'nf-standings-shell-${c.name}';
      final ui.Image? before = await _readPng(
        tester,
        'build/primer-review/55c14/$name.png',
      );
      await _pump(tester, c, '/standings/drivers/abc');
      final ui.Image after = await _capture(tester, c);
      await _write(
        tester,
        await _compose(tester, <(ui.Image, Rect)>[
          if (before != null) (before, _whole(before)),
          (after, _whole(after)),
        ]),
        'before-after-$name',
      );
    }
  });
}
