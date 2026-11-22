// Step 55C.11 review captures of the production Circuit Detail (not
// goldens).
//
//   node tool/primer_review/capture_circuit_55c11_refs.mjs   (Chrome references)
//   flutter test tool/primer_review/capture_circuit_55c11_test.dart
//
// Output in build/primer-review/55c11/, every PNG at device pixel ratio 2 and
// never resized. The real CircuitDetailScreen (router, Riverpod,
// repositories, l10n) is pushed above Home, as from any origin, on a surface
// tall enough for the whole profile, then cropped to the screen's content.
// - cd-<name>-<theme>-<lang>-<viewport>.png: the Flutter capture;
// - cmp-<name>-<theme>-<lang>-<viewport>.png: the Chrome reference (left)
//   next to it (right). Every value is a development test fixture
//   (`test/support/entity_fixtures.dart`), **not a real-world result**.
//   State pairs put the reference's fixture frame next to the whole Flutter
//   screen rendered from a consistent profile;
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
import 'package:gridview/features/circuits/presentation/circuit_detail_screen.dart';
import 'package:gridview/features/circuits/presentation/widgets/circuit_sheet.dart';
import 'package:gridview/features/shared/domain/entities/circuit.dart';
import 'package:gridview/features/shared/domain/entities/entity_profile.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/media.dart';
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
const String _out = 'build/primer-review/55c11';
const double _gap = 24;
const double _surfaceHeight = 3000;
const String _spa = '/circuits/spa-francorchamps';
const String _monza = '/circuits/monza';

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

/// CR-04 (Step 55C.11C): the season calendar and the bootstrap never
/// synchronised; every other resource synced.
ResourceSyncState? _noCalendar(String key) =>
    key.startsWith('calendar:') || key == 'bootstrap'
    ? null
    : syncedMetadata(key);
ResourceSyncState? _stale(String key) =>
    syncedMetadata(key, staleAfter: DateTime.utc(2000));

Future<RefreshResult> _offline(String id, int season) async =>
    const RefreshFailure(ApiFailure(kind: ApiFailureKind.networkUnavailable));
Future<RefreshResult> _notFound(String id, int season) async =>
    const RefreshFailure(ApiFailure(kind: ApiFailureKind.notFound));

CircuitProfile _index(int s, String id) =>
    circuitProfileFixture(season: s, circuitId: id);

/// Scenario B, as the partial golden: Monza, no facts, no record, no event,
/// never synced.
CircuitProfile _partial(int s, String id) => circuitProfileFixture(
  season: s,
  circuitId: id,
  name: 'Autodromo Nazionale Monza',
  locality: 'Monza',
  country: 'Italy',
  lengthMeters: null,
  cornerCount: null,
  direction: null,
  firstGrandPrixYear: null,
  withLapRecord: false,
  withRelated: false,
);

CircuitProfile _noEvent(int s, String id) =>
    circuitProfileFixture(season: s, circuitId: id, withRelated: false);

/// States frame 7: every fact null, no record, the event kept.
CircuitProfile _noFacts(int s, String id) => circuitProfileFixture(
  season: s,
  circuitId: id,
  lengthMeters: null,
  cornerCount: null,
  direction: null,
  firstGrandPrixYear: null,
  withLapRecord: false,
);

CircuitProfile _unknownDirection(int s, String id) => circuitProfileFixture(
  season: s,
  circuitId: id,
  direction: CircuitDirection.unknown,
);

CircuitProfile _ccw(int s, String id) => circuitProfileFixture(
  season: s,
  circuitId: id,
  direction: CircuitDirection.counterClockwise,
);

/// States frame 9: an unresolvable holder, a year and no time.
CircuitProfile _holderYearOnly(int s, String id) => circuitProfileFixture(
  season: s,
  circuitId: id,
  lapRecord: const LapRecord(driverId: 'ghost-driver', year: 2004),
  lapRecordDriverName: null,
);

CircuitProfile _holderUnavailable(int s, String id) =>
    circuitProfileFixture(season: s, circuitId: id, lapRecordDriverName: null);

CircuitProfile _unnamedEvent(int s, String id) => circuitProfileFixture(
  season: s,
  circuitId: id,
  related: relatedGrandPrix(season: s, name: null),
);

/// States frame 12: the Monza card's related event (round 12, standard).
CircuitProfile _standard(int s, String id) => circuitProfileFixture(
  season: s,
  circuitId: id,
  related: relatedGrandPrix(
    season: s,
    round: 12,
    name: 'Italian Grand Prix',
    startDate: '2026-07-10',
    endDate: '2026-07-12',
    format: WeekendFormat.standard,
  ),
);

/// States frame 13: explicit unknown status and format (both dashed).
CircuitProfile _unknownChips(int s, String id) => circuitProfileFixture(
  season: s,
  circuitId: id,
  related: relatedGrandPrix(
    season: s,
    status: EventStatus.unknown,
    format: WeekendFormat.unknown,
  ),
);

/// No status and no format: no chips at all.
CircuitProfile _noChips(int s, String id) => circuitProfileFixture(
  season: s,
  circuitId: id,
  related: relatedGrandPrix(season: s, status: null, format: null),
);

CircuitProfile _withMedia(
  int s,
  String id, {
  MediaCategory category = MediaCategory.circuitLayout,
}) {
  final CircuitProfile p = _index(s, id);
  return CircuitProfile(
    circuit: p.circuit.copyWithMedia(<MediaAsset>[
      portraitAsset(
        id: '$id-layout-v1',
        owner: id,
        entityType: MediaEntityType.circuit,
        category: category,
      ),
    ]),
    season: p.season,
    relatedGrandPrix: p.relatedGrandPrix,
    lapRecordDriverName: p.lapRecordDriverName,
  );
}

CircuitProfile _diagram(int s, String id) => _withMedia(s, id);
CircuitProfile _photo(int s, String id) =>
    _withMedia(s, id, category: MediaCategory.hero);

/// Long names everywhere: synthetic.
CircuitProfile _long(int s, String id) => circuitProfileFixture(
  season: s,
  circuitId: id,
  name:
      'Synthetic Autódromo Internacional Extraordinarily-Long-Hyphenated '
      'Circuit Name',
  locality: 'Synthetic Municipality of the Very Long Place Name',
  country: 'Synthetic Republic',
  lapRecordDriverName: 'Synthetic Maximilian-Alexander Long-Surname',
  related: relatedGrandPrix(
    season: s,
    name: 'Synthetic Extraordinarily Long Title Sponsor Grand Prix',
  ),
);

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
    this.location = _spa,
  });

  final CircuitProfile? Function(int season, String id)? profile;
  final Stream<CircuitProfile?> Function(int season, String id)? profileStream;
  final ResourceSyncState? Function(String key)? metadata;
  final Future<RefreshResult> Function(String id, int season)? refresh;

  /// 'row' or 'back'.
  final String? focus;
  final bool deepLink;
  final int? currentSeason;
  final bool mediaLoader;
  final String location;
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
    initialLocation: s.deepLink ? s.location : '/',
    surfaceSize: Size(config.width, _surfaceHeight),
    locale: Locale(config.lang),
    textScale: config.scale,
    disableAnimations: true,
    currentSeason: s.currentSeason,
    preferences: AppPreferences.defaults.copyWith(theme: config.theme),
    syncMetadata: s.metadata,
    mediaLoader: s.mediaLoader ? FakeMediaImageLoader() : null,
    circuits: FakeCircuitRepository(
      profile: s.profileStream == null ? s.profile : null,
      profileStream: s.profileStream,
      onRefreshDetail: s.refresh,
    ),
  );
  if (!s.deepLink) {
    // Opened from an origin, so the back action exists, as in the prototype.
    unawaited(router.push(s.location));
    await tester.pumpAndSettle();
  }
  final Finder? target = switch (s.focus) {
    'row' => find.byKey(const ValueKey<String>('circuit-related-link')),
    'back' => find.byKey(const ValueKey<String>('circuit-detail-back')),
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

/// The bottom of the screen's content: the last laid-out text, skeleton,
/// chip, disc or media frame, plus the page's 32px end.
double _contentBottom(WidgetTester tester) {
  final Rect screen = tester.getRect(find.byType(CircuitDetailScreen));
  double bottom = screen.top;
  for (final Element e
      in find
          .descendant(
            of: find.byType(CircuitDetailScreen),
            matching: find.byWidgetPredicate(
              (Widget w) =>
                  w is Text ||
                  w is GvPrimerSkeleton ||
                  w is GvPrimerArrowDisc ||
                  w is GvPrimerStatusChip ||
                  w is CircuitMediaFrame ||
                  w is GvPrimerButton,
            ),
          )
          .evaluate()) {
    final RenderBox box = e.renderObject! as RenderBox;
    if (!box.hasSize) continue;
    final double b = box.localToGlobal(Offset(0, box.size.height)).dy;
    if (b > bottom) bottom = b;
  }
  // The related row and the no-event statement close with their padding
  // and hairline (16 + 1) below the last text.
  final Finder row = find.byKey(const ValueKey<String>('circuit-related-link'));
  final Finder none = find.byKey(
    const ValueKey<String>('circuit-related-none'),
  );
  for (final Finder f in <Finder>[row, none]) {
    if (f.evaluate().isEmpty) continue;
    final double b = tester.getRect(f).bottom + (f == row ? 1 : 0);
    if (b > bottom) bottom = b;
  }
  return (bottom + 32).clamp(screen.top, screen.bottom);
}

Future<ui.Image> _capture(WidgetTester tester) async {
  RenderObject? node = tester.renderObject(find.byType(CircuitDetailScreen));
  while (node != null && node is! RenderRepaintBoundary) {
    node = node.parent;
  }
  final RenderRepaintBoundary boundary = node! as RenderRepaintBoundary;
  final Offset origin = boundary.localToGlobal(Offset.zero);
  final Rect screen = tester.getRect(find.byType(CircuitDetailScreen));
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
  final double top = tester.getRect(find.byType(CircuitDetailScreen)).top;
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
      '.ch': boxes(key('circuit-sheet')),
      '.ch__name': boxes(key('circuit-sheet-name')),
      '.ch__loc': boxes(key('circuit-sheet-location')),
      '.ch__media': boxes(key('circuit-media-frame')),
      '.ch__kicker': boxes(key('circuit-facts-kicker')),
      '.dim__val': boxes(key('circuit-length-value')),
      '.dim__arm': <List<double>>[
        ...boxes(key('circuit-dim-arm-start')),
        ...boxes(key('circuit-dim-arm-end')),
      ],
      '.facts': boxes(key('circuit-facts-row')),
      '.sec__title': boxes(find.byType(GvPrimerSectionTitle)),
      '.lap': boxes(key('circuit-lap-record')),
      '.lap__time dd': boxes(key('circuit-lap-time')),
      '.rel__season': boxes(key('circuit-related-season')),
      '.rel__none': boxes(key('circuit-related-none')),
      '.rx': boxes(key('circuit-related-link')),
      '.rx__round': boxes(key('circuit-related-round')),
      '.rx__seam': boxes(key('circuit-related-seam')),
      '.rx__name': boxes(key('circuit-related-name')),
      '.rx__date': boxes(key('circuit-related-date')),
      '.rx__chips': boxes(key('circuit-related-chips')),
      '.rx__disc': boxes(find.byType(GvPrimerArrowDisc)),
      '.chip': boxes(find.byType(GvPrimerStatusChip)),
      '.skel span': boxes(find.byType(GvPrimerSkeleton)),
      '.btn': boxes(find.byType(GvPrimerButton)),
    },
  };
}

final Map<String, (_Scenario, List<_Config>)> _paired =
    <String, (_Scenario, List<_Config>)>{
      'index': (const _Scenario(), _all),
      'partial': (
        const _Scenario(profile: _partial, metadata: _never, location: _monza),
        _all,
      ),
      'no-event': (const _Scenario(profile: _noEvent), _all),
      'focus-row': (const _Scenario(focus: 'row'), _pair),
      'focus-back': (const _Scenario(focus: 'back'), _pair),
      'frame-1': (
        _Scenario(
          profileStream: (int s, String id) =>
              const Stream<CircuitProfile?>.empty(),
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
      'frame-7': (const _Scenario(profile: _noFacts), _pair),
      'frame-8': (const _Scenario(profile: _unknownDirection), _pair),
      'frame-9': (const _Scenario(profile: _holderYearOnly), _pair),
      'frame-10': (const _Scenario(profile: _holderUnavailable), _pair),
      'frame-11': (const _Scenario(profile: _unnamedEvent), _pair),
      'frame-12': (const _Scenario(profile: _standard), _pair),
      'frame-13': (const _Scenario(profile: _unknownChips), _pair),
      'frame-14': (const _Scenario(profile: _ccw), _pair),
      'frame-15': (const _Scenario(profile: _diagram), _pair),
      'frame-16': (
        const _Scenario(profile: _diagram, mediaLoader: true),
        _pair,
      ),
    };

final Map<String, _Scenario> _states = <String, _Scenario>{
  'n2-failed-stale': const _Scenario(metadata: _stale, refresh: _offline),
  'failed-partial': const _Scenario(
    profile: _partial,
    metadata: _never,
    refresh: _offline,
    location: _monza,
  ),
  'long-names': const _Scenario(profile: _long),
  'unknown-direction': const _Scenario(profile: _unknownDirection),
  'counter-clockwise': const _Scenario(profile: _ccw),
  'unknown-status-format': const _Scenario(profile: _unknownChips),
  'no-chips': const _Scenario(profile: _noChips),
  'holder-year-only': const _Scenario(profile: _holderYearOnly),
  'holder-unavailable': const _Scenario(profile: _holderUnavailable),
  'unnamed-event': const _Scenario(profile: _unnamedEvent),
  'no-facts': const _Scenario(profile: _noFacts),
  'media-pending': const _Scenario(profile: _diagram),
  'media-failed': const _Scenario(profile: _diagram, mediaLoader: true),
  'media-photo-failed': const _Scenario(profile: _photo, mediaLoader: true),
  'loading': _Scenario(
    profileStream: (int s, String id) => const Stream<CircuitProfile?>.empty(),
  ),
  'season-unavailable': const _Scenario(currentSeason: null),
  'focus-row': const _Scenario(focus: 'row'),
  'focus-back': const _Scenario(focus: 'back'),
  'deep-link': const _Scenario(deepLink: true),
  'historical-2024': const _Scenario(currentSeason: 2024),
  // CR-04 (Step 55C.11C): the same no-event profile, B then C.
  'cr04-confirmed-absence': const _Scenario(profile: _noEvent),
  'cr04-unknown-association': const _Scenario(
    profile: _noEvent,
    metadata: _noCalendar,
  ),
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
        await _write(tester, image, 'cd-${entry.key}-${config.name}');
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
