// Step 55C.2.2 review captures: the Calendar notice-plus-jump presentation
// (review evidence, not goldens).
//
//   flutter test tool/primer_review/capture_calendar_55c22_test.dart
//
// Output in build/primer-review/55c22/, every PNG at device pixel ratio 2 and
// never resized: the whole device viewport (status-bar-free test surface),
// including the pinned header and the legacy bottom navigation, so nothing
// hidden behind the navigation can pass unnoticed.
// - jump-n2-<theme>-<lang>-<viewport>.png: the notice-first opening with the
//   combined N-2 notice (refresh failure over stale data, both known before
//   the Calendar's first render) and the "Go to next Grand Prix" action;
// - jump-after-<theme>-<lang>-<viewport>.png: the same screen after the
//   action was activated (the next race at the normal opening's position);
// - jump-overview-<lang>-<viewport>.png: Dark and Light side by side, opening
//   then after activation;
// - jump-verification.txt: the measured checks behind every capture.
// Configurations: Dark/Light × EN 390×844 @100% and ES 320×693 @200%.
//
// Data: the deterministic synthetic 23-round season of
// test/screens/calendar_jump_action_test.dart, replicated here ("Round N Grand
// Prix", "Circuit N", "Town N", "Country N"; round 18 next). No real or
// private season data. Rendered by the flutter_tester engine with the bundled
// Archivo and Material icon fonts; not device validation.
import 'dart:io';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/preferences/preference_values.dart';
import 'package:gridview/core/theme/theme.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/calendar/presentation/calendar_screen.dart';
import 'package:gridview/features/calendar/presentation/widgets/calendar_header.dart';
import 'package:gridview/features/calendar/presentation/widgets/calendar_status_block.dart';
import 'package:gridview/features/shared/domain/entities/calendar_entry.dart';
import 'package:gridview/features/shared/domain/entities/circuit.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/sync/application/sync_providers.dart';
import 'package:gridview/features/sync/domain/app_sync_state.dart';
import 'package:gridview/features/sync/domain/sync_plan.dart';

import '../../test/support/domain_fixtures.dart';
import '../../test/support/fake_repository.dart';
import '../../test/support/primer_fonts.dart';
import '../../test/support/router_harness.dart';

const double _dpr = 2;
const String _out = 'build/primer-review/55c22';
const int _next = 18;

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

const List<_Config> _configs = <_Config>[
  _Config(AppThemePreference.dark, 'en', 390, 844, 1),
  _Config(AppThemePreference.light, 'en', 390, 844, 1),
  _Config(AppThemePreference.dark, 'es', 320, 693, 2),
  _Config(AppThemePreference.light, 'es', 320, 693, 2),
];

// --- The synthetic season (as in calendar_jump_action_test.dart) -----------

String _date(DateTime d) =>
    '${d.year}-${d.month.toString().padLeft(2, '0')}-'
    '${d.day.toString().padLeft(2, '0')}';

DateTime _start(int round) =>
    DateTime.utc(2026, 3, 6).add(Duration(days: 14 * (round - 1)));

List<CalendarEntry> _season() => <CalendarEntry>[
  for (int round = 1; round <= 23; round++)
    calendarEntry(
      round: round,
      name: 'Round $round Grand Prix',
      startDate: _date(_start(round)),
      endDate: _date(_start(round).add(const Duration(days: 2))),
      status: round < _next ? EventStatus.completed : EventStatus.scheduled,
      format: round % 4 == 2 ? WeekendFormat.sprint : WeekendFormat.standard,
      circuit: Circuit(
        id: 'circuit-$round',
        name: 'Circuit $round',
        locality: 'Town $round',
        country: 'Country $round',
      ),
    ),
];

final DateTime _clock = _start(
  _next,
).subtract(const Duration(days: 3)).add(const Duration(hours: 12));

// --- Rendering ---------------------------------------------------------------

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

/// Opens Calendar for the first time after the refresh failure is known, over
/// stale data: the combined N-2 notice at the first useful render.
Future<GoRouter> _openN2(WidgetTester tester, _Config c) async {
  final GoRouter router = await pumpApp(
    tester,
    initialLocation: '/',
    surfaceSize: Size(c.width, c.height),
    locale: Locale(c.lang),
    textScale: c.scale,
    disableAnimations: true,
    clock: _clock,
    preferences: AppPreferences.defaults.copyWith(theme: c.theme),
    syncMetadata: (String key) =>
        syncedMetadata(key, staleAfter: DateTime.utc(2000)),
    repository: FakeRaceWeekendRepository(
      home: homeViewFixture(),
      dashboard: homeDashboardFixture(),
      calendar: (int season) => _season(),
      grandPrix: (int season, int round) =>
          grandPrixDetailFixture(season, round),
    ),
  );
  containerOf(tester)
      .read(appSyncStateProvider.notifier)
      .publish(
        const AppSyncCompleted(
          trigger: SyncTrigger.manual,
          outcomes: <ResourceSyncOutcome>[
            ResourceSyncOutcome(
              resourceKey: 'calendar:2026',
              kind: ResourceSyncOutcomeKind.failed,
              failure: ApiFailureKind.networkUnavailable,
            ),
          ],
        ),
      );
  await tester.pumpAndSettle();
  router.go('/calendar');
  await tester.pumpAndSettle();
  expect(tester.takeException(), isNull);
  return router;
}

/// The whole viewport: the outermost repaint boundary above the Calendar that
/// covers the full surface (header, list and the shell's navigation).
Future<ui.Image> _captureViewport(WidgetTester tester, _Config c) async {
  RenderRepaintBoundary? best;
  RenderObject? node = tester.renderObject(find.byType(CalendarScreen));
  while (node != null) {
    if (node is RenderRepaintBoundary &&
        node.size.width >= c.width - 0.5 &&
        node.size.height >= c.height - 0.5) {
      best = node;
    }
    node = node.parent;
  }
  late ui.Image image;
  await tester.runAsync(() async {
    image = await best!.toImage(pixelRatio: _dpr);
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

Future<ui.Image> _sideBySide(WidgetTester tester, List<ui.Image> images) async {
  const double gap = 24 * _dpr;
  final double w =
      images.fold<double>(0, (double s, ui.Image i) => s + i.width) +
      gap * (images.length - 1);
  final double h = images.map((ui.Image i) => i.height).reduce(math.max) * 1.0;
  final ui.PictureRecorder recorder = ui.PictureRecorder();
  final Canvas canvas = Canvas(recorder)
    ..drawRect(
      Rect.fromLTWH(0, 0, w, h),
      Paint()..color = const Color(0xFF7F7F7F),
    );
  double at = 0;
  for (final ui.Image i in images) {
    canvas.drawImage(i, Offset(at, 0), Paint());
    at += i.width + gap;
  }
  late ui.Image out;
  await tester.runAsync(() async {
    out = await recorder.endRecording().toImage(w.round(), h.round());
  });
  return out;
}

// --- Verification --------------------------------------------------------------

Finder get _list => find
    .descendant(
      of: find.byType(CalendarScreen),
      matching: find.byType(Scrollable),
    )
    .first;

final Finder _action = find.byKey(const ValueKey<String>('calendar-jump'));

/// List content can be seen only here: the list's viewport, below the pinned
/// header and above the legacy bottom navigation.
Rect _visibleArea(WidgetTester tester) {
  final Rect list = tester.getRect(_list);
  final Rect header = tester.getRect(find.byType(CalendarHeader));
  final Rect nav = tester.getRect(find.byType(GvPrimerBottomNav));
  return Rect.fromLTRB(
    list.left,
    math.max(list.top, header.bottom),
    list.right,
    math.min(list.bottom, nav.top),
  );
}

bool _inside(Rect r, Rect area) =>
    r.top >= area.top - 0.5 && r.bottom <= area.bottom + 0.5;

String _r(Rect r) =>
    '${r.left.toStringAsFixed(0)},${r.top.toStringAsFixed(0)}–'
    '${r.right.toStringAsFixed(0)},${r.bottom.toStringAsFixed(0)}';

final StringBuffer _report = StringBuffer();

void _check(String name, bool ok, String detail) {
  _report.writeln('${ok ? 'PASS' : 'FAIL'}  $name  $detail');
  expect(ok, isTrue, reason: '$name: $detail');
}

/// The notice-first checks: notice and action fully visible below the header
/// and above the navigation; the action's appearance; its words and arrow
/// unclipped.
void _verifyOpening(WidgetTester tester, _Config c) {
  final Rect area = _visibleArea(tester);
  final Rect header = tester.getRect(find.byType(CalendarHeader));
  final Rect nav = tester.getRect(find.byType(GvPrimerBottomNav));
  final Rect notice = tester.getRect(find.byType(GvPrimerNotice));
  final Rect action = tester.getRect(_action);
  final GvPrimerNotice n = tester.widget(find.byType(GvPrimerNotice));
  final CalendarJumpAction a = tester.widget(_action);
  _check(
    '${c.name} opening',
    n.cause == GvPrimerNoticeCause.failure &&
        find.byType(GvPrimerNotice).evaluate().length == 1 &&
        find.byType(CalendarJumpAction).evaluate().length == 1,
    'one N-2 notice ("${n.message}") and one action ("${a.label}")',
  );
  _check(
    '${c.name} notice visible',
    _inside(notice, area) && notice.top >= header.bottom,
    'notice ${_r(notice)} in visible area ${_r(area)}',
  );
  _check(
    '${c.name} action visible',
    _inside(action, area) && action.bottom <= nav.top,
    'action ${_r(action)}; header bottom ${header.bottom.toStringAsFixed(0)}, '
        'navigation top ${nav.top.toStringAsFixed(0)}',
  );
  _check(
    '${c.name} action target',
    action.height >= 48 && action.width >= 48,
    '${action.width.toStringAsFixed(0)}×${action.height.toStringAsFixed(0)} dp',
  );

  // Appearance: primary text colour, weight 700, the arrow glyph after it.
  final Text label = tester.widget<Text>(
    find.descendant(of: _action, matching: find.byType(Text)),
  );
  final Color primary = GvPrimerSurface.of(
    tester.element(_action),
  ).roles.text.primary;
  final Finder arrow = find.descendant(
    of: _action,
    matching: find.byType(GvPrimerIcon),
  );
  final Rect arrowRect = tester.getRect(arrow);
  final Rect textRect = tester.getRect(
    find.descendant(of: _action, matching: find.byType(Text)),
  );
  _check(
    '${c.name} action appearance',
    label.style?.color == primary &&
        label.style?.fontWeight == FontWeight.w700 &&
        tester.widget<GvPrimerIcon>(arrow).color == primary &&
        arrowRect.left >= textRect.right - 0.5 &&
        _inside(arrowRect, area),
    'text.primary ${primary.toARGB32().toRadixString(16)}, weight 700, '
        'arrow ${_r(arrowRect)} after the words ${_r(textRect)}',
  );

  // Words and arrow readable: nothing clipped or truncated.
  final RenderParagraph p = tester.renderObject<RenderParagraph>(
    find.descendant(of: _action, matching: find.byType(RichText)),
  );
  final double lines =
      p.getMaxIntrinsicHeight(p.size.width) /
      p.textScaler.scale(p.text.style?.fontSize ?? 15) /
      (p.text.style?.height ?? 1.3);
  _check(
    '${c.name} label readable',
    !p.didExceedMaxLines &&
        p.size.height >= p.getMaxIntrinsicHeight(p.size.width) - 0.5 &&
        p.size.width >= p.getMinIntrinsicWidth(double.infinity) - 0.5 &&
        arrowRect.width >= 24 &&
        arrowRect.right <= action.right + 0.5,
    'label ${p.size.width.toStringAsFixed(0)}×'
        '${p.size.height.toStringAsFixed(0)} '
        '(about ${lines.round()} line(s) at the scaled size), '
        'arrow ${arrowRect.width.toStringAsFixed(0)} dp',
  );
}

/// After activation: the next round where the opening without a notice
/// places it (0.15 of the free viewport height below the top, or its top at
/// the top when the row is taller than the viewport), not behind the
/// navigation, and no Grand Prix opened.
void _verifyAfter(WidgetTester tester, _Config c, GoRouter router) {
  final Rect area = _visibleArea(tester);
  final ScrollPosition position = tester.state<ScrollableState>(_list).position;
  final Finder row = find.byKey(
    const ValueKey<String>('calendar-event-$_next'),
  );
  final Rect r = tester.getRect(row);
  final double viewport = position.viewportDimension;
  final Rect list = tester.getRect(_list);
  final double expectedTop = r.height > viewport
      ? list.top
      : list.top + 0.15 * (viewport - r.height);
  final bool highlighted = tester
      .widget<GvPrimerRaceRow>(
        find.descendant(of: row, matching: find.byType(GvPrimerRaceRow)),
      )
      .highlighted;
  _check(
    '${c.name} after activation',
    highlighted &&
        (r.top - expectedTop).abs() <= 0.5 &&
        r.top >= area.top - 0.5 &&
        r.top < area.bottom &&
        router.routeInformationProvider.value.uri.path == '/calendar',
    'round $_next ${_r(r)} (height ${r.height.toStringAsFixed(0)}, viewport '
        '${viewport.toStringAsFixed(0)}): top '
        '${r.top.toStringAsFixed(1)}, expected '
        '${expectedTop.toStringAsFixed(1)}; offset '
        '${position.pixels.toStringAsFixed(0)}; still /calendar',
  );
}

void main() {
  final Map<String, (ui.Image, ui.Image)> shots =
      <String, (ui.Image, ui.Image)>{};

  for (final _Config c in _configs) {
    testWidgets('notice + jump: ${c.name}', (WidgetTester tester) async {
      await loadArchivo(tester);
      await _loadMaterialIcons(tester);
      final GoRouter router = await _openN2(tester, c);

      _verifyOpening(tester, c);
      final ui.Image opening = await _captureViewport(tester, c);
      await _write(tester, opening, 'jump-n2-${c.name}');

      await tester.tap(_action);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      _verifyAfter(tester, c, router);
      final ui.Image after = await _captureViewport(tester, c);
      await _write(tester, after, 'jump-after-${c.name}');
      shots[c.name] = (opening, after);

      // Both themes of a size captured: the overview, Dark then Light.
      final String dark =
          '${AppThemePreference.dark.wire}-${c.lang}-${c.viewport}';
      final String light =
          '${AppThemePreference.light.wire}-${c.lang}-${c.viewport}';
      if (shots.containsKey(dark) && shots.containsKey(light)) {
        await _write(
          tester,
          await _sideBySide(tester, <ui.Image>[
            shots[dark]!.$1,
            shots[dark]!.$2,
            shots[light]!.$1,
            shots[light]!.$2,
          ]),
          'jump-overview-${c.lang}-${c.viewport}',
        );
      }
      File('$_out/jump-verification.txt')
        ..createSync(recursive: true)
        ..writeAsStringSync(_report.toString());
    });
  }
}
