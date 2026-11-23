// Step 55C.5 review captures of the production Standings (not goldens).
//
//   node tool/primer_review/capture_standings_55c5_refs.mjs   (Chrome references)
//   flutter test tool/primer_review/capture_standings_55c5_test.dart
//
// Output in build/primer-review/55c5/, every PNG at device pixel ratio 2 and
// never resized. The real StandingsScreen (router, Riverpod, repositories,
// l10n) is rendered on a surface tall enough for the whole table, then cropped
// to the content (pinned header + scrolling table); the shell's legacy
// navigation is cropped off.
// - st-<name>-<theme>-<lang>-<viewport>.png: the Flutter capture;
// - cmp-<name>-<theme>-<lang>-<viewport>.png: the Chrome reference (left) next
//   to it (right). Whole-page pairs (index, constructors, focus-seg,
//   focus-row) mirror the frozen staging scenario of the reference pages
//   (`standings/README.md`: five drivers, one constructor, no check time, no
//   team colour; a bootstrap-materialized table, which claims no check time).
//   State pairs put the reference's fixture frame next to the whole Flutter
//   screen rendered from the same test fixture;
// - state-<name>.png: Flutter-only states, four panels each (Dark EN 390 @100%,
//   Dark ES 320 @200%, Light EN 390 @100%, Light ES 320 @200%);
// - metrics.md: pinned-header and status-block heights, and the content
//   window, measured on the real viewport sizes.
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
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/shared/domain/entities/standing_entry.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/standings/presentation/standings_screen.dart';
import 'package:gridview/features/standings/presentation/widgets/standings_header.dart';
import 'package:gridview/features/sync/application/sync_providers.dart';
import 'package:gridview/features/sync/domain/app_sync_state.dart';
import 'package:gridview/features/sync/domain/sync_plan.dart';

import '../../test/support/domain_fixtures.dart';
import '../../test/support/fake_repository.dart';
import '../../test/support/primer_fonts.dart';
import '../../test/support/router_harness.dart';

const double _dpr = 2;
const String _out = 'build/primer-review/55c5';
const double _gap = 24;
const double _surfaceHeight = 4000;

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

// --- Data --------------------------------------------------------------------

/// The frozen staging values of the reference pages (`standings/README.md`,
/// "Main pages"): not real-world results, no team colour, no provisional flag.
List<DriverStandingEntry> _stagingDrivers(int season) => <DriverStandingEntry>[
  driverStandingEntry(
    order: 0,
    position: 1,
    driverId: 'lando-norris',
    driverName: 'Lando Norris',
    constructorId: 'mclaren',
    constructorName: 'McLaren',
    points: 120,
    wins: 3,
  ),
  driverStandingEntry(
    order: 1,
    position: 2,
    driverId: 'alexander-albon',
    driverName: 'Alexander Albon',
    points: 64,
    wins: 1,
  ),
  driverStandingEntry(
    order: 2,
    position: 3,
    driverId: 'fernando-alonso',
    driverName: 'Fernando Alonso',
    constructorId: 'mercedes',
    constructorName: 'Mercedes',
    points: 40,
    wins: 0,
  ),
  driverStandingEntry(
    order: 3,
    position: 4,
    driverId: 'andrea-kimi-antonelli',
    driverName: 'Andrea Kimi Antonelli',
    constructorId: 'alpine',
    constructorName: 'Alpine',
    points: 7,
    wins: 0,
  ),
  driverStandingEntry(
    order: 4,
    position: 5,
    driverId: 'paul-aron',
    driverName: 'Paul Aron',
    constructorId: 'alpine',
    constructorName: 'Alpine',
    points: 7,
    wins: 0,
  ),
];

List<ConstructorStandingEntry> _stagingConstructors(int season) =>
    <ConstructorStandingEntry>[
      constructorStandingEntry(
        order: 0,
        position: 1,
        constructorId: 'mclaren',
        seasonName: 'McLaren',
        points: 150,
      ),
    ];

/// `standings_widget_test.dart` 'several confirmed leaders are announced as
/// tied' (state frame 2).
List<DriverStandingEntry> _tied(int season) => <DriverStandingEntry>[
  for (final (int i, String name) in <String>['Tied A', 'Tied B'].indexed)
    driverStandingEntry(
      order: i,
      position: 1,
      driverId: 'tied-$i',
      driverName: name,
      points: 100,
    ),
];

/// 'rows that all agree…' / 'disagreeing rows…' (state frames 7 and 8).
List<DriverStandingEntry> _provisional({required bool mixed}) =>
    <DriverStandingEntry>[
      driverStandingEntry(
        order: 0,
        position: 1,
        driverId: 'a',
        driverName: 'Row A',
        points: 10,
        provisional: true,
      ),
      driverStandingEntry(
        order: 1,
        position: 2,
        driverId: 'b',
        driverName: 'Row B',
        points: 5,
        provisional: !mixed,
      ),
    ];

/// The test fixture's own check time ("the selected table's own update time is
/// shown": 09:05 UTC), the time state frames 10 and 11 show.
final DateTime _fixtureCheck = DateTime.utc(2026, 7, 18, 9, 5);

ResourceSyncState? _bootstrapOnly(String key) =>
    key.startsWith('standings:') ? null : syncedMetadata(key);

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

enum _Sync { none, refreshing, failed }

class _Scenario {
  const _Scenario({
    this.location = '/standings',
    this.drivers,
    this.constructors,
    this.driversStream,
    this.metadata,
    this.sync = _Sync.none,
    this.focus,
  });

  final String location;
  final List<DriverStandingEntry> Function(int season)? drivers;
  final List<ConstructorStandingEntry> Function(int season)? constructors;
  final Stream<List<DriverStandingEntry>> Function(int season)? driversStream;
  final ResourceSyncState? Function(String key)? metadata;
  final _Sync sync;

  /// 'seg' focuses the unselected option, 'row' the first leader row.
  final String? focus;
}

Future<void> _pump(
  WidgetTester tester,
  _Config config,
  _Scenario s, {
  double? surfaceHeight,
}) async {
  FocusManager.instance.highlightStrategy = s.focus != null
      ? FocusHighlightStrategy.alwaysTraditional
      : FocusHighlightStrategy.automatic;
  // A fresh tree and provider container for every scenario: nothing (sync
  // state, selection, scroll offsets) carries over from the previous pump.
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.pump();
  await pumpApp(
    tester,
    initialLocation: s.location,
    surfaceSize: Size(config.width, surfaceHeight ?? _surfaceHeight),
    locale: Locale(config.lang),
    textScale: config.scale,
    disableAnimations: true,
    preferences: AppPreferences.defaults.copyWith(theme: config.theme),
    syncMetadata: s.metadata,
    standings: FakeStandingsRepository(
      drivers: s.driversStream == null
          ? (s.drivers ?? (int season) => driverStandingsFixture())
          : null,
      driversStream: s.driversStream,
      constructors:
          s.constructors ?? (int season) => constructorStandingsFixture(),
    ),
  );
  final AppSyncState? sync = switch (s.sync) {
    _Sync.none => null,
    _Sync.refreshing => const AppSyncRunning(trigger: SyncTrigger.manual),
    _Sync.failed => const AppSyncCompleted(
      trigger: SyncTrigger.manual,
      outcomes: <ResourceSyncOutcome>[
        ResourceSyncOutcome(
          resourceKey: 'standings:drivers:2026',
          kind: ResourceSyncOutcomeKind.failed,
          failure: ApiFailureKind.networkUnavailable,
        ),
      ],
    ),
  };
  if (sync != null) {
    containerOf(tester).read(appSyncStateProvider.notifier).publish(sync);
  }
  await tester.pumpAndSettle();
  final Finder? target = switch (s.focus) {
    'seg' => find.ancestor(
      of: find.descendant(
        of: find.byType(GvPrimerSegmentedControl),
        matching: find.text(
          config.lang == 'es' ? 'Constructores' : 'Constructors',
        ),
      ),
      matching: find.byType(GvPrimerFocusTarget),
    ),
    'row' => find.descendant(
      of: find.byWidgetPredicate(
        (Widget w) => w is GvPrimerStandingsRow && w.leaderLabel != null,
      ),
      matching: find.byType(GvPrimerFocusTarget),
    ),
    _ => null,
  };
  if (target != null) {
    Focus.of(
      tester.element(
        find
            .descendant(
              of: target.first,
              matching: find.byType(GestureDetector),
            )
            .first,
      ),
    ).requestFocus();
    await tester.pumpAndSettle();
  }
  expect(tester.takeException(), isNull);
}

/// The StandingsScreen, cropped to its content (the navigation excluded).
Future<ui.Image> _capture(WidgetTester tester) async {
  RenderObject? node = tester.renderObject(find.byType(StandingsScreen));
  while (node != null && node is! RenderRepaintBoundary) {
    node = node.parent;
  }
  final RenderRepaintBoundary boundary = node! as RenderRepaintBoundary;
  final Offset origin = boundary.localToGlobal(Offset.zero);
  final Rect screen = tester.getRect(find.byType(StandingsScreen));

  double bottom = screen.top;
  final Finder rows = find.byType(GvPrimerStandingsRow);
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
              of: find.byType(StandingsScreen),
              matching: find.byType(Text),
            )
            .evaluate()) {
      final Rect r = tester.getRect(find.byWidget(e.widget));
      if (r.bottom > bottom) bottom = r.bottom;
    }
    bottom = (bottom + 120).clamp(screen.top, screen.bottom);
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

// --- Scenarios ---------------------------------------------------------------

final Map<String, (_Scenario, List<_Config>)>
_paired = <String, (_Scenario, List<_Config>)>{
  'index': (
    const _Scenario(
      drivers: _stagingDrivers,
      constructors: _stagingConstructors,
      metadata: _bootstrapOnly,
    ),
    _all,
  ),
  'constructors': (
    const _Scenario(
      location: '/standings/constructors/2026',
      drivers: _stagingDrivers,
      constructors: _stagingConstructors,
      metadata: _bootstrapOnly,
    ),
    _all,
  ),
  'focus-seg': (
    const _Scenario(
      drivers: _stagingDrivers,
      constructors: _stagingConstructors,
      metadata: _bootstrapOnly,
      focus: 'seg',
    ),
    _pair,
  ),
  'focus-row': (
    const _Scenario(
      drivers: _stagingDrivers,
      constructors: _stagingConstructors,
      metadata: _bootstrapOnly,
      focus: 'row',
    ),
    _pair,
  ),
  // State frames: the reference's fixture frame, then the whole screen.
  'frame-2': (const _Scenario(drivers: _tied, metadata: _bootstrapOnly), _pair),
  'frame-7': (
    _Scenario(
      drivers: (int season) => _provisional(mixed: false),
      metadata: _bootstrapOnly,
    ),
    _pair,
  ),
  'frame-8': (
    _Scenario(
      drivers: (int season) => _provisional(mixed: true),
      metadata: _bootstrapOnly,
    ),
    _pair,
  ),
  'frame-9': (
    _Scenario(
      metadata: (String key) =>
          syncedMetadata(key, lastSuccessAt: _fixtureCheck),
      sync: _Sync.refreshing,
    ),
    _pair,
  ),
  'frame-10': (
    _Scenario(
      metadata: (String key) => syncedMetadata(
        key,
        lastSuccessAt: _fixtureCheck,
        staleAfter: DateTime.utc(2000),
      ),
    ),
    _pair,
  ),
  'frame-11': (
    _Scenario(
      metadata: (String key) =>
          syncedMetadata(key, lastSuccessAt: _fixtureCheck),
      sync: _Sync.failed,
    ),
    _pair,
  ),
};

final Map<String, _Scenario> _states = <String, _Scenario>{
  // A populated table with a genuine fixture-supplied lastSuccessAt.
  'caption': _Scenario(
    metadata: (String key) => syncedMetadata(key, lastSuccessAt: _fixtureCheck),
  ),
  'refreshing': _Scenario(
    metadata: (String key) => syncedMetadata(key, lastSuccessAt: _fixtureCheck),
    sync: _Sync.refreshing,
  ),
  'failed': _Scenario(
    metadata: (String key) => syncedMetadata(key, lastSuccessAt: _fixtureCheck),
    sync: _Sync.failed,
  ),
  'n2-failed-stale': _Scenario(
    metadata: (String key) => syncedMetadata(
      key,
      lastSuccessAt: _fixtureCheck,
      staleAfter: DateTime.utc(2000),
    ),
    sync: _Sync.failed,
  ),
  'constructors-fixture': _Scenario(
    location: '/standings/constructors/2026',
    metadata: (String key) => syncedMetadata(key, lastSuccessAt: _fixtureCheck),
  ),
  'empty': _Scenario(
    drivers: (int season) => const <DriverStandingEntry>[],
    metadata: syncedMetadataDefault,
  ),
  'first-load-failure': _Scenario(
    drivers: (int season) => const <DriverStandingEntry>[],
    metadata: (String key) => null,
    sync: _Sync.failed,
  ),
  'loading': _Scenario(
    driversStream: (int season) =>
        const Stream<List<DriverStandingEntry>>.empty(),
  ),
};

ResourceSyncState? syncedMetadataDefault(String key) => syncedMetadata(key);

// --- Metrics -----------------------------------------------------------------

Future<String> _metricsRow(
  WidgetTester tester,
  _Config config,
  String name,
  _Scenario s,
) async {
  await _pump(tester, config, s, surfaceHeight: config.height);
  double h(Finder f) =>
      f.evaluate().isEmpty ? 0 : tester.getSize(f.first).height;
  final double header = h(find.byType(StandingsHeader));
  final double bar = h(find.byType(StandingsSelectorBar));
  final double status = h(
    find.byKey(const ValueKey<String>('standings-status')),
  );
  final double nav = h(find.byType(GvPrimerBottomNav));
  final double list = h(find.byType(Scrollable).last);
  final double vh = config.height;
  String pc(double v) => '${(v / vh * 100).toStringAsFixed(1)}%';
  return '| $name | ${config.name} | ${header.toStringAsFixed(1)} (${pc(header)}) '
      '| ${bar.toStringAsFixed(1)} | ${status.toStringAsFixed(1)} '
      '| ${(header + status).toStringAsFixed(1)} (${pc(header + status)}) '
      '| ${nav.toStringAsFixed(1)} | ${list.toStringAsFixed(1)} (${pc(list)}) |';
}

void main() {
  for (final MapEntry<String, (_Scenario, List<_Config>)> entry
      in _paired.entries) {
    testWidgets('paired: ${entry.key}', (WidgetTester tester) async {
      await loadArchivo(tester);
      await _loadMaterialIcons(tester);
      final (_Scenario scenario, List<_Config> configs) = entry.value;
      for (final _Config config in configs) {
        await _pump(tester, config, scenario);
        final ui.Image image = await _capture(tester);
        await _write(tester, image, 'st-${entry.key}-${config.name}');
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

  testWidgets('metrics', (WidgetTester tester) async {
    await loadArchivo(tester);
    await _loadMaterialIcons(tester);
    final List<String> lines = <String>[
      '# Step 55C.5 Standings header metrics (flutter_tester, insets 0)',
      '',
      'Heights in logical px. Header = the pinned StandingsHeader (title row, '
          'season, selector bar with its hairline). Status = the scrolling '
          'status block of the selected table (0 when absent). "If pinned" = '
          'header + status, the cost of pinning the status as the prototype '
          'did. List = the scrollable viewport above the legacy navigation. '
          'Percentages are of the viewport height.',
      '',
      '| Scenario | Config | Header | Selector bar | Status | If pinned '
          '| Legacy nav | List viewport |',
      '|---|---|---|---|---|---|---|---|',
    ];
    final Map<String, _Scenario> measured = <String, _Scenario>{
      'index (no status)': _paired['index']!.$1,
      'caption': _states['caption']!,
      'refreshing': _states['refreshing']!,
      'stale + caption': _paired['frame-10']!.$1,
      'n2 + caption': _states['n2-failed-stale']!,
      'provisional (uniform)': _paired['frame-7']!.$1,
    };
    for (final _Config config in _all) {
      for (final MapEntry<String, _Scenario> m in measured.entries) {
        lines.add(await _metricsRow(tester, config, m.key, m.value));
      }
    }
    File('$_out/metrics.md')
      ..createSync(recursive: true)
      ..writeAsStringSync('${lines.join('\n')}\n');
  });
}
