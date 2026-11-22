// Step 55C.1 review captures of the production Home (not goldens).
//
//   node tool/primer_review/capture_home_55c1_refs.mjs   (Chrome references)
//   flutter test tool/primer_review/capture_home_55c1_test.dart
//
// Output in build/primer-review/55c1/, every PNG at device pixel ratio 2 and
// never resized:
// - home-<theme>-<lang>-<viewport>.png: the real HomeScreen (router, Riverpod,
//   repositories, l10n) rendering a fixture that mirrors the frozen staging
//   scenario of the approved pages (Abu Dhabi R23, status unknown, one race
//   session, Norris / McLaren leaders, Qatar R22 final with a winner, no
//   upcoming races, so HM-01 omits the section), full content height, with
//   the shell's legacy navigation cropped off;
// - cmp-home-<theme>-<lang>-<viewport>.png: the Chrome reference (left) next
//   to the Flutter capture (right);
// - state-<name>.png: the principal non-happy-path states, four panels each:
//   Dark EN 390 @100%, Dark ES 320 @200%, Light EN 390 @100%, Light ES
//   320 @200%.
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
import 'package:gridview/features/home/presentation/home_screen.dart';
import 'package:gridview/features/home/presentation/widgets/home_explore_strip.dart';
import 'package:gridview/features/shared/domain/entities/calendar_entry.dart';
import 'package:gridview/features/shared/domain/entities/circuit.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix.dart';
import 'package:gridview/features/shared/domain/entities/home_dashboard.dart';
import 'package:gridview/features/shared/domain/entities/race_result.dart';
import 'package:gridview/features/shared/domain/entities/session.dart';
import 'package:gridview/features/shared/domain/entities/standing_entry.dart';
import 'package:gridview/features/sync/application/sync_providers.dart';
import 'package:gridview/features/sync/domain/app_sync_state.dart';
import 'package:gridview/features/sync/domain/sync_plan.dart';

import '../../test/support/domain_fixtures.dart';
import '../../test/support/fake_repository.dart';
import '../../test/support/primer_fonts.dart';
import '../../test/support/router_harness.dart';

const double _dpr = 2;
const String _out = 'build/primer-review/55c1';
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

const List<_Config> _matrix = <_Config>[
  _Config(AppThemePreference.dark, 'en', 390, 844, 1),
  _Config(AppThemePreference.dark, 'es', 390, 844, 1),
  _Config(AppThemePreference.dark, 'en', 320, 693, 2),
  _Config(AppThemePreference.dark, 'es', 320, 693, 2),
  _Config(AppThemePreference.light, 'en', 390, 844, 1),
  _Config(AppThemePreference.light, 'es', 390, 844, 1),
  _Config(AppThemePreference.light, 'en', 320, 693, 2),
  _Config(AppThemePreference.light, 'es', 320, 693, 2),
];

const List<_Config> _statePanels = <_Config>[
  _Config(AppThemePreference.dark, 'en', 390, 844, 1),
  _Config(AppThemePreference.dark, 'es', 320, 693, 2),
  _Config(AppThemePreference.light, 'en', 390, 844, 1),
  _Config(AppThemePreference.light, 'es', 320, 693, 2),
];

/// The capture surface is tall enough for the whole page; the image is then
/// cropped to the content.
const double _surfaceHeight = 5200;

// --- The staging-equivalent scenario (`shared-reference-data.md`) ---------

final DateTime _stagingClock = DateTime.utc(2026, 11, 7, 12);

HomeDashboardView _stagingDashboard() => HomeDashboardView(
  seasonYear: 2026,
  season: season2026(),
  focus: HomeFocus(
    grandPrix: GrandPrix(
      id: '2026-abu-dhabi-grand-prix',
      season: 2026,
      round: 23,
      eventSlug: 'abu-dhabi-grand-prix',
      name: 'Abu Dhabi Grand Prix',
      circuitId: 'yas-marina',
      status: EventStatus.unknown,
      format: WeekendFormat.standard,
      timezone: 'Asia/Dubai',
      sessions: <Session>[
        Session(
          id: 'race',
          type: SessionType.race,
          name: 'Race',
          startTime: DateTime.utc(2026, 11, 9, 17),
          status: SessionStatus.unknown,
        ),
      ],
      hasResults: false,
    ),
    circuit: const Circuit(id: 'yas-marina', name: 'Yas Marina Circuit'),
    source: HomeFocusSource.homeSnapshot,
  ),
  latestCompleted: calendarEntry(
    round: 22,
    name: 'Qatar Grand Prix',
    status: EventStatus.completed,
    hasResults: true,
    circuit: const Circuit(id: 'lusail', name: 'Lusail International Circuit'),
  ),
  latestRaceResult: raceResultFixture(
    sessionType: SessionType.race,
    round: 22,
    entries: const <RaceResultEntry>[
      RaceResultEntry(
        driverId: 'lando-norris',
        constructorId: 'mclaren',
        driverName: 'Lando Norris',
        constructorName: 'McLaren',
        position: 1,
        status: FinishStatus.finished,
      ),
    ],
  ),
  upcoming: const <CalendarEntry>[],
  driverLeaders: <DriverStandingEntry>[
    driverStandingEntry(
      driverId: 'lando-norris',
      driverName: 'Lando Norris',
      constructorName: 'McLaren',
      order: 0,
      position: 1,
      points: 120,
    ),
  ],
  constructorLeaders: <ConstructorStandingEntry>[
    constructorStandingEntry(
      constructorId: 'mclaren',
      stableName: 'McLaren',
      order: 0,
      position: 1,
      points: 150,
    ),
  ],
);

// --- States ----------------------------------------------------------------

class _State {
  const _State(
    this.name, {
    this.dashboard,
    this.dashboardStream,
    this.staleKeys = const <String>{},
    this.unmaterializedKeys = const <String>{},
    this.failHome = false,
  });

  final String name;
  final HomeDashboardView Function()? dashboard;
  final Stream<HomeDashboardView?> Function()? dashboardStream;
  final Set<String> staleKeys;
  final Set<String> unmaterializedKeys;
  final bool failHome;
}

final List<_State> _states = <_State>[
  _State(
    'loading',
    dashboardStream: () => Stream<HomeDashboardView?>.fromFuture(
      Completer<HomeDashboardView?>().future,
    ),
  ),
  _State(
    'first-load-failure',
    dashboardStream: () => Stream<HomeDashboardView?>.value(null),
    failHome: true,
  ),
  _State(
    'season-empty',
    dashboard: () => homeDashboardFixture(
      withFocus: false,
      withLatestCompleted: false,
      upcoming: const <CalendarEntry>[],
    ),
  ),
  _State(
    'refresh-failed-other-stale',
    dashboard: homeDashboardFixture,
    staleKeys: <String>{'standings:drivers:2026'},
    failHome: true,
  ),
  _State(
    'combined-n2',
    dashboard: homeDashboardFixture,
    staleKeys: <String>{'home:2026'},
    failHome: true,
  ),
  _State(
    'partial-leader-unavailable',
    dashboard: () =>
        homeDashboardFixture(driverLeaders: const <DriverStandingEntry>[]),
    unmaterializedKeys: <String>{'standings:drivers:2026'},
  ),
  _State(
    'tied-and-no-leader',
    dashboard: () => homeDashboardFixture(
      driverLeaders: <DriverStandingEntry>[
        driverStandingEntry(
          driverId: 'max-verstappen',
          driverName: 'Max Verstappen',
          order: 0,
          position: 1,
          points: 241,
        ),
        driverStandingEntry(
          driverId: 'lando-norris',
          driverName: 'Lando Norris',
          order: 1,
          position: 1,
          points: 241,
        ),
      ],
      constructorLeaders: const <ConstructorStandingEntry>[],
    ),
  ),
  _State(
    'race-weekend-live',
    dashboard: () => homeDashboardFixture(
      focus: homeFocusFixture(
        status: EventStatus.inProgress,
        sessions: <Session>[
          Session(
            id: 'race',
            type: SessionType.race,
            name: 'Race',
            startTime: DateTime.utc(2026, 7, 18, 11),
            status: SessionStatus.live,
          ),
        ],
      ),
    ),
  ),
  _State(
    'post-race-upcoming-list',
    dashboard: () => homeDashboardFixture(
      focus: homeFocusFixture(status: EventStatus.completed),
    ),
  ),
  _State(
    'session-without-time',
    dashboard: () => homeDashboardFixture(
      focus: homeFocusFixture(
        sessions: const <Session>[
          Session(
            id: 'race',
            type: SessionType.race,
            name: 'Race',
            status: SessionStatus.scheduled,
          ),
        ],
      ),
    ),
  ),
];

// --- Rendering ----------------------------------------------------------------

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

Future<void> _pumpHome(
  WidgetTester tester,
  _Config config, {
  HomeDashboardView? dashboard,
  Stream<HomeDashboardView?>? dashboardStream,
  Set<String> staleKeys = const <String>{},
  Set<String> unmaterializedKeys = const <String>{},
  bool failHome = false,
  DateTime? clock,
}) async {
  await pumpApp(
    tester,
    surfaceSize: Size(config.width, _surfaceHeight),
    locale: Locale(config.lang),
    textScale: config.scale,
    disableAnimations: true,
    clock: clock,
    deviceTimeZone: 'GMT',
    preferences: AppPreferences(
      language: AppPreferences.defaults.language,
      theme: config.theme,
      timeDisplay: AppPreferences.defaults.timeDisplay,
    ),
    syncMetadata: (String key) => unmaterializedKeys.contains(key)
        ? null
        : syncedMetadata(
            key,
            staleAfter: staleKeys.contains(key) ? DateTime.utc(2000) : null,
          ),
    repository: FakeRaceWeekendRepository(
      dashboard: dashboardStream == null ? dashboard : null,
      dashboardStream: dashboardStream,
      home: homeViewFixture(),
      calendar: (int season) => calendarFixture(season: season),
      grandPrix: (int season, int round) =>
          grandPrixDetailFixture(season, round),
    ),
  );
  if (failHome) {
    containerOf(tester)
        .read(appSyncStateProvider.notifier)
        .publish(
          const AppSyncCompleted(
            trigger: SyncTrigger.manual,
            outcomes: <ResourceSyncOutcome>[
              ResourceSyncOutcome(
                resourceKey: 'home:2026',
                kind: ResourceSyncOutcomeKind.failed,
                failure: ApiFailureKind.networkUnavailable,
              ),
            ],
          ),
        );
  }
  await tester.pumpAndSettle();
  expect(tester.takeException(), isNull);
}

/// The HomeScreen, cropped to its content (the shell's navigation excluded).
Future<ui.Image> _captureHome(WidgetTester tester) async {
  RenderObject? node = tester.renderObject(find.byType(HomeScreen));
  while (node != null && node is! RenderRepaintBoundary) {
    node = node.parent;
  }
  final RenderRepaintBoundary boundary = node! as RenderRepaintBoundary;
  final Offset origin = boundary.localToGlobal(Offset.zero);
  final Rect screen = tester.getRect(find.byType(HomeScreen));

  // Content bottom: the Explore strip when present, else the lowest text.
  double bottom = screen.top;
  final Finder strip = find.byType(HomeExploreStrip);
  if (strip.evaluate().isNotEmpty) {
    bottom = tester.getRect(strip).bottom + 24;
  } else {
    for (final Element e
        in find
            .descendant(
              of: find.byType(HomeScreen),
              matching: find.byType(Text),
            )
            .evaluate()) {
      final Rect r = tester.getRect(find.byWidget(e.widget));
      if (r.bottom > bottom) bottom = r.bottom;
    }
    bottom = (bottom + 240).clamp(screen.top, screen.bottom);
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

/// Lays [crops] side by side on a grey ground, top-aligned; nothing scaled.
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

void main() {
  testWidgets('staging-equivalent Home, paired with the Chrome references', (
    WidgetTester tester,
  ) async {
    await loadArchivo(tester);
    await _loadMaterialIcons(tester);
    for (final _Config config in _matrix) {
      await _pumpHome(
        tester,
        config,
        dashboard: _stagingDashboard(),
        clock: _stagingClock,
      );
      final ui.Image home = await _captureHome(tester);
      await _write(tester, home, 'home-${config.name}');
      final ui.Image? ref = await _readRef(
        tester,
        'ref-home-${config.theme.wire}-${config.lang}-${config.viewport}',
      );
      if (ref != null) {
        await _write(
          tester,
          await _compose(tester, <(ui.Image, Rect)>[
            (ref, _whole(ref)),
            (home, _whole(home)),
          ]),
          'cmp-home-${config.name}',
        );
      }
    }
  });

  for (final _State state in _states) {
    testWidgets('state: ${state.name}', (WidgetTester tester) async {
      await loadArchivo(tester);
      await _loadMaterialIcons(tester);
      final List<(ui.Image, Rect)> panels = <(ui.Image, Rect)>[];
      for (final _Config config in _statePanels) {
        await _pumpHome(
          tester,
          config,
          dashboard: state.dashboard?.call(),
          dashboardStream: state.dashboardStream?.call(),
          staleKeys: state.staleKeys,
          unmaterializedKeys: state.unmaterializedKeys,
          failHome: state.failHome,
        );
        final ui.Image image = await _captureHome(tester);
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
