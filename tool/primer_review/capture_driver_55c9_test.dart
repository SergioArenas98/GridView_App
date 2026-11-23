// Step 55C.9 review captures of the production Driver Detail (not goldens).
//
//   node tool/primer_review/capture_driver_55c9_refs.mjs   (Chrome references)
//   flutter test tool/primer_review/capture_driver_55c9_test.dart
//
// Output in build/primer-review/55c9/, every PNG at device pixel ratio 2 and
// never resized. The real DriverDetailScreen (router, Riverpod, repositories,
// l10n) is pushed above Home, as from any origin, on a surface tall enough for
// the whole profile, then cropped to the screen's content.
// - dd-<name>-<theme>-<lang>-<viewport>.png: the Flutter capture;
// - cmp-<name>-<theme>-<lang>-<viewport>.png: the Chrome reference (left)
//   next to it (right). Every value is a development test fixture
//   (`test/support/entity_fixtures.dart`), **not a real-world result**: the
//   default profile is the fixture's "Max Verstappen" identity with invented
//   statistics. State pairs put the reference's fixture frame next to the
//   whole Flutter screen rendered from a consistent profile;
// - state-<name>.png: Flutter-only states, four panels each (Dark EN 390
//   @100%, Dark ES 320 @200%, Light EN 390 @100%, Light ES 320 @200%). Every
//   name starting "Synthetic" is invented test data;
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
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/drivers/presentation/driver_detail_screen.dart';
import 'package:gridview/features/drivers/presentation/widgets/driver_detail_app_bar.dart';
import 'package:gridview/features/drivers/presentation/widgets/driver_stint_row.dart';
import 'package:gridview/features/shared/domain/entities/driver.dart';
import 'package:gridview/features/shared/domain/entities/entity_profile.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/media.dart';
import 'package:gridview/features/shared/domain/entities/standing.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/shared/domain/refresh_result.dart';

import '../../test/support/domain_fixtures.dart';
import '../../test/support/entity_fixtures.dart';
import '../../test/support/fake_entity_repository.dart';
import '../../test/support/media_fixtures.dart';
import '../../test/support/primer_fonts.dart';
import '../../test/support/router_harness.dart';

const double _dpr = 2;
const String _out = 'build/primer-review/55c9';
const double _gap = 24;
const double _surfaceHeight = 3000;

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

ResourceSyncState? _never(String key) => null;
ResourceSyncState? _stale(String key) =>
    syncedMetadata(key, staleAfter: DateTime.utc(2000));

Future<RefreshResult> _offline(String id, int season) async =>
    const RefreshFailure(ApiFailure(kind: ApiFailureKind.networkUnavailable));
Future<RefreshResult> _notFound(String id, int season) async =>
    const RefreshFailure(ApiFailure(kind: ApiFailureKind.notFound));

/// The test's spans under a clearly synthetic identity (the widget test
/// inherits the Verstappen identity defaults under another name; DRV-04).
DriverProfile _twoSpans(int s, String id) => driverProfileFixture(
  season: s,
  driverId: id,
  name: 'Synthetic Two-Span Driver',
  shortCode: 'SYN',
  permanentNumber: null,
  nationality: null,
  dateOfBirth: null,
  placeOfBirth: null,
  biography: null,
  participations: <DriverParticipation>[
    participation(
      season: s,
      driverId: id,
      constructorId: 'alpine',
      teamName: 'BWT Alpine Formula One Team',
      teamColor: '#0093CC',
      raceNumber: 43,
      startRound: 7,
    ),
    participation(
      season: s,
      driverId: id,
      constructorId: 'williams',
      teamName: 'Williams Racing',
      teamColor: '#005AFF',
      raceNumber: 43,
      endRound: 6,
      entryId: 'span-2',
    ),
  ],
  standing: DriverStanding(
    season: s,
    driverId: id,
    position: 18,
    points: 4.5,
    wins: 0,
  ),
);

/// States frame 8: no season race number, the permanent number on the board.
DriverProfile _permanent(int s, String id) => driverProfileFixture(
  season: s,
  driverId: id,
  participations: <DriverParticipation>[
    participation(
      season: s,
      driverId: id,
      constructorId: 'red-bull',
      teamName: 'Oracle Red Bull Racing',
    ),
  ],
  withStanding: false,
);

DriverProfile _unresolved(int s, String id) => driverProfileFixture(
  season: s,
  driverId: id,
  name: 'Synthetic Unaffiliated Entrant',
  shortCode: null,
  permanentNumber: null,
  nationality: null,
  dateOfBirth: null,
  placeOfBirth: null,
  biography: null,
  participations: <DriverParticipation>[
    participation(season: s, driverId: id, constructorId: 'not-synced-team'),
  ],
  withStanding: false,
);

DriverProfile _reserve(int s, String id) => driverProfileFixture(
  season: s,
  driverId: id,
  name: 'Synthetic Reserve Entrant',
  shortCode: null,
  permanentNumber: null,
  nationality: null,
  dateOfBirth: null,
  placeOfBirth: null,
  biography: null,
  participations: <DriverParticipation>[
    participation(
      season: s,
      driverId: id,
      constructorId: 'alpine',
      teamName: 'BWT Alpine Formula One Team',
      role: DriverRole.reserve,
    ),
  ],
  withStanding: false,
);

DriverProfile _unranked(int s, String id) => driverProfileFixture(
  season: s,
  driverId: id,
  name: 'Synthetic Zero Points',
  shortCode: 'ZER',
  permanentNumber: null,
  nationality: null,
  dateOfBirth: null,
  placeOfBirth: null,
  biography: null,
  participations: const <DriverParticipation>[],
  standing: DriverStanding(season: s, driverId: id, points: 0, wins: 0),
);

/// States frame 14: a number, no code, no nationality.
DriverProfile _numberOnly(int s, String id) => driverProfileFixture(
  season: s,
  driverId: id,
  name: 'Unaffiliated Entrant',
  shortCode: null,
  permanentNumber: null,
  nationality: null,
  dateOfBirth: null,
  placeOfBirth: null,
  biography: null,
  participations: <DriverParticipation>[
    participation(
      season: s,
      driverId: id,
      constructorId: 'synthetic-team',
      raceNumber: 55,
    ),
  ],
  withStanding: false,
);

/// States frame 15: no number, no code, no nationality.
DriverProfile _bare(int s, String id) => driverProfileFixture(
  season: s,
  driverId: id,
  name: 'Reserve Entrant',
  shortCode: null,
  permanentNumber: null,
  nationality: null,
  dateOfBirth: null,
  placeOfBirth: null,
  biography: null,
  participations: const <DriverParticipation>[],
  withStanding: false,
);

/// Long names everywhere (XS-14): synthetic.
DriverProfile _long(int s, String id) => driverProfileFixture(
  season: s,
  driverId: id,
  name: 'Synthetic Maximilian-Alexander Long-Surname Testdriver',
  shortCode: 'SYN',
  permanentNumber: 88,
  nationality: 'Synthetic Extraordinarily Long Nationality',
  placeOfBirth: 'Synthetic Municipality of the Very Long Place Name',
  participations: <DriverParticipation>[
    participation(
      season: s,
      driverId: id,
      constructorId: 'synthetic-team',
      teamName: 'Synthetic Extremely Long Constructor Name Racing Team',
      teamColor: '#FFFFFF',
      raceNumber: 88,
    ),
  ],
  standing: DriverStanding(
    season: s,
    driverId: id,
    position: 12,
    points: 1234.5,
    wins: 10,
    podiums: 100,
    provisional: true,
  ),
);

/// Missing optional facts: no biography, birth data, nationality, permanent
/// number or standing (the widget test's "Lando Norris" fields).
DriverProfile _missing(int s, String id) => driverProfileFixture(
  season: s,
  driverId: id,
  name: 'Synthetic Missing Facts',
  shortCode: 'SMF',
  biography: null,
  dateOfBirth: null,
  placeOfBirth: null,
  nationality: null,
  permanentNumber: null,
  withStanding: false,
);

/// The default profile with a driver-owned portrait reference (synthetic
/// fixture media; the approved inventory is empty).
DriverProfile _withMedia(int s, String id) {
  final DriverProfile p = driverProfileFixture(season: s, driverId: id);
  final Driver d = p.driver;
  return DriverProfile(
    driver: Driver(
      id: d.id,
      fullName: d.fullName,
      shortCode: d.shortCode,
      permanentNumber: d.permanentNumber,
      nationality: d.nationality,
      dateOfBirth: d.dateOfBirth,
      placeOfBirth: d.placeOfBirth,
      biography: d.biography,
      media: <MediaAsset>[portraitAsset(id: '$id-portrait-v1', owner: id)],
    ),
    season: p.season,
    participations: p.participations,
    standing: p.standing,
  );
}

class _Scenario {
  const _Scenario({
    this.profile,
    this.profileStream,
    this.metadata,
    this.refresh,
    this.focus,
    this.deepLink = false,
    this.currentSeason = 2026,
    this.mediaLoader = false,
  });

  final DriverProfile? Function(int season, String id)? profile;
  final Stream<DriverProfile?> Function(int season, String id)? profileStream;
  final ResourceSyncState? Function(String key)? metadata;
  final Future<RefreshResult> Function(String id, int season)? refresh;

  /// 'team', 'standings' or 'back'.
  final String? focus;
  final bool deepLink;
  final int? currentSeason;
  final bool mediaLoader;
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

Future<void> _pump(
  WidgetTester tester,
  _Config config,
  _Scenario s, {
  double? surfaceHeight,
}) async {
  FocusManager.instance.highlightStrategy = s.focus != null
      ? FocusHighlightStrategy.alwaysTraditional
      : FocusHighlightStrategy.automatic;
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.pump();
  final GoRouter router = await pumpApp(
    tester,
    initialLocation: s.deepLink ? '/drivers/max-verstappen' : '/',
    surfaceSize: Size(config.width, surfaceHeight ?? _surfaceHeight),
    locale: Locale(config.lang),
    textScale: config.scale,
    disableAnimations: true,
    currentSeason: s.currentSeason,
    preferences: AppPreferences.defaults.copyWith(theme: config.theme),
    syncMetadata: s.metadata,
    mediaLoader: s.mediaLoader ? FakeMediaImageLoader() : null,
    drivers: FakeDriverRepository(
      profile: s.profileStream == null
          ? (s.profile ??
                (int season, String id) =>
                    driverProfileFixture(season: season, driverId: id))
          : null,
      profileStream: s.profileStream,
      onRefreshDetail: s.refresh,
    ),
  );
  if (!s.deepLink) {
    // Opened from an origin, so the back action exists, as in the prototype.
    unawaited(router.push('/drivers/max-verstappen'));
    await tester.pumpAndSettle();
  }
  final Finder? target = switch (s.focus) {
    'team' => find.descendant(
      of: find.byType(DriverStintRow).first,
      matching: find.byType(GvPrimerFocusTarget),
    ),
    'standings' => find.descendant(
      of: find.byType(GvPrimerLinkRow),
      matching: find.byType(GvPrimerFocusTarget),
    ),
    'back' => find.byKey(const ValueKey<String>('driver-detail-back')),
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

/// The bottom of the screen's content: the last laid-out text, skeleton or
/// row, plus the page's 32px end.
double _contentBottom(WidgetTester tester) {
  final Rect screen = tester.getRect(find.byType(DriverDetailScreen));
  double bottom = screen.top;
  for (final Element e
      in find
          .descendant(
            of: find.byType(DriverDetailScreen),
            matching: find.byWidgetPredicate(
              (Widget w) =>
                  w is Text ||
                  w is GvPrimerSkeleton ||
                  w is GvPrimerLinkRow ||
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
  RenderObject? node = tester.renderObject(find.byType(DriverDetailScreen));
  while (node != null && node is! RenderRepaintBoundary) {
    node = node.parent;
  }
  final RenderRepaintBoundary boundary = node! as RenderRepaintBoundary;
  final Offset origin = boundary.localToGlobal(Offset.zero);
  final Rect screen = tester.getRect(find.byType(DriverDetailScreen));
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
  final double top = tester.getRect(find.byType(DriverDetailScreen)).top;
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
      '.dbar': boxes(find.byType(DriverDetailAppBar)),
      '.notice': boxes(find.byType(GvPrimerNotice)),
      '.dp': boxes(key('driver-plate')),
      '.dp__plate': boxes(key('driver-plate-board')),
      '.dp__fig': boxes(key('driver-plate-figure')),
      '.dp__code': boxes(key('driver-plate-code')),
      '.sec__title': boxes(find.byType(GvPrimerSectionTitle)),
      '.st': boxes(find.byType(DriverStintRow)),
      '.ch__main': boxes(find.byType(GvPrimerStatStrip)),
      '.ch__link': boxes(find.byType(GvPrimerLinkRow)),
      '.facts': boxes(find.byType(GvPrimerFactGrid)),
      '.skel span': boxes(find.byType(GvPrimerSkeleton)),
      '.btn': boxes(find.byType(GvPrimerButton)),
    },
  };
}

final Map<String, (_Scenario, List<_Config>)> _paired =
    <String, (_Scenario, List<_Config>)>{
      'index': (const _Scenario(), _all),
      'partial': (
        _Scenario(
          profile: (int s, String id) =>
              partialDriverProfileFixture(season: s, driverId: id),
          metadata: _never,
        ),
        _all,
      ),
      'focus-team': (const _Scenario(focus: 'team'), _pair),
      'focus-standings': (const _Scenario(focus: 'standings'), _pair),
      'focus-back': (const _Scenario(focus: 'back'), _pair),
      'frame-1': (
        _Scenario(
          profileStream: (int s, String id) =>
              const Stream<DriverProfile?>.empty(),
        ),
        _pair,
      ),
      'frame-2': (const _Scenario(currentSeason: null), _pair),
      'frame-3': (
        _Scenario(profile: (int s, String id) => null, refresh: _notFound),
        _pair,
      ),
      'frame-4': (
        _Scenario(profile: (int s, String id) => null, refresh: _offline),
        _pair,
      ),
      'frame-5': (
        _Scenario(
          profile: (int s, String id) =>
              partialDriverProfileFixture(season: s, driverId: id),
          refresh: _notFound,
        ),
        _pair,
      ),
      'frame-6': (const _Scenario(refresh: _offline), _pair),
      'frame-7': (const _Scenario(metadata: _stale), _pair),
      'frame-8': (const _Scenario(profile: _permanent), _pair),
      'frame-9': (const _Scenario(profile: _twoSpans), _pair),
      'frame-10': (const _Scenario(profile: _unresolved), _pair),
      'frame-11': (const _Scenario(profile: _reserve), _pair),
      'frame-12': (const _Scenario(profile: _unranked), _pair),
      'frame-14': (const _Scenario(profile: _numberOnly), _pair),
      'frame-15': (const _Scenario(profile: _bare), _pair),
    };

final Map<String, _Scenario> _states = <String, _Scenario>{
  'n2-failed-stale': const _Scenario(metadata: _stale, refresh: _offline),
  'failed-partial': _Scenario(
    profile: (int s, String id) =>
        partialDriverProfileFixture(season: s, driverId: id),
    metadata: _never,
    refresh: _offline,
  ),
  'offline-cached': const _Scenario(refresh: _offline),
  'long-names': const _Scenario(profile: _long),
  'missing-facts': const _Scenario(profile: _missing),
  'multi-span': const _Scenario(profile: _twoSpans),
  'unranked': const _Scenario(profile: _unranked),
  'media-pending': const _Scenario(profile: _withMedia),
  'media-failed': const _Scenario(profile: _withMedia, mediaLoader: true),
  'deep-link': const _Scenario(deepLink: true),
};

void main() {
  final Map<String, Object> geometry = <String, Object>{};

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
        await _write(tester, image, 'dd-${entry.key}-${config.name}');
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
