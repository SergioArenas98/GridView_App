// Step 55C.13B review captures of the Settings information screens (Data and
// updates, App information, Privacy and legal, Acknowledgements), not
// goldens.
//
//   node tool/primer_review/capture_settings_55c13b_refs.mjs   (Chrome refs)
//   flutter test tool/primer_review/capture_settings_55c13b_test.dart
//
// Output in build/primer-review/55c13b/, every PNG at device pixel ratio 2
// and never resized. The real screens (router, Riverpod, l10n) are opened
// from Home, then Settings, as in the app, on a surface tall enough for the
// whole page, then cropped:
// - info-<name>-<theme>-<lang>-<viewport>.png: the Flutter capture;
// - cmp-<name>-<theme>-<lang>-<viewport>.png: the Chrome reference (left)
//   next to it (right);
// - flutter-geometry.json: element boxes (logical px, from the top of the
//   capture) for the numeric comparison with ref-geometry.json.
//
// Fixtures follow the reference gallery's provenance: season 2026, package
// metadata 1.2.1 / 7 (golden fixture), the frozen capture of 2026-10-07, the
// bundled data-source record, and the gallery's test-fixture sources and
// media credits. Rendered by the flutter_tester engine; not device
// validation.
import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:gridview/app/environment/app_environment.dart';
import 'package:gridview/core/network/data_source_config.dart';
import 'package:gridview/core/observability/error_reporter.dart';
import 'package:gridview/core/observability/observability.dart';
import 'package:gridview/core/observability/observability_activation.dart';
import 'package:gridview/core/observability/performance_tracer.dart';
import 'package:gridview/core/preferences/preference_values.dart';
import 'package:gridview/core/time/timezones.dart';
import 'package:gridview/features/settings/application/app_info.dart';
import 'package:gridview/features/settings/application/external_links.dart';
import 'package:gridview/features/settings/domain/data_source_attribution.dart';
import 'package:gridview/features/settings/presentation/widgets/data_source_attribution_card.dart';
import 'package:gridview/features/settings/presentation/widgets/settings_app_bar.dart';
import 'package:gridview/features/settings/presentation/widgets/settings_external_link_row.dart';
import 'package:gridview/features/settings/presentation/widgets/settings_information.dart';
import 'package:gridview/features/settings/presentation/widgets/settings_navigation_row.dart';
import 'package:gridview/features/settings/presentation/widgets/settings_snackbar.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/media.dart';
import 'package:gridview/features/shared/domain/fixture_data_identity.dart';
import 'package:gridview/features/shared/presentation/widgets/primer_detail_app_bar.dart';
import 'package:intl/date_symbol_data_local.dart';

import '../../test/support/primer_fonts.dart';
import '../../test/support/router_harness.dart';

const double _dpr = 2;
const String _out = 'build/primer-review/55c13b';
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

const AppThemePreference _d = AppThemePreference.dark;
const AppThemePreference _l = AppThemePreference.light;
const List<_Config> _pair = <_Config>[
  _Config(_d, 'en', 390, 844, 1),
  _Config(_d, 'es', 320, 693, 2),
  _Config(_l, 'en', 390, 844, 1),
  _Config(_l, 'es', 320, 693, 2),
];
const List<_Config> _ack = <_Config>[
  _Config(_d, 'en', 390, 844, 1),
  _Config(_d, 'es', 390, 844, 1),
  _Config(_d, 'en', 320, 693, 2),
  _Config(_d, 'es', 320, 693, 2),
  _Config(_l, 'en', 390, 844, 1),
  _Config(_l, 'es', 390, 844, 1),
  _Config(_l, 'en', 320, 693, 2),
  _Config(_l, 'es', 320, 693, 2),
];
const List<_Config> _en320 = <_Config>[
  _Config(_d, 'en', 320, 693, 2),
  _Config(_l, 'en', 320, 693, 2),
];
// Step 55C.13BR2 defensive cases (no Chrome reference): beyond the SF-10R
// bound the title keeps the approved size and wraps; at 175% it fits with
// a small reduction.
const List<_Config> _titleExtremes = <_Config>[
  _Config(_d, 'en', 320, 693, 1.75),
  _Config(_d, 'en', 300, 650, 2),
  _Config(_d, 'en', 300, 650, 2.5),
  _Config(_d, 'en', 320, 693, 2.5),
  _Config(_d, 'es', 320, 693, 2),
  _Config(_d, 'es', 320, 693, 2.5),
];
const List<_Config> _es390 = <_Config>[
  _Config(_d, 'es', 390, 844, 1),
  _Config(_l, 'es', 390, 844, 1),
];

/// Where a capture starts and ends.
enum _Crop {
  /// From the top of the window (environment strip included) to the end of
  /// the content.
  window,

  /// From the top of the Settings screen to the end of the content.
  screen,

  /// Below the app bar to the end of the content.
  belowBar,

  /// From 20px above a section's kicker ([_Scenario.section]) to 40px below
  /// the section's content (a states gallery frame shows one section).
  section,

  /// The Acknowledgements link rows of the first source.
  links,

  /// The whole viewport (the snackbar sits at its bottom).
  viewport,

  /// The app bar only (Step 55C.13BR, the English title).
  bar,
}

final FrozenCaptureData _frozen = FrozenCaptureData(
  capturedAt: DateTime.utc(2026, 10, 7, 22, 41, 45, 852),
  season: 2026,
  sourceIds: const <String>{'jolpica'},
  manifestSha256: 'ab' * 32,
);

Future<DataSourceAttributions> _activeExample() async =>
    DataSourceAttributions.fromJson(<String, Object?>{
      'kind': 'data-source-attribution',
      'version': 'data-sources-v9',
      'sources': <Object?>[
        <String, Object?>{
          'sourceId': 'example',
          'name': 'Example Source',
          'sourceUrl': 'https://example.org/project',
          'termsUrl': null,
          'licenseName': 'CC BY-NC-SA 4.0',
          'licenseTitle': 'Example licence title',
          'licenseUrl': 'https://example.org/licence',
          'status': 'active',
          'copyrightNotice': '(c) Example Contributors',
          'warrantyDisclaimerNotice': null,
          'creatorDesignation': 'Example Creator',
        },
      ],
    });

class _Scenario {
  const _Scenario(
    this.location, {
    this.environment = AppEnvironment.production,
    this.crop = _Crop.screen,
    this.policy = false,
    this.activation = ObservabilityActivation.notConfigured,
    this.season = 2026,
    this.mockData = false,
    this.fixtureData,
    this.appInfo = const AppInfo(
      appName: 'GridView',
      version: '1.2.1',
      buildNumber: '7',
    ),
    this.sources,
    this.media = const <MediaAttribution>[],
    this.mediaPending = false,
    this.section,
    this.focusLink = false,
    this.openFails = false,
  });

  final String location;
  final AppEnvironment environment;
  final _Crop crop;
  final bool policy;
  final ObservabilityActivation activation;
  final int? season;
  final bool mockData;
  final FixtureDataIdentity? fixtureData;
  final AppInfo appInfo;
  final Future<DataSourceAttributions> Function()? sources;
  final List<MediaAttribution> media;
  final bool mediaPending;

  /// The kicker of the section a [_Crop.section] capture shows, by its
  /// English or Spanish text.
  final (String, String)? section;

  /// Focuses the first external link row from the keyboard.
  final bool focusLink;

  /// Activates the privacy policy with a launcher that fails.
  final bool openFails;
}

final Completer<DataSourceAttributions> _never =
    Completer<DataSourceAttributions>();

final Map<String, (_Scenario, List<_Config>)> _paired =
    <String, (_Scenario, List<_Config>)>{
      'data': (const _Scenario('/settings/data'), _pair),
      'data-season-unavailable': (
        const _Scenario('/settings/data', season: null),
        _pair,
      ),
      'data-sample': (
        const _Scenario(
          '/settings/data',
          environment: AppEnvironment.development,
          crop: _Crop.window,
          mockData: true,
          fixtureData: SampleFixtureData(),
        ),
        _pair,
      ),
      'data-frozen': (
        _Scenario(
          '/settings/data',
          environment: AppEnvironment.development,
          crop: _Crop.window,
          mockData: true,
          fixtureData: _frozen,
        ),
        _es390,
      ),
      'about': (const _Scenario('/settings/about'), _pair),
      'about-unresolved': (
        const _Scenario('/settings/about', appInfo: AppInfo.unknown),
        _pair,
      ),
      'privacy': (
        const _Scenario(
          '/settings/privacy',
          policy: true,
          activation: ObservabilityActivation.active,
        ),
        _pair,
      ),
      'privacy-unconfirmed': (
        const _Scenario(
          '/settings/privacy',
          activation: ObservabilityActivation.unavailable,
        ),
        _pair,
      ),
      'privacy-non-production': (
        const _Scenario(
          '/settings/privacy',
          environment: AppEnvironment.development,
          crop: _Crop.window,
        ),
        _pair,
      ),
      'acknowledgements': (const _Scenario('/settings/acknowledgements'), _ack),
      'ack-loading': (
        _Scenario(
          '/settings/acknowledgements',
          sources: () => _never.future,
          mediaPending: true,
        ),
        _pair,
      ),
      'ack-unreadable': (
        _Scenario(
          '/settings/acknowledgements',
          crop: _Crop.belowBar,
          sources: () async => throw const FormatException('unreadable'),
        ),
        _pair,
      ),
      'ack-credits': (
        const _Scenario(
          '/settings/acknowledgements',
          crop: _Crop.section,
          section: ('Images', 'Imágenes'),
          media: <MediaAttribution>[
            MediaAttribution(
              category: MediaCategory.portrait,
              attribution: 'Example Rights Holder',
              license: 'CC BY 4.0',
            ),
            MediaAttribution(
              category: MediaCategory.circuitLayout,
              attribution: 'Second Rights Holder',
            ),
          ],
        ),
        _pair,
      ),
      'ack-active-source': (
        const _Scenario(
          '/settings/acknowledgements',
          crop: _Crop.section,
          section: ('Data sources', 'Fuentes de datos'),
          sources: _activeExample,
        ),
        _pair,
      ),
      'link-focus': (
        const _Scenario(
          '/settings/acknowledgements',
          crop: _Crop.links,
          focusLink: true,
        ),
        _pair,
      ),
      'title-en': (
        const _Scenario('/settings/acknowledgements', crop: _Crop.bar),
        _en320,
      ),
      'title-extreme': (
        const _Scenario('/settings/acknowledgements', crop: _Crop.bar),
        _titleExtremes,
      ),
      'privacy-open-failed': (
        const _Scenario(
          '/settings/privacy',
          crop: _Crop.viewport,
          policy: true,
          activation: ObservabilityActivation.active,
          openFails: true,
        ),
        _pair,
      ),
    };

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
  FocusManager.instance.highlightStrategy = s.focusLink
      ? FocusHighlightStrategy.alwaysTraditional
      : FocusHighlightStrategy.automatic;
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.pump();
  final bool viewport = s.crop == _Crop.viewport;
  final GoRouter router = await pumpApp(
    tester,
    initialLocation: '/',
    surfaceSize: Size(config.width, viewport ? config.height : 7000),
    locale: Locale(config.lang),
    textScale: config.scale,
    disableAnimations: true,
    environment: s.environment,
    environmentBadge: !s.environment.isProduction,
    preferences: AppPreferences.defaults.copyWith(theme: config.theme),
    linkConfig: s.policy
        ? ExternalLinkConfig(
            privacyPolicy: ExternalLink.parse('https://example.org/privacy'),
          )
        : const ExternalLinkConfig(),
    linkLauncher: RecordingExternalLinkLauncher(succeeds: !s.openFails),
    observability: Observability(
      reporter: const NoopErrorReporter(),
      tracer: const NoopPerformanceTracer(),
      status: StaticObservabilityActivation(s.activation),
    ),
    currentSeason: s.season,
    mockData: s.mockData,
    fixtureData: s.fixtureData,
    dataSourceMode: s.mockData ? DataSourceMode.fixture : null,
    appInfoReader: FakeAppInfoReader(s.appInfo),
    dataSourceAttributions: s.sources,
    mediaAttributions: s.media,
    mediaAttributionsStream: s.mediaPending
        ? const Stream<List<MediaAttribution>>.empty().asBroadcastStream()
        : null,
    clock: DateTime.utc(2026, 7, 18, 12, 10),
    deviceTimeZone: 'UTC',
  );
  unawaited(router.push('/settings'));
  await tester.pumpAndSettle();
  unawaited(router.push(s.location));
  await tester.pumpAndSettle();
  if (s.focusLink) {
    Focus.of(
      tester.element(
        find
            .descendant(
              of: find.byType(SettingsExternalLinkRow).first,
              matching: find.byType(GestureDetector),
            )
            .first,
      ),
    ).requestFocus();
    await tester.pump();
    await tester.pumpAndSettle();
  }
  if (s.openFails) {
    // Activated where it sits, then the page is returned to its top, as the
    // reference shows the failure over the unscrolled page.
    final Finder policy = find.byKey(
      const ValueKey<String>('settings-privacy-policy'),
    );
    await tester.ensureVisible(policy);
    await tester.pumpAndSettle();
    await tester.tap(policy);
    await tester.pump();
    tester
        .state<ScrollableState>(
          find
              .descendant(
                of: find.byType(SingleChildScrollView).last,
                matching: find.byType(Scrollable),
              )
              .first,
        )
        .position
        .jumpTo(0);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.byType(SettingsSnackbarContent), findsOneWidget);
  }
  expect(tester.takeException(), isNull);
}

Rect _rect(WidgetTester tester, Finder f) => tester.getRect(f);

/// The bottom of the content plus the 40px end padding.
double _contentBottom(WidgetTester tester) {
  final Finder column = find
      .descendant(
        of: find.byType(SingleChildScrollView).last,
        matching: find.byType(Column),
      )
      .first;
  return _rect(tester, column).bottom + SettingsPrimerScaffold.endPadding;
}

(double, double) _bounds(
  WidgetTester tester,
  _Crop crop,
  _Scenario s,
  Size view,
) {
  final Rect bar = _rect(tester, find.byType(SettingsAppBar).last);
  switch (crop) {
    case _Crop.window:
      return (0, _contentBottom(tester));
    case _Crop.screen:
      return (bar.top, _contentBottom(tester));
    case _Crop.belowBar:
      return (bar.bottom, _contentBottom(tester));
    case _Crop.viewport:
      return (bar.top, view.height);
    case _Crop.bar:
      return (bar.top, bar.bottom);
    case _Crop.links:
      final Finder rows = find.byType(SettingsExternalLinkRow);
      return (_rect(tester, rows.first).top, _rect(tester, rows.at(2)).bottom);
    case _Crop.section:
      final (String en, String es) = s.section!;
      final Finder kicker = find.text(en).evaluate().isNotEmpty
          ? find.text(en)
          : find.text(es);
      final double top = _rect(tester, kicker).top - 20;
      final Finder end = en == 'Images'
          ? find.byType(SettingsFactList).last
          : find.byType(DataSourceAttributionCard).last;
      return (
        top,
        _rect(tester, end).bottom + SettingsPrimerScaffold.endPadding,
      );
  }
}

Future<(ui.Image, double)> _capture(
  WidgetTester tester,
  _Crop crop,
  _Scenario s,
) async {
  RenderObject? node = tester.renderObject(find.byType(SettingsAppBar).last);
  RenderRepaintBoundary? outermost;
  while (node != null) {
    if (node is RenderRepaintBoundary) outermost = node;
    node = node.parent;
  }
  final RenderRepaintBoundary root = outermost!;
  final Offset origin = root.localToGlobal(Offset.zero);
  final Size view = root.size;
  final (double top, double bottom) = _bounds(tester, crop, s, view);
  late ui.Image full;
  await tester.runAsync(() async {
    full = await root.toImage(pixelRatio: _dpr);
  });
  final Rect rect = Rect.fromLTRB(
    (0 - origin.dx) * _dpr,
    (top - origin.dy) * _dpr,
    (view.width - origin.dx) * _dpr,
    (bottom - origin.dy) * _dpr,
  );
  return (await _compose(tester, <(ui.Image, Rect)>[(full, rect)]), top);
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

Map<String, Object> _geometry(WidgetTester tester, double top) {
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
  final Finder bar = find.byType(SettingsAppBar).last;
  return <String, Object>{
    '.dbar': boxes(bar),
    '.fact': boxes(
      find.byWidgetPredicate((Widget w) => w is SettingsFact && w.shows),
    ),
    '.srow': boxes(
      find.byWidgetPredicate(
        (Widget w) =>
            w is SettingsExternalLinkRow || w is SettingsNavigationRow,
      ),
    ),
    '.source': boxes(find.byType(DataSourceAttributionCard)),
    '.snack': boxes(find.byType(SettingsSnackbarContent)),
    'title': _title(tester),
  };
}

/// The app-bar title as laid out: its style, its lines (each character
/// placed by its own box), and whether it clears Back and the viewport.
Map<String, Object> _title(WidgetTester tester) {
  final Finder bar = find.byType(SettingsAppBar).last;
  final Finder text = find
      .descendant(of: bar, matching: find.byType(RichText))
      .first;
  final RenderParagraph p = tester.renderObject<RenderParagraph>(text);
  final String plain = p.text.toPlainText();
  final List<String> lines = <String>[];
  double? top;
  final StringBuffer line = StringBuffer();
  for (int i = 0; i < plain.length; i++) {
    final List<TextBox> b = p.getBoxesForSelection(
      TextSelection(baseOffset: i, extentOffset: i + 1),
    );
    if (b.isEmpty) continue;
    final double y = b.first.top.roundToDouble();
    if (top != null && y != top) {
      lines.add(line.toString());
      line.clear();
    }
    top = y;
    line.write(plain[i]);
  }
  lines.add(line.toString());
  final TextStyle style = p.text.style!;
  final double wdth =
      style.fontVariations
          ?.where((FontVariation v) => v.axis == 'wdth')
          .map((FontVariation v) => v.value)
          .firstOrNull ??
      100;
  final Rect title = tester.getRect(text);
  final Finder back = find.descendant(
    of: bar,
    matching: find.byType(PrimerDetailBackButton),
  );
  final Rect? backRect = back.evaluate().isEmpty ? null : tester.getRect(back);
  final double viewWidth =
      tester.view.physicalSize.width / tester.view.devicePixelRatio;
  return <String, Object>{
    'text': plain,
    'lines': lines,
    'fontSize': style.fontSize ?? 0,
    'scaledFontSize': MediaQuery.textScalerOf(
      tester.element(text),
    ).scale(style.fontSize ?? 0),
    'wdth': wdth,
    'didExceedMaxLines': p.didExceedMaxLines,
    'overlapsBack': backRect?.overlaps(title) ?? false,
    'backSize': <double>[backRect?.width ?? 0, backRect?.height ?? 0],
    'titleRect': <double>[title.left, title.top, title.right, title.bottom],
    'insideViewport': title.left >= 0 && title.right <= viewWidth + 0.5,
  };
}

void main() {
  final Map<String, Object> geometry = <String, Object>{};

  setUpAll(() async {
    ensureTimeZonesInitialized();
    await initializeDateFormatting('en');
    await initializeDateFormatting('es');
  });

  tearDown(() {
    FocusManager.instance.highlightStrategy = FocusHighlightStrategy.automatic;
  });

  for (final MapEntry<String, (_Scenario, List<_Config>)> entry
      in _paired.entries) {
    testWidgets('paired: ${entry.key}', (WidgetTester tester) async {
      await loadArchivo(tester);
      await _loadMaterialIcons(tester);
      final (_Scenario scenario, List<_Config> configs) = entry.value;
      for (final _Config config in configs) {
        await _pump(tester, config, scenario);
        final (ui.Image image, double top) = await _capture(
          tester,
          scenario.crop,
          scenario,
        );
        geometry['${entry.key}-${config.name}'] = _geometry(tester, top);
        await _write(tester, image, 'info-${entry.key}-${config.name}');
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
    });
  }

  tearDownAll(() {
    File('$_out/flutter-geometry.json')
      ..createSync(recursive: true)
      ..writeAsStringSync(const JsonEncoder.withIndent(' ').convert(geometry));
  });
}
