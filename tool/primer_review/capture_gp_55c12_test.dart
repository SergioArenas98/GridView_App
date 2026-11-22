// Step 55C.12 review captures of the production Grand Prix Detail (not
// goldens).
//
//   node tool/primer_review/capture_gp_55c12_refs.mjs   (Chrome references)
//   flutter test tool/primer_review/capture_gp_55c12_test.dart
//
// Output in build/primer-review/55c12/, every PNG at device pixel ratio 2 and
// never resized. The real GrandPrixDetailScreen (router, Riverpod,
// repositories, l10n) is pushed above Home, as from the Calendar, on a
// surface tall enough for the whole page, then cropped to the screen's
// content.
// - gp-<name>-<theme>-<lang>-<viewport>.png: the Flutter capture;
// - cmp-<name>-<theme>-<lang>-<viewport>.png: the Chrome reference (left)
//   next to it (right). Every value is a development test fixture (the
//   prototype's own sources: `grand_prix_widget_test.dart`,
//   `screen_golden_test.dart`, `domain_fixtures.dart`), **not a real-world
//   result**. Frame pairs put the reference's fixture frame next to the
//   whole Flutter screen rendered from the same fixture;
// - state-<name>.png: Flutter-only states, four panels each (Dark EN 390
//   @100%, Dark ES 320 @200%, Light EN 390 @100%, Light ES 320 @200%). Every
//   name starting "Synthetic" is invented test data
//   (`test/support/grand_prix_review_fixtures.dart`);
// - flutter-geometry.json: element boxes (logical px, from the top of the
//   screen) for the numeric comparison with ref-geometry.json.
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
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/preferences/preference_values.dart';
import 'package:gridview/core/time/timezones.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/calendar/presentation/grand_prix_detail_screen.dart';
import 'package:gridview/features/shared/domain/entities/circuit.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix_view.dart';
import 'package:gridview/features/shared/domain/entities/race_result.dart';
import 'package:gridview/features/shared/domain/entities/resource_key.dart';
import 'package:gridview/features/shared/domain/entities/session.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/shared/domain/refresh_result.dart';
import 'package:gridview/features/shared/presentation/widgets/primer_detail_app_bar.dart';
import 'package:intl/date_symbol_data_local.dart';

import '../../test/support/domain_fixtures.dart';
import '../../test/support/fake_repository.dart';
import '../../test/support/grand_prix_review_fixtures.dart';
import '../../test/support/primer_fonts.dart';
import '../../test/support/router_harness.dart';

const double _dpr = 2;
const String _out = 'build/primer-review/55c12';
const double _gap = 24;
const double _surfaceHeight = 5200;

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
const List<_Config> _all = <_Config>[
  _Config(_d, 'en', 390, 844, 1),
  _Config(_d, 'es', 390, 844, 1),
  _Config(_d, 'en', 320, 693, 2),
  _Config(_d, 'es', 320, 693, 2),
  _Config(_l, 'en', 390, 844, 1),
  _Config(_l, 'es', 390, 844, 1),
  _Config(_l, 'en', 320, 693, 2),
  _Config(_l, 'es', 320, 693, 2),
];
const List<_Config> _pair = <_Config>[
  _Config(_d, 'en', 390, 844, 1),
  _Config(_d, 'es', 320, 693, 2),
  _Config(_l, 'en', 390, 844, 1),
  _Config(_l, 'es', 320, 693, 2),
];

/// State frames: Dark EN 390 @100% and Light ES 320 @200%, as the refs.
const List<_Config> _frame = <_Config>[
  _Config(_d, 'en', 390, 844, 1),
  _Config(_l, 'es', 320, 693, 2),
];

// --- Data (verbatim from the prototype's fixture sources) --------------------

/// Scenario A / `grand_prix_widget_test.dart` `_detail`.
GrandPrixDetailView _belgian({
  String name = 'Belgian Grand Prix',
  String? officialName,
  EventStatus status = EventStatus.upcoming,
  WeekendFormat format = WeekendFormat.sprint,
  List<Session>? sessions,
  bool hasResults = false,
  Circuit? circuit,
  String? timezone = 'Europe/Brussels',
}) => GrandPrixDetailView(
  grandPrix: GrandPrix(
    id: '2026-belgian-grand-prix',
    season: 2026,
    round: 13,
    eventSlug: 'belgian-grand-prix',
    name: name,
    officialName: officialName,
    circuitId: 'spa-francorchamps',
    status: status,
    format: format,
    startDate: '2026-07-24',
    endDate: '2026-07-26',
    timezone: timezone,
    sessions: sessions ?? belgianSprintSessions(),
    hasResults: hasResults,
  ),
  circuit: circuit ?? circuitSpa(),
  freshness: freshness(
    generatedAt: DateTime.utc(2026, 7, 18, 12),
    staleAfter: DateTime.utc(2026, 7, 18, 12, 15),
  ),
);

GrandPrixDetailView _scenarioA() =>
    _belgian(officialName: 'Formula 1 Mock Belgian Grand Prix 2026');

GrandPrixDetailView _completedBelgian() =>
    _belgian(status: EventStatus.completed, hasResults: true);

/// Scenario B / `screen_golden_test.dart` `_completedWeekend`.
GrandPrixDetailView _italian() => GrandPrixDetailView(
  grandPrix: GrandPrix(
    id: '2026-italian-grand-prix',
    season: 2026,
    round: 12,
    eventSlug: 'italian-grand-prix',
    name: 'Italian Grand Prix',
    circuitId: 'monza',
    status: EventStatus.completed,
    format: WeekendFormat.standard,
    startDate: '2026-07-10',
    endDate: '2026-07-12',
    timezone: 'Europe/Rome',
    sessions: <Session>[
      Session(
        id: 'i-qualifying',
        type: SessionType.qualifying,
        name: 'Qualifying',
        startTime: DateTime.utc(2026, 7, 11, 14),
        status: SessionStatus.completed,
      ),
      Session(
        id: 'i-race',
        type: SessionType.race,
        name: 'Race',
        startTime: DateTime.utc(2026, 7, 12, 13),
        status: SessionStatus.completed,
      ),
    ],
    hasResults: true,
  ),
  circuit: const Circuit(
    id: 'monza',
    name: 'Autodromo Nazionale Monza',
    locality: 'Monza',
    country: 'Italy',
  ),
  freshness: freshness(
    generatedAt: DateTime.utc(2026, 7, 18, 12),
    staleAfter: DateTime.utc(2026, 7, 18, 12, 15),
  ),
);

/// Scenario B's classification (`_raceDocument`).
RaceResult _italianRace() => raceResultFixture(
  round: 12,
  sessionType: SessionType.race,
  entries: const <RaceResultEntry>[
    RaceResultEntry(
      driverId: 'max-verstappen',
      constructorId: 'red-bull',
      driverName: 'Max Verstappen',
      constructorName: 'Red Bull Racing',
      position: 1,
      points: 25,
      status: FinishStatus.finished,
      elapsedTime: Duration(
        hours: 1,
        minutes: 15,
        seconds: 12,
        milliseconds: 345,
      ),
    ),
    RaceResultEntry(
      driverId: 'lando-norris',
      constructorId: 'mclaren',
      driverName: 'Lando Norris',
      constructorName: 'McLaren',
      position: 2,
      points: 18,
      status: FinishStatus.finished,
      gapToLeader: Duration(seconds: 3, milliseconds: 210),
    ),
    RaceResultEntry(
      driverId: 'charles-leclerc',
      constructorId: 'ferrari',
      driverName: 'Charles Leclerc',
      constructorName: 'Ferrari',
      status: FinishStatus.dnf,
      dnfReason: 'Power unit',
    ),
  ],
);

const RaceResultEntry _max = RaceResultEntry(
  driverId: 'max-verstappen',
  constructorId: 'red-bull',
  driverName: 'Max Verstappen',
  constructorName: 'Red Bull Racing',
  position: 1,
  points: 25,
  status: FinishStatus.finished,
  laps: 44,
  elapsedTime: Duration(hours: 1, minutes: 25, seconds: 3, milliseconds: 456),
);

const RaceResultEntry _oscar = RaceResultEntry(
  driverId: 'oscar-piastri',
  constructorId: 'mclaren',
  driverName: 'Oscar Piastri',
  constructorName: 'McLaren',
  position: 2,
  points: 18.5,
  status: FinishStatus.finished,
  laps: 44,
  gapToLeader: Duration(seconds: 4, milliseconds: 120),
);

/// `grand_prix_widget_test.dart` `_race`.
RaceResult _race({
  List<RaceResultEntry> entries = const <RaceResultEntry>[_max, _oscar],
  ResultStatus status = ResultStatus.finalResult,
  FastestLap? fastestLap,
  SessionType type = SessionType.race,
}) => raceResultFixture(
  sessionType: type,
  status: status,
  fastestLap: fastestLap,
  entries: entries,
);

RaceResult _finishes() => _race(
  entries: const <RaceResultEntry>[
    RaceResultEntry(
      driverId: 'a-driver',
      constructorId: 'a-team',
      driverName: 'A Driver',
      constructorName: 'A Team',
      position: 15,
      status: FinishStatus.lapped,
      lapsBehind: 2,
    ),
    RaceResultEntry(
      driverId: 'b-driver',
      constructorId: 'b-team',
      driverName: 'B Driver',
      constructorName: 'B Team',
      status: FinishStatus.dnf,
      dnfReason: 'Power unit',
    ),
    RaceResultEntry(
      driverId: 'c-driver',
      constructorId: 'c-team',
      driverName: 'C Driver',
      constructorName: 'C Team',
      status: FinishStatus.dns,
    ),
    RaceResultEntry(
      driverId: 'd-driver',
      constructorId: 'd-team',
      driverName: 'D Driver',
      constructorName: 'D Team',
      status: FinishStatus.dsq,
    ),
    RaceResultEntry(
      driverId: 'e-driver',
      constructorId: 'e-team',
      driverName: 'E Driver',
      constructorName: 'E Team',
      status: FinishStatus.dnq,
    ),
    RaceResultEntry(
      driverId: 'f-driver',
      constructorId: 'f-team',
      driverName: 'F Driver',
      constructorName: 'F Team',
      status: FinishStatus.unknown,
    ),
  ],
);

RaceResult _unresolved() => _race(
  entries: const <RaceResultEntry>[
    RaceResultEntry(
      driverId: 'unsynced-driver',
      constructorId: 'unsynced-team',
      position: 1,
      points: 25,
      status: FinishStatus.finished,
      laps: 44,
    ),
  ],
);

List<Session> _oddSessions() => <Session>[
  Session(
    id: 's-unknown',
    type: SessionType.unknown,
    startTime: DateTime.utc(2026, 7, 24, 9),
    status: SessionStatus.unknown,
  ),
  Session(
    id: 's-cancelled',
    type: SessionType.practice2,
    name: 'Practice 2',
    startTime: DateTime.utc(2026, 7, 24, 14),
    status: SessionStatus.cancelled,
  ),
  Session(
    id: 's-postponed',
    type: SessionType.qualifying,
    name: 'Qualifying',
    startTime: DateTime.utc(2026, 7, 25, 14),
    status: SessionStatus.postponed,
  ),
];

/// States frame 14 (presenter fixture): an Asia/Tokyo event, a UTC device,
/// Both clocks, one session at 23:00 UTC.
GrandPrixDetailView _midnight() => _belgian(
  timezone: 'Asia/Tokyo',
  sessions: <Session>[
    Session(
      id: 's-late',
      type: SessionType.race,
      name: 'Race',
      startTime: DateTime.utc(2026, 7, 26, 23),
      status: SessionStatus.scheduled,
    ),
  ],
);

ResourceSyncState? _never(String key) => null;
ResourceSyncState? _allStale(String key) =>
    syncedMetadata(key, staleAfter: DateTime.utc(2000));
ResourceSyncState? _eventStale(String key) =>
    key == ResourceKey.grandPrix(2026, 13)
    ? syncedMetadata(key, staleAfter: DateTime.utc(2000))
    : syncedMetadata(key);
ResourceSyncState? _resultsStale(String key) =>
    key == ResourceKey.grandPrixResults(2026, 13)
    ? syncedMetadata(key, staleAfter: DateTime.utc(2000))
    : syncedMetadata(key);

Future<RefreshResult> _offline(int s, int r) async =>
    const RefreshFailure(ApiFailure(kind: ApiFailureKind.networkUnavailable));
Future<RefreshResult> _unavailable(int s, int r) async =>
    const RefreshFailure(ApiFailure(kind: ApiFailureKind.serverUnavailable));
Future<RefreshResult> _pending(int s, int r) =>
    Completer<RefreshResult>().future;

class _Scenario {
  const _Scenario({
    this.detail = _scenarioA,
    this.results,
    this.refreshDetail,
    this.refreshResults,
    this.metadata,
    this.mockData = false,
    this.focus,
    this.time = TimeDisplayPreference.device,
    this.round = 13,
    this.surfaceHeight = _surfaceHeight,
  });

  /// `null` = nothing stored for the event.
  final GrandPrixDetailView? Function()? detail;
  final List<RaceResult> Function()? results;
  final Future<RefreshResult> Function(int s, int r)? refreshDetail;
  final Future<RefreshResult> Function(int s, int r)? refreshResults;
  final ResourceSyncState? Function(String key)? metadata;
  final bool mockData;

  /// 'row' or 'team' (the second classification row).
  final String? focus;
  final TimeDisplayPreference time;
  final int round;

  /// The capture surface's height (the full field at 200% is ~10,000px).
  final double surfaceHeight;
}

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

Future<void> _pump(WidgetTester tester, _Config config, _Scenario s) async {
  FocusManager.instance.highlightStrategy = s.focus != null
      ? FocusHighlightStrategy.alwaysTraditional
      : FocusHighlightStrategy.automatic;
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.pump();
  final GrandPrixDetailView? Function()? detail = s.detail;
  final GoRouter router = await pumpApp(
    tester,
    surfaceSize: Size(config.width, s.surfaceHeight),
    locale: Locale(config.lang),
    textScale: config.scale,
    disableAnimations: true,
    mockData: s.mockData,
    syncMetadata: s.metadata,
    preferences: AppPreferences.defaults.copyWith(
      theme: config.theme,
      timeDisplay: s.time,
    ),
    repository: FakeRaceWeekendRepository(
      home: homeViewFixture(),
      calendar: (int season) => calendarFixture(season: season),
      grandPrix: (int season, int round) => detail?.call(),
      results: (int season, int round) =>
          s.results?.call() ?? const <RaceResult>[],
      onRefreshGrandPrix: s.refreshDetail,
      onRefreshResults: s.refreshResults,
    ),
  );
  // Opened from an origin, so the back action exists, as in the prototype.
  unawaited(router.push('/calendar/2026/${s.round}'));
  await tester.pumpAndSettle();
  if (s.focus case final String focus) {
    final Finder row = find.byType(GvPrimerResultRow).at(1);
    final Finder target = find
        .descendant(of: row, matching: find.byType(GvPrimerFocusTarget))
        .at(focus == 'team' ? 1 : 0);
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
}

/// The bottom of the screen's content: the end of the scroll view's
/// content (its last child plus the 32px end padding).
double _contentBottom(WidgetTester tester) {
  final Rect screen = tester.getRect(find.byType(GrandPrixDetailScreen));
  double bottom = screen.top;
  for (final Element e
      in find
          .descendant(
            of: find.byType(GrandPrixDetailScreen),
            matching: find.byWidgetPredicate(
              (Widget w) =>
                  w is Text ||
                  w is GvPrimerSkeleton ||
                  w is GvPrimerArrowDisc ||
                  w is GvPrimerStatusChip ||
                  w is GvPrimerResultRow ||
                  w is GvPrimerButton,
            ),
          )
          .evaluate()) {
    final RenderBox box = e.renderObject! as RenderBox;
    if (!box.hasSize) continue;
    final double b = box.localToGlobal(Offset(0, box.size.height)).dy;
    if (b > bottom) bottom = b;
  }
  return (bottom + 32).clamp(screen.top, screen.bottom);
}

Future<ui.Image> _capture(WidgetTester tester) async {
  RenderObject? node = tester.renderObject(find.byType(GrandPrixDetailScreen));
  while (node != null && node is! RenderRepaintBoundary) {
    node = node.parent;
  }
  final RenderRepaintBoundary boundary = node! as RenderRepaintBoundary;
  final Offset origin = boundary.localToGlobal(Offset.zero);
  final Rect screen = tester.getRect(find.byType(GrandPrixDetailScreen));
  final double bottom = _contentBottom(tester);
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

/// Element boxes, from the top of the screen, for the comparison with the
/// Chrome geometry.
Map<String, Object> _geometry(WidgetTester tester) {
  final double top = tester.getRect(find.byType(GrandPrixDetailScreen)).top;
  List<List<double>> boxes(Finder f) => <List<double>>[
    for (final Element e in f.evaluate())
      if ((e.renderObject as RenderBox?)?.hasSize ?? false)
        () {
          final RenderBox box = e.renderObject! as RenderBox;
          final Offset o = box.localToGlobal(Offset.zero);
          double r(double v) => (v * 10).roundToDouble() / 10;
          return <double>[
            r(o.dx),
            r(o.dy - top),
            r(box.size.width),
            r(box.size.height),
          ];
        }(),
  ];
  Finder key(String k) => find.byKey(ValueKey<String>(k));
  return <String, Object>{
    'height': _contentBottom(tester) - top,
    'boxes': <String, Object>{
      '.dbar': boxes(find.byType(PrimerDetailAppBar)),
      '.notice': boxes(find.byType(GvPrimerNotice)),
      '.gp': boxes(key('gp-band')),
      '.gp__chips': boxes(key('gp-band-chips')),
      '.gp__round-num': boxes(key('gp-band-round')),
      '.gp__seam': boxes(key('gp-band-seam')),
      '.gp__season': boxes(key('gp-band-season')),
      '.gp__name': boxes(key('gp-band-name')),
      '.gp__official': boxes(key('gp-band-official')),
      '.gp__facts': boxes(key('gp-band-facts')),
      '.cx': boxes(key('gp-circuit-link')),
      '.cx__name': boxes(key('gp-circuit-name')),
      '.cx__disc': boxes(find.byType(GvPrimerArrowDisc)),
      '.section-title': boxes(find.byType(GvPrimerSectionTitle)),
      '.zones': boxes(key('gp-zones')),
      '.sess__hm': boxes(key('session-time')),
      '.sess__name': boxes(key('session-name')),
      '.sess__t2': boxes(key('session-time-secondary')),
      '.cl': boxes(find.byType(GvPrimerResultRow)),
      // Step 55C.12R (GPD-12): the team links' interactive bounds.
      '.cl__team': boxes(
        find.byWidgetPredicate(
          (Widget w) =>
              w is GvPrimerFocusTarget &&
              w.geometry == GvPrimerFocusGeometry.teamLink,
        ),
      ),
      '.chip': boxes(find.byType(GvPrimerStatusChip)),
      '.skel span': boxes(find.byType(GvPrimerSkeleton)),
      '.btn': boxes(find.byType(GvPrimerButton)),
    },
  };
}

final Map<String, (_Scenario, List<_Config>)>
_paired = <String, (_Scenario, List<_Config>)>{
  'index': (const _Scenario(), _all),
  'results': (
    _Scenario(
      detail: _italian,
      results: () => <RaceResult>[_italianRace()],
      round: 12,
    ),
    _all,
  ),
  'focus-row': (
    _Scenario(
      detail: _italian,
      results: () => <RaceResult>[_italianRace()],
      round: 12,
      focus: 'row',
    ),
    _pair,
  ),
  'focus-team': (
    _Scenario(
      detail: _italian,
      results: () => <RaceResult>[_italianRace()],
      round: 12,
      focus: 'team',
    ),
    _pair,
  ),
  'title-1': (
    _Scenario(detail: () => _belgian(name: 'Barcelona-Catalunya Grand Prix')),
    _pair,
  ),
  'frame-1': (
    const _Scenario(detail: null, metadata: _never, refreshDetail: _pending),
    _frame,
  ),
  'frame-4': (const _Scenario(detail: _belgian, metadata: _eventStale), _frame),
  'frame-5': (
    const _Scenario(detail: _belgian, refreshDetail: _offline),
    _frame,
  ),
  'frame-8': (
    _Scenario(
      detail: () =>
          _belgian(status: EventStatus.unknown, format: WeekendFormat.unknown),
    ),
    _frame,
  ),
  'frame-9': (
    _Scenario(detail: () => _belgian(sessions: _oddSessions())),
    _frame,
  ),
  'frame-10': (
    _Scenario(
      detail: () => _belgian(
        sessions: const <Session>[
          Session(
            id: 's-tbd',
            type: SessionType.race,
            name: 'Race',
            status: SessionStatus.scheduled,
          ),
        ],
      ),
    ),
    _frame,
  ),
  'frame-14': (
    const _Scenario(detail: _midnight, time: TimeDisplayPreference.both),
    _frame,
  ),
  'frame-17': (
    const _Scenario(detail: _completedBelgian, refreshResults: _unavailable),
    _frame,
  ),
  'frame-18': (
    _Scenario(
      detail: _completedBelgian,
      results: () => <RaceResult>[_race()],
      refreshResults: _offline,
    ),
    _frame,
  ),
  'frame-19': (
    _Scenario(
      detail: _completedBelgian,
      results: () => <RaceResult>[_race()],
      metadata: _allStale,
    ),
    _frame,
  ),
  'frame-20': (
    _Scenario(
      detail: _completedBelgian,
      results: () => <RaceResult>[_race(status: ResultStatus.provisional)],
    ),
    _frame,
  ),
  'frame-21': (
    _Scenario(
      detail: _completedBelgian,
      results: () => <RaceResult>[
        _race(fastestLap: const FastestLap(driverId: 'oscar-piastri', lap: 40)),
      ],
    ),
    _frame,
  ),
  'frame-22': (
    _Scenario(
      detail: _completedBelgian,
      results: () => <RaceResult>[_finishes()],
    ),
    _frame,
  ),
  'frame-24': (
    _Scenario(
      detail: _completedBelgian,
      results: () => <RaceResult>[_unresolved()],
    ),
    _frame,
  ),
};

final Map<String, _Scenario> _states = <String, _Scenario>{
  // XS-13: the synthetic 23-entry field (review-only, invented names).
  'synthetic-full-field': _Scenario(
    detail: _completedBelgian,
    results: () => <RaceResult>[syntheticFullFieldRace()],
    surfaceHeight: 12000,
  ),
  // N-2 for two resources (remote build).
  'n2-event-failed-stale': const _Scenario(
    detail: _belgian,
    metadata: _eventStale,
    refreshDetail: _offline,
  ),
  'n2-event-failed-results-stale': _Scenario(
    detail: _completedBelgian,
    results: () => <RaceResult>[_race()],
    metadata: _resultsStale,
    refreshDetail: _offline,
  ),
  'n2-both-failed': _Scenario(
    detail: _completedBelgian,
    results: () => <RaceResult>[_race()],
    refreshDetail: _offline,
    refreshResults: _offline,
  ),
  // Fixture build: results failure + results stale combine in the section.
  'n2-results-failed-stale-fixture': _Scenario(
    detail: _completedBelgian,
    results: () => <RaceResult>[_race()],
    metadata: _resultsStale,
    refreshResults: _offline,
    mockData: true,
  ),
  // GPD-03: blank stored name.
  'blank-name': _Scenario(detail: () => _belgian(name: '  ')),
  // GPD-02: the retained sprint renderer, no winner treatment.
  'sprint-and-race': _Scenario(
    detail: _completedBelgian,
    results: () => <RaceResult>[
      _race(
        type: SessionType.sprint,
        entries: const <RaceResultEntry>[
          RaceResultEntry(
            driverId: 'lando-norris',
            constructorId: 'mclaren',
            driverName: 'Lando Norris',
            constructorName: 'McLaren',
            position: 1,
            points: 8,
            status: FinishStatus.finished,
          ),
        ],
      ),
      _race(),
    ],
  ),
  // Long names everywhere (synthetic).
  'long-names': _Scenario(
    detail: () => _belgian(
      status: EventStatus.completed,
      hasResults: true,
      name: 'Synthetic Extraordinarily Long Grand Prix Name of the Round',
      officialName:
          'Synthetic Formula 1 Very Long Official Grand Prix Title Sponsored '
          'by Several Companies 2026',
      circuit: const Circuit(
        id: 'spa-francorchamps',
        name: 'Synthetic Autódromo Internacional of the Very Long Circuit Name',
        locality: 'Synthetic Municipality of the Very Long Place Name',
        country: 'Synthetic Republic',
      ),
    ),
    results: () => <RaceResult>[syntheticFullFieldRace()],
    time: TimeDisplayPreference.both,
    surfaceHeight: 13000,
  ),
};

void main() {
  final Map<String, Object> geometry = <String, Object>{};

  // `tool/` has no flutter_test_config.dart: initialise the IANA database and
  // the date symbols as `test/flutter_test_config.dart` does, so the pinned
  // UTC device zone and the event zones resolve instead of falling back to
  // the host clock.
  setUpAll(() async {
    ensureTimeZonesInitialized();
    await initializeDateFormatting('en');
    await initializeDateFormatting('es');
  });

  for (final MapEntry<String, (_Scenario, List<_Config>)> entry
      in _paired.entries) {
    testWidgets('paired: ${entry.key}', (WidgetTester tester) async {
      await loadArchivo(tester);
      await _loadMaterialIcons(tester);
      final (_Scenario scenario, List<_Config> configs) = entry.value;
      for (final _Config config in configs) {
        await _pump(tester, config, scenario);
        geometry['${entry.key}-${config.name}'] = _geometry(tester);
        final ui.Image image = await _capture(tester);
        await _write(tester, image, 'gp-${entry.key}-${config.name}');
        final ui.Image? ref = await _readRef(
          tester,
          'ref-${entry.key}-${config.theme.wire}-${config.lang}-'
          '${config.viewport}',
        );
        if (ref != null) {
          await _write(
            tester,
            await _compose(tester, <(ui.Image, Rect)>[
              (ref, _whole(ref)),
              (image, _whole(image)),
            ]),
            'cmp-${entry.key}-${config.name}',
          );
        }
      }
      FocusManager.instance.highlightStrategy =
          FocusHighlightStrategy.automatic;
    });
  }

  for (final MapEntry<String, _Scenario> entry in _states.entries) {
    testWidgets('state: ${entry.key}', (WidgetTester tester) async {
      await loadArchivo(tester);
      await _loadMaterialIcons(tester);
      final List<(ui.Image, Rect)> panels = <(ui.Image, Rect)>[];
      for (final _Config config in _pair) {
        await _pump(tester, config, entry.value);
        final ui.Image image = await _capture(tester);
        panels.add((image, _whole(image)));
      }
      await _write(
        tester,
        await _compose(tester, panels),
        'state-${entry.key}',
      );
    });
  }

  tearDownAll(() {
    File('$_out/flutter-geometry.json')
      ..createSync(recursive: true)
      ..writeAsStringSync(const JsonEncoder.withIndent(' ').convert(geometry));
  });
}
