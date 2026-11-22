// Step 55C.2 review captures of the production Calendar (not goldens).
//
//   node tool/primer_review/capture_calendar_55c2_refs.mjs   (Chrome references)
//   flutter test tool/primer_review/capture_calendar_55c2_test.dart
//
// Output in build/primer-review/55c2/, every PNG at device pixel ratio 2 and
// never resized. The real CalendarScreen (router, Riverpod, repositories,
// l10n) is rendered on a surface tall enough for the whole list, then cropped
// to the content (pinned header + scrolling content); the shell's legacy
// navigation is cropped off.
// - cal-<name>-<theme>-<lang>-<viewport>.png: the Flutter capture;
// - cmp-<name>-<theme>-<lang>-<viewport>.png: the Chrome reference (left) next
//   to it (right), for: cal (all 8 configurations), stale, failed, n2,
//   completed and focus (Dark/Light × EN 390 @100% and ES 320 @200%). The
//   fixture mirrors the frozen staging scenario of the reference pages
//   (rounds 20–23, every status unknown, round 23 next, no weekend dates);
//   "completed" adds round 12 (Italian Grand Prix, completed) as the XT-2 /
//   LT-14 specimen does;
// - state-<name>.png: Flutter-only states, four panels each (Dark EN 390 @100%,
//   Dark ES 320 @200%, Light EN 390 @100%, Light ES 320 @200%).
// Rendered by the flutter_tester engine; not device validation.
import 'dart:async';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/preferences/preference_values.dart';
import 'package:gridview/features/calendar/presentation/calendar_screen.dart';
import 'package:gridview/features/calendar/presentation/widgets/calendar_event_row.dart';
import 'package:gridview/features/shared/domain/entities/calendar_entry.dart';
import 'package:gridview/features/shared/domain/entities/circuit.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/session.dart';
import 'package:gridview/features/sync/application/sync_providers.dart';
import 'package:gridview/features/sync/domain/app_sync_state.dart';
import 'package:gridview/features/sync/domain/sync_plan.dart';

import '../../test/support/domain_fixtures.dart';
import '../../test/support/fake_repository.dart';
import '../../test/support/primer_fonts.dart';
import '../../test/support/router_harness.dart';

const double _dpr = 2;
const String _out = 'build/primer-review/55c2';
const double _gap = 24;
const double _surfaceHeight = 6000;

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

const _Config _darkEn390 = _Config(AppThemePreference.dark, 'en', 390, 844, 1);
const _Config _darkEs390 = _Config(AppThemePreference.dark, 'es', 390, 844, 1);
const _Config _darkEn320 = _Config(AppThemePreference.dark, 'en', 320, 693, 2);
const _Config _darkEs320 = _Config(AppThemePreference.dark, 'es', 320, 693, 2);
const _Config _lightEn390 = _Config(
  AppThemePreference.light,
  'en',
  390,
  844,
  1,
);
const _Config _lightEs390 = _Config(
  AppThemePreference.light,
  'es',
  390,
  844,
  1,
);
const _Config _lightEn320 = _Config(
  AppThemePreference.light,
  'en',
  320,
  693,
  2,
);
const _Config _lightEs320 = _Config(
  AppThemePreference.light,
  'es',
  320,
  693,
  2,
);

const List<_Config> _all = <_Config>[
  _darkEn390,
  _darkEs390,
  _darkEn320,
  _darkEs320,
  _lightEn390,
  _lightEs390,
  _lightEn320,
  _lightEs320,
];
const List<_Config> _pair = <_Config>[
  _darkEn390,
  _darkEs320,
  _lightEn390,
  _lightEs320,
];

// --- Staging-equivalent data (`shared-reference-data.md`, Calendar C02–C10) --

final DateTime _stagingClock = DateTime.utc(2026, 11, 7, 12);

CalendarEntry _round(
  int round,
  String name,
  String circuitId,
  String circuit, {
  bool settled = true,
  EventStatus status = EventStatus.unknown,
  List<Session> sessions = const <Session>[],
}) => calendarEntry(
  round: round,
  name: name,
  status: status,
  hasResults: settled,
  sessions: sessions,
  circuit: Circuit(id: circuitId, name: circuit),
);

List<CalendarEntry> _staging({bool withCompleted = false}) => <CalendarEntry>[
  if (withCompleted)
    _round(
      12,
      'Italian Grand Prix',
      'monza',
      'Autodromo Nazionale Monza',
      status: EventStatus.completed,
    ),
  _round(
    20,
    'São Paulo Grand Prix',
    'interlagos',
    'Autódromo José Carlos Pace',
  ),
  _round(21, 'Las Vegas Grand Prix', 'vegas', 'Las Vegas Strip Circuit'),
  _round(22, 'Qatar Grand Prix', 'losail', 'Lusail International Circuit'),
  // Unknown status, no weekend dates; its race date makes it the next event.
  _round(
    23,
    'Abu Dhabi Grand Prix',
    'yas_marina',
    'Yas Marina Circuit',
    settled: false,
    sessions: <Session>[
      Session(
        id: 'race',
        type: SessionType.race,
        name: 'Race',
        startTime: DateTime.utc(2026, 11, 9, 17),
        status: SessionStatus.unknown,
      ),
    ],
  ),
];

/// Partial and unusual information from the existing model: missing circuit,
/// locality, country and dates; cancelled, postponed and unknown statuses; a
/// sprint weekend; a completed round.
List<CalendarEntry> _partial() => <CalendarEntry>[
  calendarEntry(
    round: 1,
    name: 'Bahrain Grand Prix',
    startDate: '2026-03-06',
    endDate: '2026-03-08',
    status: EventStatus.completed,
    circuit: const Circuit(
      id: 'bahrain',
      name: 'Bahrain International Circuit',
      locality: 'Sakhir',
      country: 'Bahrain',
    ),
  ),
  calendarEntry(
    round: 2,
    name: 'Saudi Arabian Grand Prix',
    startDate: '2026-03-20',
    endDate: '2026-03-22',
    status: EventStatus.cancelled,
  ),
  calendarEntry(round: 3, name: 'Bare Grand Prix', status: EventStatus.unknown),
  calendarEntry(
    round: 4,
    name: 'Chinese Grand Prix',
    startDate: '2026-08-14',
    endDate: '2026-08-16',
    status: EventStatus.postponed,
    format: WeekendFormat.sprint,
  ),
  calendarEntry(
    round: 5,
    name: 'Japanese Grand Prix',
    startDate: '2026-08-28',
    endDate: '2026-08-30',
    status: EventStatus.scheduled,
    circuit: const Circuit(
      id: 'suzuka',
      name: 'Suzuka International Racing Course',
    ),
  ),
];

// --- Rendering -------------------------------------------------------------

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

Future<void> _pumpCalendar(
  WidgetTester tester,
  _Config config, {
  List<CalendarEntry> Function(int season)? calendar,
  Stream<List<CalendarEntry>> Function(int season)? calendarStream,
  bool stale = false,
  bool failed = false,
  bool unmaterialized = false,
  DateTime? clock,
  bool focusNext = false,
}) async {
  FocusManager.instance.highlightStrategy = focusNext
      ? FocusHighlightStrategy.alwaysTraditional
      : FocusHighlightStrategy.automatic;
  await pumpApp(
    tester,
    initialLocation: '/calendar',
    surfaceSize: Size(config.width, _surfaceHeight),
    locale: Locale(config.lang),
    textScale: config.scale,
    disableAnimations: true,
    clock: clock,
    preferences: AppPreferences.defaults.copyWith(theme: config.theme),
    syncMetadata: (String key) => unmaterialized
        ? null
        : syncedMetadata(key, staleAfter: stale ? DateTime.utc(2000) : null),
    repository: FakeRaceWeekendRepository(
      home: homeViewFixture(),
      calendar: calendarStream == null
          ? (calendar ?? (int season) => calendarFixture(season: season))
          : null,
      calendarStream: calendarStream,
      grandPrix: (int season, int round) =>
          grandPrixDetailFixture(season, round),
    ),
  );
  if (failed) {
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
  }
  await tester.pumpAndSettle();
  if (focusNext) {
    // Focus the highlighted row's own focus node (no pointer involved).
    final Finder row = find.byWidgetPredicate(
      (Widget w) =>
          w is CalendarEventRow && w.emphasis != CalendarRowEmphasis.none,
    );
    Focus.of(
      tester.element(
        find.descendant(of: row, matching: find.byType(GestureDetector)).first,
      ),
    ).requestFocus();
    await tester.pumpAndSettle();
  }
  expect(tester.takeException(), isNull);
}

/// The CalendarScreen, cropped to its content (the navigation excluded).
Future<ui.Image> _capture(WidgetTester tester) async {
  RenderObject? node = tester.renderObject(find.byType(CalendarScreen));
  while (node != null && node is! RenderRepaintBoundary) {
    node = node.parent;
  }
  final RenderRepaintBoundary boundary = node! as RenderRepaintBoundary;
  final Offset origin = boundary.localToGlobal(Offset.zero);
  final Rect screen = tester.getRect(find.byType(CalendarScreen));

  double bottom = screen.top;
  final Finder rows = find.byType(CalendarEventRow);
  if (rows.evaluate().isNotEmpty) {
    for (final Element e in rows.evaluate()) {
      final double b = tester.getRect(find.byWidget(e.widget)).bottom;
      if (b > bottom) bottom = b;
    }
    bottom += 24;
  } else {
    for (final Element e
        in find
            .descendant(
              of: find.byType(CalendarScreen),
              matching: find.byType(Text),
            )
            .evaluate()) {
      final Rect r = tester.getRect(find.byWidget(e.widget));
      if (r.bottom > bottom) bottom = r.bottom;
    }
    bottom = (bottom + 200).clamp(screen.top, screen.bottom);
  }

  late ui.Image full;
  await tester.runAsync(() async {
    full = await boundary.toImage(pixelRatio: _dpr);
  });
  final Rect crop = Rect.fromLTRB(
    (screen.left - origin.dx) * _dpr,
    (screen.top - origin.dy) * _dpr,
    (screen.right - origin.dx) * _dpr,
    (bottom - origin.dy) * _dpr,
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

class _Paired {
  const _Paired(
    this.name,
    this.configs, {
    this.withCompleted = false,
    this.stale = false,
    this.failed = false,
    this.focusNext = false,
  });
  final String name;
  final List<_Config> configs;
  final bool withCompleted;
  final bool stale;
  final bool failed;
  final bool focusNext;
}

const List<_Paired> _paired = <_Paired>[
  _Paired('cal', _all),
  _Paired('stale', _pair, stale: true),
  _Paired('failed', _pair, failed: true),
  _Paired('n2', _pair, stale: true, failed: true),
  _Paired('completed', _pair, withCompleted: true),
  _Paired('focus', _pair, focusNext: true),
];

class _State {
  const _State(
    this.name, {
    this.calendar,
    this.calendarStream,
    this.unmaterialized = false,
    this.failed = false,
    this.stale = false,
  });
  final String name;
  final List<CalendarEntry> Function(int season)? calendar;
  final Stream<List<CalendarEntry>> Function(int season)? calendarStream;
  final bool unmaterialized;
  final bool failed;
  final bool stale;
}

final List<_State> _states = <_State>[
  _State(
    'loading',
    calendarStream: (int season) => const Stream<List<CalendarEntry>>.empty(),
  ),
  _State(
    'first-load-failure',
    calendar: (int season) => const <CalendarEntry>[],
    unmaterialized: true,
    failed: true,
  ),
  _State('empty', calendar: (int season) => const <CalendarEntry>[]),
  _State('partial-and-unusual-statuses', calendar: (int season) => _partial()),
  _State(
    'belgian-fixture-next-completed',
    calendar: (int season) => calendarFixture(season: season),
  ),
  // A tall surface does not scroll, so the notice shows at the top here.
  _State(
    'belgian-fixture-n2-combined',
    calendar: (int season) => calendarFixture(season: season),
    stale: true,
    failed: true,
  ),
];

void main() {
  for (final _Paired pair in _paired) {
    testWidgets('paired: ${pair.name}', (WidgetTester tester) async {
      await loadArchivo(tester);
      await _loadMaterialIcons(tester);
      for (final _Config config in pair.configs) {
        await _pumpCalendar(
          tester,
          config,
          calendar: (int season) => _staging(withCompleted: pair.withCompleted),
          stale: pair.stale,
          failed: pair.failed,
          clock: _stagingClock,
          focusNext: pair.focusNext,
        );
        final ui.Image image = await _capture(tester);
        final String suffix = config.name;
        await _write(tester, image, 'cal-${pair.name}-$suffix');
        final ui.Image? ref = await _readRef(
          tester,
          'ref-${pair.name}-${config.theme.wire}-${config.lang}-'
          '${config.viewport}',
        );
        if (ref != null) {
          await _write(
            tester,
            await _compose(tester, <(ui.Image, Rect)>[
              (ref, _whole(ref)),
              (image, _whole(image)),
            ]),
            'cmp-${pair.name}-$suffix',
          );
        }
      }
      FocusManager.instance.highlightStrategy =
          FocusHighlightStrategy.automatic;
    });
  }

  for (final _State state in _states) {
    testWidgets('state: ${state.name}', (WidgetTester tester) async {
      await loadArchivo(tester);
      await _loadMaterialIcons(tester);
      final List<(ui.Image, Rect)> panels = <(ui.Image, Rect)>[];
      for (final _Config config in _pair) {
        await _pumpCalendar(
          tester,
          config,
          calendar: state.calendar,
          calendarStream: state.calendarStream,
          unmaterialized: state.unmaterialized,
          failed: state.failed,
          stale: state.stale,
        );
        final ui.Image image = await _capture(tester);
        panels.add((image, _whole(image)));
      }
      await _write(
        tester,
        await _compose(tester, panels),
        'state-${state.name}',
      );
    });
  }
}
