// Step 55C.7 / 55C.7.1 review captures of the production Explore (not
// goldens). 55C.7.1: the status scrolls with the rows (DD EF-1).
//
//   node tool/primer_review/capture_explore_55c7_refs.mjs   (Chrome references)
//   flutter test tool/primer_review/capture_explore_55c7_test.dart
//
// Output in build/primer-review/55c7/, every PNG at device pixel ratio 2 and
// never resized. The real ExploreScreen (router, Riverpod, repositories,
// l10n) is rendered on a surface tall enough for the whole collection, then
// cropped to the content (pinned header + rows); the shell's legacy
// navigation is cropped off.
// - ex-<name>-<theme>-<lang>-<viewport>.png: the Flutter capture;
// - cmp-<name>-<theme>-<lang>-<viewport>.png: the Chrome reference (left)
//   next to it (right). Whole-page pairs use the same development test
//   fixtures as the reference pages (`test/support/entity_fixtures.dart`:
//   **not real-world results**). State pairs put the reference's fixture
//   frame next to the whole Flutter screen rendered from the same fixture;
// - state-<name>.png: Flutter-only states, four panels each (Dark EN 390
//   @100%, Dark ES 320 @200%, Light EN 390 @100%, Light ES 320 @200%). The
//   long-name / missing-data roster is clearly synthetic test data;
// - metrics.md: pinned-header heights and the list window on the real
//   viewport sizes.
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
import 'package:gridview/features/explore/presentation/explore_screen.dart';
import 'package:gridview/features/explore/presentation/widgets/explore_entity_row.dart';
import 'package:gridview/features/explore/presentation/widgets/explore_header.dart';
import 'package:gridview/features/shared/domain/entities/media.dart';
import 'package:gridview/features/shared/domain/entities/season_card.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/sync/application/sync_providers.dart';
import 'package:gridview/features/sync/domain/app_sync_state.dart';
import 'package:gridview/features/sync/domain/sync_plan.dart';

import '../../test/support/domain_fixtures.dart';
import '../../test/support/entity_fixtures.dart';
import '../../test/support/fake_entity_repository.dart';
import '../../test/support/media_fixtures.dart';
import '../../test/support/primer_fonts.dart';
import '../../test/support/router_harness.dart';

const double _dpr = 2;
const String _out = 'build/primer-review/55c7';
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

// --- Data --------------------------------------------------------------------

/// `explore_widget_test.dart` `_longDrivers` (states frame 9): synthetic.
List<SeasonDriverCard> _longDrivers(int season) => <SeasonDriverCard>[
  for (int i = 0; i < 22; i++)
    driverCard(
      season: season,
      order: i,
      driverId: 'driver-${i + 1}',
      name: 'Driver ${i + 1}',
      raceNumber: i + 1,
      constructorId: 'team-${(i ~/ 2) + 1}',
      teamName: 'Team ${(i ~/ 2) + 1}',
      position: i + 1,
      points: (22 - i) * 10.0,
    ),
];

/// Clearly synthetic edge cases: very long names, missing affiliation,
/// nationality, number and standing, and team colours on both sides of the
/// 3:1 boundary. Not real people or teams.
List<SeasonDriverCard> _edgeDrivers(int season) => <SeasonDriverCard>[
  driverCard(
    season: season,
    order: 0,
    driverId: 'synthetic-long',
    name: 'Synthetic Maximilian-Alexander Long-Surname Testdriver',
    shortCode: 'SYN',
    raceNumber: 88,
    nationality: 'Synthetic Nationality',
    constructorId: 'synthetic-team',
    teamName: 'Synthetic Extremely Long Constructor Name Racing Team',
    teamColor: '#FFFFFF',
    position: 12,
    points: 1234.5,
  ),
  driverCard(
    season: season,
    order: 1,
    driverId: 'synthetic-dark',
    name: 'Synthetic Dark Colour',
    raceNumber: 7,
    constructorId: 'synthetic-dark-team',
    teamName: 'Synthetic Dark Team',
    teamColor: '#101010',
    points: 0,
  ),
  driverCard(
    season: season,
    order: 2,
    driverId: 'synthetic-bare',
    name: 'Synthetic No Data',
  ),
];

List<SeasonTeamCard> _edgeTeams(int season) => <SeasonTeamCard>[
  teamCard(
    season: season,
    order: 0,
    constructorId: 'synthetic-long',
    stableName: 'Synthetic',
    seasonName: 'Synthetic Extremely Long Constructor Name Racing Team',
    teamColor: '#FFFFFF',
    powerUnit: 'Synthetic Power Unit Supplier',
    position: 10,
    points: 3,
    lineup: <TeamLineupMember>[
      lineupMember(driverId: 's1', name: 'Synthetic One', shortCode: 'SYA'),
      lineupMember(driverId: 's2', name: 'Synthetic Two', shortCode: 'SYB'),
    ],
  ),
  teamCard(
    season: season,
    order: 1,
    constructorId: 'synthetic-bare',
    stableName: 'Synthetic Bare Team',
  ),
];

List<SeasonCircuitCard> _edgeCircuits(int season) => <SeasonCircuitCard>[
  circuitCard(
    season: season,
    order: 1,
    circuitId: 'synthetic-long',
    name: 'Synthetic International Autodrome of the Very Long Circuit Name',
    locality: 'Synthetic Locality With A Long Name',
    country: 'Synthetic Country',
    lengthMeters: 12345,
    related: relatedGrandPrix(
      season: season,
      round: 1,
      name: 'Synthetic Grand Prix of the Long Event Name',
      startDate: '2026-09-27',
    ),
  ),
  circuitCard(
    season: season,
    order: 2,
    circuitId: 'synthetic-bare',
    name: 'Synthetic Circuit Without Location',
  ),
];

/// One card with a media reference: the whole list reserves the slot, and
/// with no loader installed every slot shows the existing placeholder.
List<SeasonDriverCard> _mediaDrivers(int season) => <SeasonDriverCard>[
  for (final (int i, SeasonDriverCard c) in seasonDriverCardsFixture(
    season: season,
  ).indexed)
    i == 0
        ? driverCard(
            season: season,
            order: c.orderIndex,
            driverId: c.driverId,
            name: c.name,
            shortCode: c.shortCode,
            raceNumber: c.raceNumber,
            nationality: c.nationality,
            constructorId: c.constructorId,
            teamName: c.teamName,
            teamColor: c.teamColor,
            position: c.position,
            points: c.points,
            media: entityMediaOf(<MediaAsset>[
              portraitAsset(id: '${c.driverId}-portrait-v1', owner: c.driverId),
            ]),
          )
        : c,
];

/// Only bootstrap materialized the collections: no resource claims a time.
ResourceSyncState? _bootstrapOnly(String key) =>
    key == 'bootstrap' ? syncedMetadata(key) : null;

/// Every resource with the fixture's own check time (09:05 UTC).
ResourceSyncState? _checked(String key) =>
    syncedMetadata(key, lastSuccessAt: DateTime.utc(2026, 7, 18, 9, 5));

ResourceSyncState? _stale(String key) =>
    syncedMetadata(key, staleAfter: DateTime.utc(2000));

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

enum _Sync { none, refreshing, failed, settled }

class _Scenario {
  const _Scenario({
    this.location = '/explore',
    this.drivers,
    this.teams,
    this.circuits,
    this.driversStream,
    this.metadata,
    this.sync = _Sync.none,
    this.focus,
    this.currentSeason = 2026,
  });

  final String location;
  final List<SeasonDriverCard> Function(int season)? drivers;
  final List<SeasonTeamCard> Function(int season)? teams;
  final List<SeasonCircuitCard> Function(int season)? circuits;
  final Stream<List<SeasonDriverCard>> Function(int season)? driversStream;
  final ResourceSyncState? Function(String key)? metadata;
  final _Sync sync;
  final int? currentSeason;

  /// 'seg' focuses the unselected "Teams" option, 'row' the first row.
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
  // A fresh tree and provider container for every scenario.
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.pump();
  await pumpApp(
    tester,
    initialLocation: s.location,
    surfaceSize: Size(config.width, surfaceHeight ?? _surfaceHeight),
    locale: Locale(config.lang),
    textScale: config.scale,
    disableAnimations: true,
    currentSeason: s.currentSeason,
    preferences: AppPreferences.defaults.copyWith(theme: config.theme),
    syncMetadata: s.metadata,
    drivers: FakeDriverRepository(
      cards: s.driversStream == null
          ? (s.drivers ??
                (int season) => seasonDriverCardsFixture(season: season))
          : null,
      cardsStream: s.driversStream,
    ),
    constructors: FakeConstructorRepository(
      cards: s.teams ?? (int season) => seasonTeamCardsFixture(season: season),
    ),
    circuits: FakeCircuitRepository(
      cards:
          s.circuits ??
          (int season) => seasonCircuitCardsFixture(season: season),
    ),
  );
  final AppSyncState? sync = switch (s.sync) {
    _Sync.none => null,
    _Sync.refreshing => const AppSyncRunning(trigger: SyncTrigger.manual),
    _Sync.failed => const AppSyncCompleted(
      trigger: SyncTrigger.manual,
      outcomes: <ResourceSyncOutcome>[
        ResourceSyncOutcome(
          resourceKey: 'drivers:2026',
          kind: ResourceSyncOutcomeKind.failed,
          failure: ApiFailureKind.networkUnavailable,
        ),
      ],
    ),
    _Sync.settled => const AppSyncCompleted(
      trigger: SyncTrigger.manual,
      outcomes: <ResourceSyncOutcome>[],
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
        matching: find.text(config.lang == 'es' ? 'Equipos' : 'Teams'),
      ),
      matching: find.byType(GvPrimerFocusTarget),
    ),
    'row' => find.descendant(
      of: find.byType(ExploreEntityRow).first,
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

/// The ExploreScreen, cropped to its content (the navigation excluded).
Future<ui.Image> _capture(WidgetTester tester) async {
  RenderObject? node = tester.renderObject(find.byType(ExploreScreen));
  while (node != null && node is! RenderRepaintBoundary) {
    node = node.parent;
  }
  final RenderRepaintBoundary boundary = node! as RenderRepaintBoundary;
  final Offset origin = boundary.localToGlobal(Offset.zero);
  final Rect screen = tester.getRect(find.byType(ExploreScreen));

  double bottom = screen.top;
  final Finder rows = find.byType(ExploreEntityRow);
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
              of: find.byType(ExploreScreen),
              matching: find.byWidgetPredicate(
                (Widget w) => w is Text || w is GvPrimerSkeleton,
              ),
            )
            .evaluate()) {
      final RenderBox box = e.renderObject! as RenderBox;
      final double b = box.localToGlobal(Offset(0, box.size.height)).dy;
      if (b > bottom) bottom = b;
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
  // The reference pages show no check time; a bootstrap-materialized
  // collection claims none either, so these pairs compare like for like.
  'drivers': (const _Scenario(metadata: _bootstrapOnly), _all),
  'teams': (
    const _Scenario(location: '/explore/teams', metadata: _bootstrapOnly),
    _all,
  ),
  'circuits': (
    const _Scenario(location: '/explore/circuits', metadata: _bootstrapOnly),
    _all,
  ),
  'focus-seg': (const _Scenario(focus: 'seg', metadata: _bootstrapOnly), _pair),
  'focus-row': (const _Scenario(focus: 'row', metadata: _bootstrapOnly), _pair),
  // State frames: the reference's fixture frame, then the whole screen.
  'frame-1': (
    const _Scenario(sync: _Sync.refreshing, metadata: _bootstrapOnly),
    _pair,
  ),
  'frame-2': (
    const _Scenario(sync: _Sync.failed, metadata: _bootstrapOnly),
    _pair,
  ),
  'frame-3': (
    _Scenario(
      drivers: (int season) => const <SeasonDriverCard>[],
      metadata: _bootstrapOnly,
    ),
    _pair,
  ),
  'frame-6': (
    _Scenario(
      drivers: (int season) => const <SeasonDriverCard>[],
      metadata: (String key) => null,
      sync: _Sync.failed,
    ),
    _pair,
  ),
  'frame-7': (const _Scenario(currentSeason: null, sync: _Sync.settled), _pair),
  'frame-8': (
    _Scenario(
      driversStream: (int season) =>
          const Stream<List<SeasonDriverCard>>.empty(),
    ),
    _pair,
  ),
  'frame-9': (
    const _Scenario(drivers: _longDrivers, metadata: _bootstrapOnly),
    _pair,
  ),
};

final Map<String, _Scenario> _states = <String, _Scenario>{
  'caption': const _Scenario(metadata: _checked),
  'refreshing-caption': const _Scenario(
    metadata: _checked,
    sync: _Sync.refreshing,
  ),
  'failed-caption': const _Scenario(metadata: _checked, sync: _Sync.failed),
  'loading': _Scenario(
    driversStream: (int season) => const Stream<List<SeasonDriverCard>>.empty(),
  ),
  'stale': const _Scenario(metadata: _stale),
  'n2-failed-stale': const _Scenario(metadata: _stale, sync: _Sync.failed),
  'refreshing-stale': const _Scenario(metadata: _stale, sync: _Sync.refreshing),
  'edge-drivers': const _Scenario(drivers: _edgeDrivers),
  'edge-teams': const _Scenario(location: '/explore/teams', teams: _edgeTeams),
  'edge-circuits': const _Scenario(
    location: '/explore/circuits',
    circuits: _edgeCircuits,
  ),
  'media-column': const _Scenario(drivers: _mediaDrivers),
  'empty-teams': _Scenario(
    location: '/explore/teams',
    teams: (int season) => const <SeasonTeamCard>[],
  ),
};

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
  final double header = h(find.byType(ExploreHeader));
  final double bar = h(find.byType(ExploreSelectorBar));
  final double status = h(find.byKey(const ValueKey<String>('explore-status')));
  final double nav = h(find.byType(GvPrimerBottomNav));
  final double list = h(find.byType(Scrollable).last);
  final double vh = config.height;
  String pc(double v) => '${(v / vh * 100).toStringAsFixed(1)}%';
  return '| $name | ${config.name} | ${header.toStringAsFixed(1)} '
      '(${pc(header)}) | ${bar.toStringAsFixed(1)} | '
      '${status.toStringAsFixed(1)} | ${nav.toStringAsFixed(1)} | '
      '${list.toStringAsFixed(1)} (${pc(list)}) |';
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
        await _write(tester, image, 'ex-${entry.key}-${config.name}');
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
      '# Step 55C.7.1 Explore header metrics (flutter_tester, insets 0)',
      '',
      'Heights in logical px. Header = the pinned ExploreHeader (title row, '
          'season, selector bar and its hairline). Status = the selected '
          "collection's caption, progress line and notices, which scroll with "
          'its rows (0 when absent). List = the scrollable viewport above the '
          'legacy navigation, which the status shares with the rows. '
          'Percentages are of the viewport height.',
      '',
      '| Scenario | Config | Header | Selector bar | Status | Legacy nav '
          '| List viewport |',
      '|---|---|---|---|---|---|---|',
    ];
    final Map<String, _Scenario> measured = <String, _Scenario>{
      'drivers (no status)': _paired['drivers']!.$1,
      'refreshing': _paired['frame-1']!.$1,
      'failed': _paired['frame-2']!.$1,
      'stale': _states['stale']!,
      'n2': _states['n2-failed-stale']!,
      'refreshing + stale': _states['refreshing-stale']!,
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
