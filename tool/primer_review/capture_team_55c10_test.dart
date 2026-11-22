// Step 55C.10 review captures of the production Team Detail (not goldens).
//
//   node tool/primer_review/capture_team_55c10_refs.mjs   (Chrome references)
//   flutter test tool/primer_review/capture_team_55c10_test.dart
//
// Output in build/primer-review/55c10/, every PNG at device pixel ratio 2 and
// never resized. The real ConstructorDetailScreen (router, Riverpod,
// repositories, l10n) is pushed above Home, as from any origin, on a surface
// tall enough for the whole profile, then cropped to the screen's content.
// - td-<name>-<theme>-<lang>-<viewport>.png: the Flutter capture;
// - cmp-<name>-<theme>-<lang>-<viewport>.png: the Chrome reference (left)
//   next to it (right). Every value is a development test fixture
//   (`test/support/entity_fixtures.dart`), **not a real-world result**. The
//   line-up is supplied in the read model's roster order (numbered first,
//   race number, name, start round), as the DAO delivers it and the
//   prototype shows it; the fake repository does not sort. State pairs put
//   the reference's fixture frame next to the whole Flutter screen rendered
//   from a consistent profile;
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
import 'package:gridview/features/constructors/presentation/constructor_detail_screen.dart';
import 'package:gridview/features/constructors/presentation/widgets/team_lineup.dart';
import 'package:gridview/features/shared/domain/entities/constructor.dart';
import 'package:gridview/features/shared/domain/entities/entity_profile.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/media.dart';
import 'package:gridview/features/shared/domain/entities/season_card.dart';
import 'package:gridview/features/shared/domain/entities/season_entry.dart';
import 'package:gridview/features/shared/domain/entities/standing.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/shared/domain/refresh_result.dart';
import 'package:gridview/features/shared/presentation/widgets/primer_detail_app_bar.dart';

import '../../test/support/domain_fixtures.dart';
import '../../test/support/entity_fixtures.dart';
import '../../test/support/fake_entity_repository.dart';
import '../../test/support/media_fixtures.dart';
import '../../test/support/primer_fonts.dart';
import '../../test/support/router_harness.dart';

const double _dpr = 2;
const String _out = 'build/primer-review/55c10';
const double _gap = 24;
const double _surfaceHeight = 3000;
const String _team = '/constructors/alpine';

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

/// The fixture line-up in roster order (Doohan 7, Gasly 10, Colapinto 43).
List<TeamLineupMember> _rosterLineup() => <TeamLineupMember>[
  lineupMember(
    driverId: 'jack-doohan',
    name: 'Jack Doohan',
    shortCode: 'DOO',
    raceNumber: 7,
    endRound: 6,
  ),
  lineupMember(
    driverId: 'pierre-gasly',
    name: 'Pierre Gasly',
    shortCode: 'GAS',
    raceNumber: 10,
  ),
  lineupMember(
    driverId: 'franco-colapinto',
    name: 'Franco Colapinto',
    shortCode: 'COL',
    raceNumber: 43,
    startRound: 7,
  ),
];

TeamProfile _index(int s, String id) =>
    teamProfileFixture(season: s, constructorId: id, lineup: _rosterLineup());

/// Scenario B: a driver who leaves and returns, two rows, no numbers.
TeamProfile _returning(int s, String id) => teamProfileFixture(
  season: s,
  constructorId: id,
  lineup: <TeamLineupMember>[
    lineupMember(driverId: 'jack-doohan', name: 'Jack Doohan', endRound: 6),
    lineupMember(driverId: 'jack-doohan', name: 'Jack Doohan', startRound: 12),
  ],
);

/// States frame 8: both boundaries null, unnumbered rows by name.
TeamProfile _noBoundaries(int s, String id) => teamProfileFixture(
  season: s,
  constructorId: id,
  lineup: <TeamLineupMember>[
    lineupMember(driverId: 'jack-doohan', name: 'Jack Doohan'),
    lineupMember(driverId: 'pierre-gasly', name: 'Pierre Gasly'),
  ],
);

/// A collection-derived card as a profile (states frames 10, 11): branding,
/// stable name, colour and a one-driver line-up; nothing else.
TeamProfile _card(
  int s,
  String id, {
  required String stable,
  required String seasonName,
  required String color,
  required TeamLineupMember member,
}) => TeamProfile(
  constructor: Constructor(id: id, name: stable, colorPrimary: color),
  season: s,
  seasonEntry: ConstructorSeasonEntry(
    id: '$s-$id',
    season: s,
    constructorId: id,
    fullName: seasonName,
    shortName: stable,
    colorPrimary: color,
  ),
  lineup: <TeamLineupMember>[member],
);

TeamProfile _redBull(int s, String id) => _card(
  s,
  id,
  stable: 'Red Bull',
  seasonName: 'Oracle Red Bull Racing',
  color: '#1E41FF',
  member: lineupMember(
    driverId: 'max-verstappen',
    name: 'Max Verstappen',
    shortCode: 'VER',
    raceNumber: 1,
  ),
);

TeamProfile _mclaren(int s, String id) => _card(
  s,
  id,
  stable: 'McLaren',
  seasonName: 'McLaren Formula 1 Team',
  color: '#FF8000',
  member: lineupMember(
    driverId: 'lando-norris',
    name: 'Lando Norris',
    shortCode: 'NOR',
    raceNumber: 4,
  ),
);

TeamProfile _sameName(int s, String id) => teamProfileFixture(
  season: s,
  constructorId: id,
  seasonName: null,
  lineup: _rosterLineup(),
);

TeamProfile _provisional(int s, String id) => teamProfileFixture(
  season: s,
  constructorId: id,
  lineup: _rosterLineup(),
  standing: ConstructorStanding(
    season: s,
    constructorId: id,
    position: 6,
    points: 22,
    wins: 0,
    provisional: true,
  ),
);

/// Long and rebranded names, a long nationality, long facts and a white
/// team colour (below 3:1 on the Light surfaces), with figures of a
/// realistic size: synthetic.
TeamProfile _long(int s, String id) =>
    _longWith(s, id, points: 666, wins: 21, numbers: const <int>[88, 99, 77]);

/// The same with figures beyond any real season (4-digit fractional points,
/// a 3-digit race number): a stress test of the shared strip and the figure
/// column.
TeamProfile _stress(int s, String id) => _longWith(
  s,
  id,
  points: 1234.5,
  wins: 12,
  numbers: const <int>[88, 99, 100],
);

TeamProfile _longWith(
  int s,
  String id, {
  required double points,
  required int wins,
  required List<int> numbers,
}) => TeamProfile(
  constructor: Constructor(
    id: id,
    name: 'Synthetic Heritage Constructors Engineering',
    nationality: 'Synthetic Extraordinarily Long Nationality',
    colorPrimary: '#FFFFFF',
    biography: 'Synthetic biography for layout testing only.',
  ),
  season: s,
  seasonEntry: ConstructorSeasonEntry(
    id: '$s-$id',
    season: s,
    constructorId: id,
    fullName:
        'Synthetic Extraordinarily Long Rebranded Title Sponsor Formula One '
        'Racing Team',
    colorPrimary: '#FFFFFF',
    powerUnit: 'Synthetic Hybrid Power Unit Manufacturer',
    teamPrincipal: 'Synthetic Principal With A Long Name',
    base: 'Synthetic Municipality of the Very Long Place Name',
    chassis: 'SYN-01',
  ),
  standing: ConstructorStanding(
    season: s,
    constructorId: id,
    position: 10,
    points: points,
    wins: wins,
    provisional: true,
  ),
  lineup: <TeamLineupMember>[
    lineupMember(
      driverId: 'synthetic-a',
      name: 'Synthetic Maximilian-Alexander Long-Surname Testdriver',
      shortCode: 'SYA',
      raceNumber: numbers[0],
      endRound: 11,
    ),
    lineupMember(
      driverId: 'synthetic-b',
      name: 'Synthetic Second Driver',
      shortCode: 'SYB',
      raceNumber: numbers[1],
      role: DriverRole.reserve,
    ),
    lineupMember(
      driverId: 'synthetic-c',
      name: 'Synthetic Third Driver',
      raceNumber: numbers[2],
      startRound: 12,
      endRound: 23,
    ),
    lineupMember(driverId: 'synthetic-d', name: 'Synthetic Unnumbered Driver'),
  ],
);

/// Missing optional facts: no nationality, biography, season facts or
/// standing; a line-up without numbers; no colour.
TeamProfile _missing(int s, String id) => TeamProfile(
  constructor: Constructor(id: id, name: 'Synthetic Missing Facts'),
  season: s,
  lineup: <TeamLineupMember>[
    lineupMember(driverId: 'synthetic-a', name: 'Synthetic Driver A'),
  ],
);

/// The unranked standing ("Unranked" word, no wins).
TeamProfile _unranked(int s, String id) => teamProfileFixture(
  season: s,
  constructorId: id,
  lineup: _rosterLineup(),
  standing: ConstructorStanding(season: s, constructorId: id, points: 0),
);

/// The default profile with a constructor-owned mark (synthetic fixture
/// media; the approved inventory is empty).
TeamProfile _withMedia(int s, String id) {
  final TeamProfile p = _index(s, id);
  final Constructor c = p.constructor;
  return TeamProfile(
    constructor: Constructor(
      id: c.id,
      name: c.name,
      nationality: c.nationality,
      colorPrimary: c.colorPrimary,
      biography: c.biography,
      media: <MediaAsset>[
        portraitAsset(
          id: '$id-logo-v1',
          owner: id,
          entityType: MediaEntityType.constructor,
          category: MediaCategory.logo,
        ),
      ],
    ),
    season: p.season,
    seasonEntry: p.seasonEntry,
    standing: p.standing,
    lineup: p.lineup,
  );
}

class _Scenario {
  const _Scenario({
    this.profile = _index,
    this.profileStream,
    this.metadata,
    this.refresh,
    this.focus,
    this.deepLink = false,
    this.currentSeason = 2026,
    this.mediaLoader = false,
  });

  final TeamProfile? Function(int season, String id)? profile;
  final Stream<TeamProfile?> Function(int season, String id)? profileStream;
  final ResourceSyncState? Function(String key)? metadata;
  final Future<RefreshResult> Function(String id, int season)? refresh;

  /// 'row', 'standings' or 'back'.
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

Future<void> _pump(WidgetTester tester, _Config config, _Scenario s) async {
  FocusManager.instance.highlightStrategy = s.focus != null
      ? FocusHighlightStrategy.alwaysTraditional
      : FocusHighlightStrategy.automatic;
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.pump();
  final GoRouter router = await pumpApp(
    tester,
    initialLocation: s.deepLink ? _team : '/',
    surfaceSize: Size(config.width, _surfaceHeight),
    locale: Locale(config.lang),
    textScale: config.scale,
    disableAnimations: true,
    currentSeason: s.currentSeason,
    preferences: AppPreferences.defaults.copyWith(theme: config.theme),
    syncMetadata: s.metadata,
    mediaLoader: s.mediaLoader ? FakeMediaImageLoader() : null,
    constructors: FakeConstructorRepository(
      profile: s.profileStream == null ? s.profile : null,
      profileStream: s.profileStream,
      onRefreshDetail: s.refresh,
    ),
  );
  if (!s.deepLink) {
    // Opened from an origin, so the back action exists, as in the prototype.
    unawaited(router.push(_team));
    await tester.pumpAndSettle();
  }
  final Finder? target = switch (s.focus) {
    'row' => find.descendant(
      of: find.byType(TeamLineupRow).first,
      matching: find.byType(GvPrimerFocusTarget),
    ),
    'standings' => find.descendant(
      of: find.byType(GvPrimerLinkRow),
      matching: find.byType(GvPrimerFocusTarget),
    ),
    'back' => find.byKey(const ValueKey<String>('team-detail-back')),
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
  final Rect screen = tester.getRect(find.byType(ConstructorDetailScreen));
  double bottom = screen.top;
  for (final Element e
      in find
          .descendant(
            of: find.byType(ConstructorDetailScreen),
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
  RenderObject? node = tester.renderObject(
    find.byType(ConstructorDetailScreen),
  );
  while (node != null && node is! RenderRepaintBoundary) {
    node = node.parent;
  }
  final RenderRepaintBoundary boundary = node! as RenderRepaintBoundary;
  final Offset origin = boundary.localToGlobal(Offset.zero);
  final Rect screen = tester.getRect(find.byType(ConstructorDetailScreen));
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
  final double top = tester.getRect(find.byType(ConstructorDetailScreen)).top;
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
      '.tb': boxes(key('team-banner')),
      '.tb__season': boxes(key('team-banner-season')),
      '.tb__name': boxes(key('team-banner-name')),
      '.tb__stable': boxes(key('team-banner-meta-0')),
      '.tb__nat': boxes(key('team-banner-meta-1')),
      '.tb__rail': boxes(key('team-banner-rail')),
      '.tb__pin': boxes(key('team-banner-pinstripe')),
      '.tb__bar': boxes(key('team-banner-bar')),
      '.sec__title': boxes(find.byType(GvPrimerSectionTitle)),
      '.tc': boxes(find.byType(GvPrimerStatStrip)),
      '.dest': boxes(find.byType(GvPrimerLinkRow)),
      '.lu__row': boxes(find.byType(TeamLineupRow)),
      '.lu__num': boxes(key('team-lineup-number')),
      '.lu__code': boxes(key('team-lineup-code')),
      '.lu__seam': boxes(key('team-lineup-seam')),
      '.lu__name': boxes(key('team-lineup-name')),
      '.lu__span': boxes(key('team-lineup-span')),
      '.sheet': boxes(key('team-spec-sheet')),
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
              partialTeamProfileFixture(season: s, constructorId: id),
          metadata: _never,
        ),
        _all,
      ),
      'returning': (const _Scenario(profile: _returning), _all),
      'focus-row': (const _Scenario(focus: 'row'), _pair),
      'focus-standings': (const _Scenario(focus: 'standings'), _pair),
      'focus-back': (const _Scenario(focus: 'back'), _pair),
      'frame-1': (
        _Scenario(
          profileStream: (int s, String id) =>
              const Stream<TeamProfile?>.empty(),
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
      'frame-5': (const _Scenario(refresh: _offline), _pair),
      'frame-6': (const _Scenario(metadata: _stale), _pair),
      'frame-7': (
        _Scenario(
          profile: (int s, String id) => teamProfileFixture(
            season: s,
            constructorId: id,
            lineup: const <TeamLineupMember>[],
          ),
        ),
        _pair,
      ),
      'frame-8': (const _Scenario(profile: _noBoundaries), _pair),
      'frame-9': (const _Scenario(profile: _sameName), _pair),
      'frame-10': (const _Scenario(profile: _redBull), _pair),
      'frame-11': (const _Scenario(profile: _mclaren), _pair),
      'frame-12': (const _Scenario(currentSeason: 2024), _pair),
      'frame-13': (const _Scenario(profile: _provisional), _pair),
      'frame-14': (const _Scenario(profile: _withMedia), _pair),
    };

final Map<String, _Scenario> _states = <String, _Scenario>{
  'n2-failed-stale': const _Scenario(metadata: _stale, refresh: _offline),
  'failed-partial': _Scenario(
    profile: (int s, String id) =>
        partialTeamProfileFixture(season: s, constructorId: id),
    metadata: _never,
    refresh: _offline,
  ),
  'long-names': const _Scenario(profile: _long),
  'stress-figures': const _Scenario(profile: _stress),
  'missing-facts': const _Scenario(profile: _missing),
  'unranked': const _Scenario(profile: _unranked),
  'edge-red-bull': const _Scenario(profile: _redBull),
  'edge-mclaren': const _Scenario(profile: _mclaren),
  'media-pending': const _Scenario(profile: _withMedia),
  'media-failed': const _Scenario(profile: _withMedia, mediaLoader: true),
  'focus-row': const _Scenario(focus: 'row'),
  'focus-back': const _Scenario(focus: 'back'),
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
        await _write(tester, image, 'td-${entry.key}-${config.name}');
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
      FocusManager.instance.highlightStrategy =
          FocusHighlightStrategy.automatic;
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
