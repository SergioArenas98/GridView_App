// Step 55C.3 review captures of the two corrected Home sections (not
// goldens).
//
//   node tool/primer_review/capture_home_55c3_refs.mjs   (Chrome references)
//   flutter test tool/primer_review/capture_home_55c3_test.dart
//
// Output in build/primer-review/55c3/, every PNG at device pixel ratio 2 and
// never resized. The real HomeScreen renders the 55C.1 staging-equivalent
// fixture (Qatar R22 completed, final classification, Norris / McLaren) with
// the device clock pinned to GMT; each section is cropped to the full width
// and its own height plus 16px above and below:
// - home-<section>-<theme>-<lang>-<viewport>.png: Flutter (`result`: the
//   latest-result section, single "Final" chip; `explore`: the strip with the
//   driver / team / circuit pictograms);
// - cmp-<section>-<theme>-<lang>-<viewport>.png: the Chrome reference (left)
//   next to Flutter (right);
// - state-result-kept-chips.png: pairings that keep both chips (completed +
//   provisional, unknown event + final), Dark/Light × EN 390 @100% and ES
//   320 @200%.
// Rendered by the flutter_tester engine; not device validation.
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
const String _out = 'build/primer-review/55c3';
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

HomeDashboardView _stagingDashboard({
  EventStatus latestStatus = EventStatus.completed,
  ResultStatus resultStatus = ResultStatus.finalResult,
}) => HomeDashboardView(
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
    status: latestStatus,
    hasResults: true,
    circuit: const Circuit(id: 'lusail', name: 'Lusail International Circuit'),
  ),
  latestRaceResult: raceResultFixture(
    sessionType: SessionType.race,
    round: 22,
    status: resultStatus,
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

/// [finder]'s full-width band (its own height plus 16px above and below).
Future<(ui.Image, Rect)> _crop(WidgetTester tester, Finder finder) async {
  RenderObject? node = tester.renderObject(find.byType(HomeScreen));
  while (node != null && node is! RenderRepaintBoundary) {
    node = node.parent;
  }
  final RenderRepaintBoundary boundary = node! as RenderRepaintBoundary;
  final Offset origin = boundary.localToGlobal(Offset.zero);
  final Rect screen = tester.getRect(find.byType(HomeScreen));
  final Rect section = tester.getRect(finder);
  late ui.Image full;
  await tester.runAsync(() async {
    full = await boundary.toImage(pixelRatio: _dpr);
  });
  return (
    full,
    Rect.fromLTRB(
      (screen.left - origin.dx) * _dpr,
      (section.top - 16 - origin.dy) * _dpr,
      (screen.right - origin.dx) * _dpr,
      (section.bottom + 16 - origin.dy) * _dpr,
    ),
  );
}

final Finder _result = find.byKey(const ValueKey<String>('home-latest-result'));
final Finder _explore = find.byType(HomeExploreStrip);

void main() {
  testWidgets('corrected sections, paired with the Chrome references', (
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
      for (final (String name, Finder finder) in <(String, Finder)>[
        ('result', _result),
        ('explore', _explore),
      ]) {
        final (ui.Image image, Rect crop) = await _crop(tester, finder);
        await _write(
          tester,
          await _compose(tester, <(ui.Image, Rect)>[(image, crop)]),
          'home-$name-${config.name}',
        );
        final ui.Image? ref = await _readRef(
          tester,
          'ref-$name-${config.name}',
        );
        if (ref != null) {
          await _write(
            tester,
            await _compose(tester, <(ui.Image, Rect)>[
              (ref, _whole(ref)),
              (image, crop),
            ]),
            'cmp-$name-${config.name}',
          );
        }
      }
    }
  });

  testWidgets('pairings that keep both chips', (WidgetTester tester) async {
    await loadArchivo(tester);
    await _loadMaterialIcons(tester);
    final List<(ui.Image, Rect)> panels = <(ui.Image, Rect)>[];
    for (final HomeDashboardView Function() dashboard
        in <HomeDashboardView Function()>[
          () => _stagingDashboard(resultStatus: ResultStatus.provisional),
          () => _stagingDashboard(latestStatus: EventStatus.unknown),
        ]) {
      for (final _Config config in _statePanels) {
        await _pumpHome(
          tester,
          config,
          dashboard: dashboard(),
          clock: _stagingClock,
        );
        panels.add(await _crop(tester, _result));
      }
    }
    await _write(
      tester,
      await _compose(tester, panels),
      'state-result-kept-chips',
    );
  });
}
