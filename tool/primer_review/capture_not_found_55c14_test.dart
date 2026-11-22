// Step 55C.14 review captures of the production NotFoundScreen (not
// goldens).
//
//   flutter test tool/primer_review/capture_not_found_55c14_test.dart
//
// Output goes to build/primer-review/55c14/. Every PNG is at device pixel
// ratio 2 and is never resized. Each capture is the whole app surface at the
// stated viewport, through the real router: the bottom navigation appears
// only where the router puts the screen inside the shell.
//
// No NotFound prototype exists (owner decision D1), so there is **no Chrome
// reference** and no pixel comparison. The comparison is with the approved
// Grand Prix Detail page-state precedent (Step 55C.12), rendered here from
// the same development fixtures as its own tests:
// - nf-<case>-<theme>-<lang>-<viewport>.png: one NotFound state;
// - nf-focus-home-<theme>-en-390-100.png: keyboard focus on "Go to Home";
// - nf-back-absent-vs-present-<theme>-en-390-100.png: an invalid driver deep
//   link (nothing to pop, left) next to an invalid Grand Prix deep link
//   (Calendar below, right);
// - cmp-precedent-<theme>-en-390-100.png: Grand Prix Detail "Grand Prix not
//   found" (left, approved) next to NotFound unknown route (right).
// Rendered by the flutter_tester engine; not device validation.
import 'dart:async';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/preferences/preference_values.dart';
import 'package:gridview/core/time/timezones.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/shared/domain/refresh_result.dart';
import 'package:intl/date_symbol_data_local.dart';

import '../../test/support/domain_fixtures.dart';
import '../../test/support/fake_repository.dart';
import '../../test/support/primer_fonts.dart';
import '../../test/support/router_harness.dart';

const double _dpr = 2;
const String _out = 'build/primer-review/55c14';
const double _gap = 24;

class _Config {
  const _Config(this.theme, this.lang, this.width, this.height, this.scale);
  final AppThemePreference theme;
  final String lang;
  final double width;
  final double height;
  final double scale;

  String get viewport => '${width.toInt()}-${(scale * 100).toInt()}';
  String get name => '${theme.wire}-$lang-$viewport';
}

const AppThemePreference _d = AppThemePreference.dark;
const AppThemePreference _l = AppThemePreference.light;
const _Config _darkEn = _Config(_d, 'en', 390, 844, 1);
const _Config _lightEn = _Config(_l, 'en', 390, 844, 1);
const _Config _darkEs320 = _Config(_d, 'es', 320, 693, 2);
const _Config _lightEs320 = _Config(_l, 'es', 320, 693, 2);

const String _unknown = '/totally/unknown';
const String _invalidDriver = '/drivers/BAD_ID';
const String _invalidGrandPrix = '/calendar/notyear/3';
const String _invalidStandings = '/standings/drivers/abc';

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

/// Opens [location] directly, or pushes it above Home when [push] is set.
Future<GoRouter> _pump(
  WidgetTester tester,
  _Config config,
  String location, {
  bool push = false,
  bool focusHome = false,
}) async {
  FocusManager.instance.highlightStrategy = focusHome
      ? FocusHighlightStrategy.alwaysTraditional
      : FocusHighlightStrategy.automatic;
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.pump();
  final GoRouter router = await pumpApp(
    tester,
    initialLocation: push ? '/' : location,
    surfaceSize: Size(config.width, config.height),
    locale: Locale(config.lang),
    textScale: config.scale,
    disableAnimations: true,
    preferences: AppPreferences.defaults.copyWith(theme: config.theme),
    repository: FakeRaceWeekendRepository(
      home: homeViewFixture(),
      calendar: (int season) => calendarFixture(season: season),
      grandPrix: (int s, int r) => null,
      onRefreshGrandPrix: (int s, int r) async =>
          const RefreshFailure(ApiFailure(kind: ApiFailureKind.notFound)),
    ),
  );
  if (push) unawaited(router.push(location));
  await tester.pumpAndSettle();
  if (focusHome) {
    final Finder target = find.descendant(
      of: find.byKey(const ValueKey<String>('not-found-home')),
      matching: find.byType(GvPrimerFocusTarget),
    );
    Focus.of(
      tester.element(
        find
            .descendant(of: target, matching: find.byType(GestureDetector))
            .first,
      ),
    ).requestFocus();
    await tester.pumpAndSettle();
  }
  expect(tester.takeException(), isNull);
  return router;
}

/// The whole surface: the outermost repaint boundary below the view.
Future<ui.Image> _capture(WidgetTester tester, _Config config) async {
  RenderObject? node = tester.renderObject(find.byType(MaterialApp));
  RenderRepaintBoundary? outer;
  while (node != null) {
    if (node is RenderRepaintBoundary) outer = node;
    node = node.parent;
  }
  final RenderRepaintBoundary boundary =
      outer ??
      tester.renderObject<RenderRepaintBoundary>(
        find.byType(RepaintBoundary).first,
      );
  late ui.Image full;
  await tester.runAsync(() async {
    full = await boundary.toImage(pixelRatio: _dpr);
  });
  final Rect crop = Rect.fromLTWH(
    0,
    0,
    config.width * _dpr,
    config.height * _dpr,
  );
  return _compose(tester, <(ui.Image, Rect)>[(full, crop)]);
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

Future<void> _single(
  WidgetTester tester,
  String name,
  _Config config,
  String location, {
  bool push = false,
  bool focusHome = false,
}) async {
  await _pump(tester, config, location, push: push, focusHome: focusHome);
  await _write(tester, await _capture(tester, config), '$name-${config.name}');
}

Future<void> _pair(
  WidgetTester tester,
  String name,
  _Config config,
  (String, bool) left,
  (String, bool) right,
) async {
  await _pump(tester, config, left.$1, push: left.$2);
  final ui.Image a = await _capture(tester, config);
  await _pump(tester, config, right.$1, push: right.$2);
  final ui.Image b = await _capture(tester, config);
  await _write(
    tester,
    await _compose(tester, <(ui.Image, Rect)>[(a, _whole(a)), (b, _whole(b))]),
    '$name-${config.name}',
  );
}

void main() {
  setUpAll(() async {
    ensureTimeZonesInitialized();
    await initializeDateFormatting('en');
    await initializeDateFormatting('es');
  });

  tearDown(() {
    FocusManager.instance.highlightStrategy = FocusHighlightStrategy.automatic;
  });

  testWidgets('NotFound states', (WidgetTester tester) async {
    await loadArchivo(tester);
    await _loadMaterialIcons(tester);
    for (final _Config c in <_Config>[_darkEn, _lightEn, _darkEs320]) {
      await _single(tester, 'nf-unknown', c, _unknown);
    }
    for (final _Config c in <_Config>[_darkEn, _lightEn, _lightEs320]) {
      await _single(tester, 'nf-invalid', c, _invalidDriver);
    }
    for (final _Config c in <_Config>[_darkEn, _lightEs320]) {
      await _single(tester, 'nf-standings-shell', c, _invalidStandings);
    }
    for (final _Config c in <_Config>[_darkEn, _lightEn]) {
      await _single(tester, 'nf-focus-home', c, _unknown, focusHome: true);
    }
  });

  testWidgets('Back absent versus present', (WidgetTester tester) async {
    await loadArchivo(tester);
    await _loadMaterialIcons(tester);
    for (final _Config c in <_Config>[_darkEn, _lightEn]) {
      await _pair(
        tester,
        'nf-back-absent-vs-present',
        c,
        (_invalidDriver, false),
        (_invalidGrandPrix, false),
      );
    }
  });

  testWidgets('Grand Prix Detail precedent', (WidgetTester tester) async {
    await loadArchivo(tester);
    await _loadMaterialIcons(tester);
    for (final _Config c in <_Config>[_darkEn, _lightEn]) {
      // Both pushed above Home, so both show Back as the precedent does.
      await _pair(
        tester,
        'cmp-precedent',
        c,
        ('/calendar/2026/13', true),
        (_unknown, true),
      );
    }
  });
}
