// Step 55C.13B: the Settings information screens (Data and updates,
// Acknowledgements, Privacy and legal, App information) in Primer V2.
//
// Scenario names follow the approved reference gallery
// (`settings/information/README.md`): D1-D5 Data, A1-A2 Acknowledgements,
// P1-P4 Privacy, I1-I2 About, and the states gallery frames 1-10.
import 'dart:async';

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
import 'package:gridview/core/theme/theme.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/settings/application/app_info.dart';
import 'package:gridview/features/settings/application/external_links.dart';
import 'package:gridview/features/settings/domain/data_source_attribution.dart';
import 'package:gridview/features/settings/presentation/acknowledgements_screen.dart';
import 'package:gridview/features/settings/presentation/information_screens.dart';
import 'package:gridview/features/settings/presentation/widgets/data_source_attribution_card.dart';
import 'package:gridview/features/settings/presentation/widgets/settings_app_bar.dart';
import 'package:gridview/features/settings/presentation/widgets/settings_external_link_row.dart';
import 'package:gridview/features/settings/presentation/widgets/settings_information.dart';
import 'package:gridview/features/settings/presentation/widgets/settings_navigation_row.dart';
import 'package:gridview/features/settings/presentation/widgets/settings_primer_text.dart';
import 'package:gridview/features/settings/presentation/widgets/settings_snackbar.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/media.dart';
import 'package:gridview/features/shared/domain/fixture_data_identity.dart';
import 'package:gridview/features/shared/presentation/widgets/primer_detail_app_bar.dart';

import '../support/primer_fonts.dart';
import '../support/router_harness.dart';

const Size _tall = Size(390, 3200);
const String _openFailed = 'That link could not be opened.';
final ExternalLinkConfig _withPolicy = ExternalLinkConfig(
  privacyPolicy: ExternalLink.parse('https://example.org/privacy'),
);

final FrozenCaptureData _frozen = FrozenCaptureData(
  capturedAt: DateTime.utc(2026, 10, 7, 22, 41, 45, 852),
  season: 2026,
  sourceIds: const <String>{'jolpica'},
  manifestSha256: 'ab' * 32,
);

Observability _activation(ObservabilityActivation value) => Observability(
  reporter: const NoopErrorReporter(),
  tracer: const NoopPerformanceTracer(),
  status: StaticObservabilityActivation(value),
);

Map<String, Object?> _source({
  String id = 'example',
  String name = 'Example Source',
  String status = 'active',
  String? termsUrl,
  String? copyright = '(c) Example Contributors',
  String? warranty,
  String? creator = 'Example Creator',
}) => <String, Object?>{
  'sourceId': id,
  'name': name,
  'sourceUrl': 'https://example.org/project',
  'termsUrl': termsUrl,
  'licenseName': 'CC BY-NC-SA 4.0',
  'licenseTitle': 'Example licence title',
  'licenseUrl': 'https://example.org/licence',
  'status': status,
  'copyrightNotice': copyright,
  'warrantyDisclaimerNotice': warranty,
  'creatorDesignation': creator,
};

Future<DataSourceAttributions> Function() _record(
  List<Map<String, Object?>> sources,
) =>
    () async => DataSourceAttributions.fromJson(<String, Object?>{
      'kind': 'data-source-attribution',
      'version': 'data-sources-v9',
      'sources': sources,
    });

Future<void> _pump(
  WidgetTester tester, {
  required String location,
  AppEnvironment environment = AppEnvironment.production,
  ExternalLinkConfig linkConfig = const ExternalLinkConfig(),
  ExternalLinkLauncher? launcher,
  AppThemePreference theme = AppThemePreference.dark,
  Locale locale = const Locale('en'),
  double textScale = 1,
  Size size = _tall,
  bool mockData = false,
  FixtureDataIdentity? fixtureData,
  DataSourceMode? dataSourceMode,
  AppInfo appInfo = const AppInfo(
    appName: 'GridView',
    version: '1.2.1',
    buildNumber: '7',
  ),
  Observability observability = const Observability.disabled(),
  int? currentSeason = 2026,
  Future<DataSourceAttributions> Function()? sources,
  List<MediaAttribution> media = const <MediaAttribution>[],
  Stream<List<MediaAttribution>>? mediaStream,
  bool settle = true,
}) async {
  await loadArchivo(tester);
  FocusManager.instance.highlightStrategy = FocusHighlightStrategy.automatic;
  await pumpApp(
    tester,
    initialLocation: location,
    environment: environment,
    linkConfig: linkConfig,
    linkLauncher: launcher,
    preferences: AppPreferences.defaults.copyWith(theme: theme),
    locale: locale,
    textScale: textScale,
    surfaceSize: size,
    mockData: mockData,
    fixtureData: fixtureData,
    dataSourceMode: dataSourceMode,
    appInfoReader: FakeAppInfoReader(appInfo),
    observability: observability,
    currentSeason: currentSeason,
    dataSourceAttributions: sources,
    mediaAttributions: media,
    mediaAttributionsStream: mediaStream,
    disableAnimations: true,
  );
  if (settle) await tester.pumpAndSettle();
}

GvPrimerRoles _roles(WidgetTester tester) =>
    GvPrimerSurface.of(tester.element(find.byType(SettingsAppBar).last)).roles;

/// Every string rendered on the current screen.
List<String> _texts(WidgetTester tester) => <String>[
  for (final Element e in find.byType(RichText).evaluate())
    (e.renderObject! as RenderParagraph).text.toPlainText(),
];

/// The fact whose label is [label].
Finder _fact(String label) =>
    find.ancestor(of: find.text(label), matching: find.byType(SettingsFact));

/// The value [Text] of the fact labelled [label].
Text _factValue(WidgetTester tester, String label, String value) =>
    tester.widget<Text>(
      find.descendant(of: _fact(label), matching: find.text(value)),
    );

double _wdth(TextStyle? style) =>
    style?.fontVariations
        ?.where((FontVariation v) => v.axis == 'wdth')
        .map((FontVariation v) => v.value)
        .firstOrNull ??
    100;

Future<void> _keyboardMode(WidgetTester tester) async {
  await tester.sendKeyEvent(LogicalKeyboardKey.shiftLeft);
  await tester.pump();
  expect(FocusManager.instance.highlightMode, FocusHighlightMode.traditional);
}

FocusNode _targetNode(WidgetTester tester, Finder target) => Focus.of(
  tester.element(
    find.descendant(of: target, matching: find.byType(GestureDetector)).first,
  ),
);

bool _ringVisible(WidgetTester tester, Finder target) => tester
    .widget<GvPrimerFocusRing>(
      find.descendant(of: target, matching: find.byType(GvPrimerFocusRing)),
    )
    .visible;

/// The shared Primer chrome and no legacy surface.
void _expectPrimerChrome(WidgetTester tester) {
  expect(find.byType(SettingsAppBar), findsOneWidget);
  expect(find.byType(PrimerDetailBackButton), findsOneWidget);
  // The retired GvScreenScaffold always drew this legacy Material bar.
  expect(find.byType(GvAppBar), findsNothing);
  expect(find.byType(GvContentCard), findsNothing);
  expect(find.byType(GvSkeletonBlock), findsNothing);
  expect(find.byType(BackButton), findsNothing);
}

/// Nothing visible is a raw URL, a scheme or a technical identifier.
void _expectNoTechnicalText(WidgetTester tester) {
  for (final String text in _texts(tester)) {
    for (final String banned in <String>[
      'http',
      'https',
      'example.org/privacy',
      'mailto',
      'data-sources-v',
      'jolpica-',
      'sourceId',
    ]) {
      if (banned == 'jolpica-' && text.startsWith('github.com/')) continue;
      expect(text, isNot(contains(banned)), reason: text);
    }
  }
}

/// No clipped or overflowing text inside [screen]; whole words except
/// displayed addresses (free to break anywhere) and hyphenated licence
/// tokens (SF-14: natural wrapping, nothing inserted), and [breakable]
/// texts whose single word is wider than the column at every approved width
/// (they wrap where the line breaker allows: the readable fallback).
void _expectAllTextVisible(
  WidgetTester tester,
  Finder screen, {
  Set<String> breakable = const <String>{},
}) {
  expect(tester.takeException(), isNull);
  final Rect bounds = tester.getRect(screen);
  for (final Element e
      in find
          .descendant(of: screen, matching: find.byType(RichText))
          .evaluate()) {
    final RenderParagraph p = e.renderObject! as RenderParagraph;
    final String text = p.text.toPlainText();
    if (text.trim().isEmpty) continue;
    expect(p.didExceedMaxLines, isFalse, reason: text);
    expect(p.textSize.width, lessThanOrEqualTo(p.size.width + 0.5));
    expect(p.textSize.height, lessThanOrEqualTo(p.size.height + 0.5));
    final Rect box = p.localToGlobal(Offset.zero) & p.size;
    expect(box.left, greaterThanOrEqualTo(bounds.left - 0.5), reason: text);
    expect(box.right, lessThanOrEqualTo(bounds.right + 0.5), reason: text);
    if (breakable.contains(text)) continue;
    for (final RegExpMatch m in RegExp(r'\S+').allMatches(text)) {
      final String word = m[0]!;
      if (word.contains('/') || word.contains('-')) continue;
      final Set<double> tops = <double>{
        for (final TextBox b in p.getBoxesForSelection(
          TextSelection(baseOffset: m.start, extentOffset: m.end),
        ))
          b.top.roundToDouble(),
      };
      expect(tops, hasLength(1), reason: '"$word" breaks inside "$text"');
    }
  }
}

/// Every Primer target on screen is at least 48dp each way.
void _expectTargets(WidgetTester tester) {
  for (final Element e in find.byType(GvPrimerFocusTarget).evaluate()) {
    final Size s = tester.getSize(find.byWidget(e.widget));
    expect(s.height, greaterThanOrEqualTo(48));
    expect(s.width, greaterThanOrEqualTo(48));
  }
}

AttributedString _attributedLabel(WidgetTester tester, Finder finder) =>
    tester.getSemantics(finder).attributedLabel;

void main() {
  tearDown(() {
    FocusManager.instance.highlightStrategy = FocusHighlightStrategy.automatic;
  });

  group('Data and updates', () {
    testWidgets('D1 production, GridView service, season stored', (
      WidgetTester tester,
    ) async {
      await _pump(tester, location: '/settings/data');
      _expectPrimerChrome(tester);
      expect(find.text('Data and updates'), findsOneWidget);
      expect(find.text('PRODUCTION'), findsOneWidget);
      expect(find.text('GridView service'), findsOneWidget);
      expect(find.text('2026'), findsOneWidget);
      expect(
        find.textContaining('GridView keeps the season on your device'),
        findsOneWidget,
      );
      // Numbers use tabular figures; every fact is one merged node.
      expect(
        _factValue(tester, 'Current season', '2026').style!.fontFeatures,
        contains(const FontFeature.tabularFigures()),
      );
      expect(
        _attributedLabel(tester, _fact('Data source')).string,
        'Data source, GridView service',
      );
      expect(find.byType(SettingsFact), findsNWidgets(4));
      _expectNoTechnicalText(tester);
    });

    testWidgets('D2 development sample data never promises downloads', (
      WidgetTester tester,
    ) async {
      await _pump(
        tester,
        location: '/settings/data',
        environment: AppEnvironment.development,
        mockData: true,
        fixtureData: const SampleFixtureData(),
        dataSourceMode: DataSourceMode.fixture,
      );
      expect(find.text('DEV'), findsOneWidget);
      expect(find.text('Sample data'), findsOneWidget);
      expect(find.textContaining('It does not download updates'), findsOne);
      expect(
        find.textContaining('New information is downloaded'),
        findsNothing,
      );
    });

    testWidgets('D3 frozen capture states its unlocalized capture date', (
      WidgetTester tester,
    ) async {
      await _pump(
        tester,
        location: '/settings/data',
        environment: AppEnvironment.development,
        mockData: true,
        fixtureData: _frozen,
        dataSourceMode: DataSourceMode.fixture,
        locale: const Locale('es'),
      );
      expect(
        find.text('Datos de prueba congelados capturados el 2026-10-07'),
        findsOneWidget,
      );
      expect(find.textContaining('No se actualiza'), findsOneWidget);
    });

    testWidgets('D4 unverified bundle is named neutrally', (
      WidgetTester tester,
    ) async {
      await _pump(
        tester,
        location: '/settings/data',
        environment: AppEnvironment.development,
        mockData: true,
        fixtureData: const UnverifiedFixtureData(),
        dataSourceMode: DataSourceMode.fixture,
      );
      expect(find.text('Test data of unverified origin'), findsOneWidget);
      expect(find.textContaining('It does not download updates'), findsOne);
    });

    testWidgets(
      'D5 no season yet: the pending answer is quieter than a value',
      (WidgetTester tester) async {
        await _pump(tester, location: '/settings/data', currentSeason: null);
        final Text pending = _factValue(
          tester,
          'Current season',
          'Not available yet',
        );
        expect(pending.style!.color, _roles(tester).text.secondary);
        expect(pending.style!.fontWeight, FontWeight.w500);
        final Text value = _factValue(
          tester,
          'Data source',
          'GridView service',
        );
        expect(value.style!.color, _roles(tester).text.primary);
        expect(find.text('2026'), findsNothing);
      },
    );

    testWidgets('frame 10: production misconfigured for fixtures says Not '
        'configured with the bundled explanation', (WidgetTester tester) async {
      await _pump(
        tester,
        location: '/settings/data',
        dataSourceMode: DataSourceMode.fixture,
      );
      expect(find.text('Not configured'), findsOneWidget);
      expect(find.textContaining('It does not download updates'), findsOne);
    });

    testWidgets('the first fact sits 20dp below the app bar; the explanation '
        '24dp below the facts', (WidgetTester tester) async {
      await _pump(tester, location: '/settings/data');
      final double barBottom = tester
          .getBottomLeft(find.byType(SettingsAppBar))
          .dy;
      expect(tester.getTopLeft(_fact('Environment')).dy - barBottom, 20);
      final double lastFact = tester.getBottomLeft(_fact('Current season')).dy;
      expect(
        tester.getTopLeft(find.textContaining('GridView keeps the season')).dy -
            lastFact,
        24,
      );
    });
  });

  group('App information', () {
    testWidgets('I1 metadata resolved from the package reader', (
      WidgetTester tester,
    ) async {
      await _pump(
        tester,
        location: '/settings/about',
        appInfo: const AppInfo(
          appName: 'GridView',
          version: '3.4.5',
          buildNumber: '99',
        ),
      );
      _expectPrimerChrome(tester);
      expect(find.text('3.4.5'), findsOneWidget);
      expect(find.text('99'), findsOneWidget);
      expect(
        _attributedLabel(tester, _fact('Version')).string,
        'Version, 3.4.5',
      );
      expect(
        find.textContaining('GridView is an independent application'),
        findsOneWidget,
      );
      // The statement follows the facts.
      expect(
        tester.getTopLeft(find.textContaining('independent application')).dy,
        greaterThan(tester.getBottomLeft(_fact('Build')).dy),
      );
    });

    testWidgets('I2 unreadable metadata shows only the application name', (
      WidgetTester tester,
    ) async {
      await _pump(
        tester,
        location: '/settings/about',
        appInfo: AppInfo.unknown,
      );
      expect(find.byType(SettingsFact), findsOneWidget);
      expect(find.text('Version'), findsNothing);
      expect(find.text('Build'), findsNothing);
      expect(find.text(AppInfo.unknown.appName), findsOneWidget);
    });

    testWidgets('an empty build number alone is omitted', (
      WidgetTester tester,
    ) async {
      await _pump(
        tester,
        location: '/settings/about',
        appInfo: const AppInfo(
          appName: 'GridView',
          version: '2.0.0',
          buildNumber: '',
        ),
      );
      expect(find.text('2.0.0'), findsOneWidget);
      expect(find.text('Build'), findsNothing);
    });
  });

  group('Privacy and legal', () {
    testWidgets('P1 production, policy, session Active after Advertising '
        'under the dashed rule', (WidgetTester tester) async {
      await _pump(
        tester,
        location: '/settings/privacy',
        linkConfig: _withPolicy,
        observability: _activation(ObservabilityActivation.active),
      );
      _expectPrimerChrome(tester);
      // "Privacy" heading; the screen title appears once.
      expect(find.text('Privacy'), findsOneWidget);
      expect(find.text('Privacy and legal'), findsOneWidget);
      expect(find.text('Configured'), findsNWidgets(2));
      expect(find.text('Disabled'), findsOneWidget);
      expect(find.text('Active'), findsOneWidget);

      final Finder session = find.byKey(PrivacySettingsScreen.sessionKey);
      final SettingsFact sessionFact = tester.widget<SettingsFact>(
        find.descendant(of: session, matching: find.byType(SettingsFact)),
      );
      expect(sessionFact.rule, SettingsFactRule.dashed);
      final double advertising = tester.getTopLeft(_fact('Advertising')).dy;
      final double sessionTop = tester.getTopLeft(session).dy;
      final double note = tester
          .getTopLeft(find.textContaining('Diagnostic components'))
          .dy;
      expect(advertising, lessThan(sessionTop));
      expect(sessionTop, lessThan(note));

      final Finder policy = find.byKey(
        const ValueKey<String>('settings-privacy-policy'),
      );
      expect(policy, findsOneWidget);
      expect(
        find.descendant(of: policy, matching: find.byType(GvPrimerIcon)),
        findsOneWidget,
      );
      expect(
        tester
            .widget<GvPrimerIcon>(
              find.descendant(of: policy, matching: find.byType(GvPrimerIcon)),
            )
            .glyph,
        GvPrimerGlyph.openExternal,
      );
      _expectNoTechnicalText(tester);
    });

    testWidgets('P2 activation in flight reads Starting', (
      WidgetTester tester,
    ) async {
      await _pump(
        tester,
        location: '/settings/privacy',
        linkConfig: _withPolicy,
        observability: _activation(ObservabilityActivation.pending),
      );
      expect(find.text('Starting'), findsOneWidget);
    });

    testWidgets('P3 production, no policy, Not confirmed: no action and no '
        'missing-policy explanation', (WidgetTester tester) async {
      await _pump(
        tester,
        location: '/settings/privacy',
        observability: _activation(ObservabilityActivation.unavailable),
      );
      expect(find.text('Not confirmed'), findsOneWidget);
      expect(
        find.byKey(const ValueKey<String>('settings-privacy-policy')),
        findsNothing,
      );
      expect(
        find.byKey(PrivacySettingsScreen.policyUnavailableKey),
        findsNothing,
      );
      expect(find.textContaining('No privacy policy'), findsNothing);
    });

    testWidgets('P4 development: Disabled policy, no session, a static '
        'missing-policy row in the action position', (
      WidgetTester tester,
    ) async {
      await _pump(
        tester,
        location: '/settings/privacy',
        environment: AppEnvironment.development,
        observability: _activation(ObservabilityActivation.active),
      );
      expect(find.text('Disabled'), findsNWidgets(3));
      expect(find.byKey(PrivacySettingsScreen.sessionKey), findsNothing);
      final Finder row = find.byKey(PrivacySettingsScreen.policyUnavailableKey);
      expect(row, findsOneWidget);
      expect(
        find.text('No privacy policy is configured in this build.'),
        findsOneWidget,
      );
      // Static: no focus stop, no button, title in text.secondary.
      expect(
        find.descendant(of: row, matching: find.byType(GvPrimerFocusTarget)),
        findsNothing,
      );
      expect(tester.getSemantics(row).flagsCollection.isButton, isFalse);
      expect(
        tester.getTopLeft(row).dy -
            tester.getBottomLeft(find.textContaining('Diagnostic')).dy,
        24,
      );
    });

    testWidgets('frame 9: production whose diagnostics never activate shows '
        'no session line', (WidgetTester tester) async {
      await _pump(tester, location: '/settings/privacy');
      expect(find.byKey(PrivacySettingsScreen.sessionKey), findsNothing);
      expect(find.text('App reporting this session'), findsNothing);
      expect(find.text('Configured'), findsNWidgets(2));
    });

    testWidgets('the session line follows activation as it resolves', (
      WidgetTester tester,
    ) async {
      final ValueNotifier<ObservabilityActivation> status =
          ValueNotifier<ObservabilityActivation>(
            ObservabilityActivation.pending,
          );
      addTearDown(status.dispose);
      await _pump(
        tester,
        location: '/settings/privacy',
        observability: Observability(
          reporter: const NoopErrorReporter(),
          tracer: const NoopPerformanceTracer(),
          status: status,
        ),
      );
      expect(find.text('Starting'), findsOneWidget);
      status.value = ObservabilityActivation.active;
      await tester.pump();
      expect(find.text('Starting'), findsNothing);
      expect(find.text('Active'), findsOneWidget);
      status.value = ObservabilityActivation.notConfigured;
      await tester.pump();
      expect(find.byKey(PrivacySettingsScreen.sessionKey), findsNothing);
    });

    testWidgets('the policy opens the configured destination; a failure shows '
        'the Primer snackbar without the URL', (WidgetTester tester) async {
      final RecordingExternalLinkLauncher ok = RecordingExternalLinkLauncher();
      await _pump(
        tester,
        location: '/settings/privacy',
        linkConfig: _withPolicy,
        launcher: ok,
      );
      await tester.tap(
        find.byKey(const ValueKey<String>('settings-privacy-policy')),
      );
      await tester.pumpAndSettle();
      expect(ok.opened, <Uri>[Uri.parse('https://example.org/privacy')]);
      expect(find.text(_openFailed), findsNothing);

      final RecordingExternalLinkLauncher failing =
          RecordingExternalLinkLauncher(succeeds: false);
      await _pump(
        tester,
        location: '/settings/privacy',
        linkConfig: _withPolicy,
        launcher: failing,
      );
      await tester.tap(
        find.byKey(const ValueKey<String>('settings-privacy-policy')),
      );
      await tester.pump();
      expect(find.byType(SettingsSnackbarContent), findsOneWidget);
      expect(find.text(_openFailed), findsOneWidget);
      _expectNoTechnicalText(tester);
    });
  });

  group('Acknowledgements', () {
    testWidgets('A1 production: record loaded, media credits known empty', (
      WidgetTester tester,
    ) async {
      await _pump(tester, location: '/settings/acknowledgements');
      _expectPrimerChrome(tester);
      for (final String kicker in <String>['Data', 'Data sources', 'Images']) {
        expect(find.text(kicker), findsOneWidget);
      }
      expect(find.byKey(AcknowledgementsScreen.sourcesKey), findsOneWidget);
      expect(find.text('Jolpica F1'), findsOneWidget);
      expect(
        tester.getSemantics(find.text('Jolpica F1')).flagsCollection.isHeader,
        isTrue,
      );
      final Finder empty = find.byKey(AcknowledgementsScreen.emptyKey);
      expect(empty, findsOneWidget);
      expect(
        tester
            .widget<Text>(
              find.descendant(of: empty, matching: find.byType(Text)),
            )
            .style!
            .color,
        _roles(tester).text.secondary,
      );
      // Three external rows, each with the open glyph and no chevron.
      expect(find.byType(SettingsExternalLinkRow), findsNWidgets(3));
      expect(find.byType(GvPrimerRowChevron), findsNothing);
      // The legal strings are intact: nothing inserted into "BY-NC-SA".
      final String all = _texts(tester).join('\n');
      expect(
        all,
        contains('Data from Jolpica F1 is licensed under CC BY-NC-SA 4.0.'),
      );
      expect(all, contains('CC BY-NC-SA 4.0'));
      for (final String inserted in <String>['‑', '⁠', ' ', '­', '​']) {
        expect(all, isNot(contains(inserted)));
      }
      _expectNoTechnicalText(tester);
    });

    testWidgets('A2 a frozen capture overrides the record status', (
      WidgetTester tester,
    ) async {
      await _pump(
        tester,
        location: '/settings/acknowledgements',
        environment: AppEnvironment.development,
        mockData: true,
        fixtureData: _frozen,
      );
      expect(find.text('Frozen test data captured 2026-10-07'), findsOneWidget);
      expect(find.textContaining('2026-10-07'), findsNWidgets(2));
      expect(find.textContaining('hourly schedule'), findsNothing);
    });

    testWidgets('the link rows are buttons with meaningful labels and open the '
        'recorded links', (WidgetTester tester) async {
      final RecordingExternalLinkLauncher launcher =
          RecordingExternalLinkLauncher();
      await _pump(
        tester,
        location: '/settings/acknowledgements',
        launcher: launcher,
      );
      const List<String> keys = <String>[
        'data-source-jolpica-project',
        'data-source-jolpica-terms',
        'data-source-jolpica-license',
      ];
      final List<String> labels = <String>[
        for (final String key in keys)
          tester.getSemantics(find.byKey(ValueKey<String>(key))).label,
      ];
      expect(labels, <String>[
        'Source project, github.com/jolpica/jolpica-f1',
        'Terms of use, github.com/jolpica/jolpica-f1/blob/main/TERMS.md',
        'License, CC BY-NC-SA 4.0, Creative Commons '
            'Attribution-NonCommercial-ShareAlike 4.0 International',
      ]);
      for (final String key in keys) {
        final SemanticsNode node = tester.getSemantics(
          find.byKey(ValueKey<String>(key)),
        );
        expect(node.flagsCollection.isButton, isTrue);
        expect(node.flagsCollection.isLink, isFalse);
        expect(node.label, isNot(contains('https')));
        expect(
          tester.getSize(find.byKey(ValueKey<String>(key))).height,
          greaterThanOrEqualTo(SettingsExternalLinkRow.minHeight),
        );
        await tester.ensureVisible(find.byKey(ValueKey<String>(key)));
        await tester.tap(find.byKey(ValueKey<String>(key)));
        await tester.pumpAndSettle();
      }
      expect(launcher.opened, <Uri>[
        Uri.parse('https://github.com/jolpica/jolpica-f1'),
        Uri.parse('https://github.com/jolpica/jolpica-f1/blob/main/TERMS.md'),
        Uri.parse('https://creativecommons.org/licenses/by-nc-sa/4.0/'),
      ]);
    });

    testWidgets('a failed attribution link shows the Primer snackbar', (
      WidgetTester tester,
    ) async {
      await _pump(
        tester,
        location: '/settings/acknowledgements',
        launcher: RecordingExternalLinkLauncher(succeeds: false),
      );
      final Finder row = find.byKey(
        const ValueKey<String>('data-source-jolpica-license'),
      );
      await tester.ensureVisible(row);
      await tester.tap(row);
      await tester.pump();
      expect(find.byType(SettingsSnackbarContent), findsOneWidget);
      expect(find.text(_openFailed), findsOneWidget);
      expect(find.byType(SnackBar), findsOneWidget);
    });

    testWidgets('Spanish: provider-supplied English is marked English for '
        'speech and never translated', (WidgetTester tester) async {
      await _pump(
        tester,
        location: '/settings/acknowledgements',
        locale: const Locale('es'),
      );
      const String warranty =
          'Jolpica F1 does not guarantee uptime, availability or correctness '
          'of the data.';
      expect(find.text(warranty), findsOneWidget);
      final AttributedString notice = _attributedLabel(
        tester,
        _fact('Aviso de la fuente'),
      );
      expect(notice.string, 'Aviso de la fuente, $warranty');
      final LocaleStringAttribute mark =
          notice.attributes.single as LocaleStringAttribute;
      expect(mark.locale, const Locale('en'));
      expect(
        notice.string.substring(mark.range.start, mark.range.end),
        warranty,
      );
      expect(
        tester.widget<Text>(find.text(warranty)).style!.locale,
        const Locale('en'),
      );

      final AttributedString licence = _attributedLabel(
        tester,
        find.byKey(const ValueKey<String>('data-source-jolpica-license')),
      );
      final LocaleStringAttribute licenceMark =
          licence.attributes.single as LocaleStringAttribute;
      expect(
        licence.string.substring(
          licenceMark.range.start,
          licenceMark.range.end,
        ),
        'Creative Commons Attribution-NonCommercial-ShareAlike 4.0 '
        'International',
      );
      // GridView's own Spanish copy carries no language mark.
      expect(
        _attributedLabel(tester, _fact('Origen de datos')).attributes,
        isEmpty,
      );
    });

    testWidgets('several sources: one block each, 40dp apart, supplied notices '
        'kept and an absent terms link omitted', (WidgetTester tester) async {
      await _pump(
        tester,
        location: '/settings/acknowledgements',
        sources: _record(<Map<String, Object?>>[
          _source(),
          _source(
            id: 'second',
            name: 'Second Source',
            status: 'dormant',
            termsUrl: 'https://example.org/terms',
            copyright: null,
            creator: null,
            warranty: 'Second Source makes no warranty.',
          ),
        ]),
      );
      expect(find.byType(DataSourceAttributionCard), findsNWidgets(2));
      expect(find.text('Example Source'), findsOneWidget);
      expect(find.text('Second Source'), findsOneWidget);
      expect(find.text('(c) Example Contributors'), findsOneWidget);
      expect(find.text('Example Creator'), findsOneWidget);
      expect(find.text('Second Source makes no warranty.'), findsOneWidget);
      expect(
        find.byKey(const ValueKey<String>('data-source-example-terms')),
        findsNothing,
      );
      expect(
        find.byKey(const ValueKey<String>('data-source-second-terms')),
        findsOneWidget,
      );
      expect(find.textContaining('batches'), findsWidgets);
      expect(find.textContaining('Not connected yet'), findsOneWidget);
      final double firstBottom = tester
          .getBottomLeft(
            find.byKey(const ValueKey<String>('data-source-example')),
          )
          .dy;
      final double secondTop = tester
          .getTopLeft(find.byKey(const ValueKey<String>('data-source-second')))
          .dy;
      expect(secondTop - firstBottom, 40);
    });

    testWidgets('frame 1: record and media loading show static announced '
        'skeletons', (WidgetTester tester) async {
      final Completer<DataSourceAttributions> never =
          Completer<DataSourceAttributions>();
      final StreamController<List<MediaAttribution>> media =
          StreamController<List<MediaAttribution>>();
      addTearDown(media.close);
      await _pump(
        tester,
        location: '/settings/acknowledgements',
        sources: () => never.future,
        mediaStream: media.stream,
      );
      for (final Key key in <Key>[
        AcknowledgementsScreen.sourcesResolvingKey,
        AcknowledgementsScreen.resolvingKey,
      ]) {
        final Finder state = find.byKey(key);
        expect(state, findsOneWidget);
        expect(
          find.descendant(of: state, matching: find.byType(GvPrimerSkeleton)),
          findsOneWidget,
        );
        // `.skel`: a 20px bar across the gutter-inset column.
        expect(
          tester.getSize(
            find.descendant(of: state, matching: find.byType(GvPrimerSkeleton)),
          ),
          const Size(390 - 2 * 16, 20),
        );
        expect(
          find.descendant(of: state, matching: find.byType(GvPrimerLoading)),
          findsOneWidget,
        );
      }
      expect(find.bySemanticsLabel('Loading'), findsNWidgets(2));
      // Static: nothing keeps scheduling frames.
      expect(tester.binding.hasScheduledFrame, isFalse);
      expect(find.text('No attributions are stored yet.'), findsNothing);
    });

    testWidgets('frame 2: an unreadable record is the Primer notice, never an '
        'empty list', (WidgetTester tester) async {
      await _pump(
        tester,
        location: '/settings/acknowledgements',
        sources: () async => throw const FormatException('broken'),
      );
      final Finder notice = find.byKey(
        AcknowledgementsScreen.sourcesUnavailableKey,
      );
      expect(
        find.descendant(of: notice, matching: find.byType(GvPrimerNotice)),
        findsOneWidget,
      );
      final SemanticsNode node = tester.getSemantics(
        find.descendant(of: notice, matching: find.byType(GvPrimerNotice)),
      );
      expect(node.label, 'Data source details could not be loaded.');
      expect(node.flagsCollection.isLiveRegion, isTrue);
      expect(find.byKey(AcknowledgementsScreen.sourcesKey), findsNothing);
      expect(find.text('Data sources'), findsOneWidget);
    });

    testWidgets('frame 3: a record with no sources omits the section', (
      WidgetTester tester,
    ) async {
      await _pump(
        tester,
        location: '/settings/acknowledgements',
        sources: _record(const <Map<String, Object?>>[]),
      );
      expect(find.text('Data sources'), findsNothing);
      expect(find.byKey(AcknowledgementsScreen.sourcesKey), findsNothing);
      expect(find.text('Images'), findsOneWidget);
    });

    testWidgets('frame 4: a failed media read stays a loading block', (
      WidgetTester tester,
    ) async {
      await _pump(
        tester,
        location: '/settings/acknowledgements',
        mediaStream: Stream<List<MediaAttribution>>.error(StateError('x')),
      );
      expect(find.byKey(AcknowledgementsScreen.resolvingKey), findsOneWidget);
      expect(find.byKey(AcknowledgementsScreen.emptyKey), findsNothing);
      expect(find.text('No attributions are stored yet.'), findsNothing);
    });

    testWidgets('frame 5: populated media credits as facts', (
      WidgetTester tester,
    ) async {
      await _pump(
        tester,
        location: '/settings/acknowledgements',
        media: const <MediaAttribution>[
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
      );
      final Finder credits = find.byKey(AcknowledgementsScreen.creditsKey);
      expect(
        find.descendant(of: credits, matching: find.byType(SettingsFact)),
        findsNWidgets(2),
      );
      expect(
        _attributedLabel(tester, _fact('Portrait')).string,
        'Portrait, Example Rights Holder · CC BY 4.0',
      );
      expect(_attributedLabel(tester, _fact('Portrait')).attributes, isEmpty);
      expect(find.text('Second Rights Holder'), findsOneWidget);
    });
  });

  group('keyboard and navigation', () {
    testWidgets('an external row takes the Primer ring and opens with Enter', (
      WidgetTester tester,
    ) async {
      final RecordingExternalLinkLauncher launcher =
          RecordingExternalLinkLauncher();
      await _pump(
        tester,
        location: '/settings/acknowledgements',
        launcher: launcher,
      );
      await _keyboardMode(tester);
      final Finder row = find.byKey(
        const ValueKey<String>('data-source-jolpica-project'),
      );
      _targetNode(tester, row).requestFocus();
      await tester.pump();
      await tester.pump();
      expect(_ringVisible(tester, row), isTrue);
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();
      expect(launcher.opened, <Uri>[
        Uri.parse('https://github.com/jolpica/jolpica-f1'),
      ]);
      await tester.sendKeyEvent(LogicalKeyboardKey.space);
      await tester.pumpAndSettle();
      expect(launcher.opened, hasLength(2));
    });

    for (final (String key, Type screen) in <(String, Type)>[
      ('settings-data', DataSettingsScreen),
      ('settings-acknowledgements', AcknowledgementsScreen),
      ('settings-about', AboutSettingsScreen),
      ('settings-privacy', PrivacySettingsScreen),
    ]) {
      testWidgets('$screen: Back returns to Settings and keyboard focus to '
          'the originating row', (WidgetTester tester) async {
        await _pump(tester, location: '/settings');
        await _keyboardMode(tester);
        final FocusNode row = tester
            .widget<GvPrimerFocusTarget>(
              find.descendant(
                of: find.byKey(ValueKey<String>(key)),
                matching: find.byType(GvPrimerFocusTarget),
              ),
            )
            .focusNode!;
        row.requestFocus();
        await tester.pumpAndSettle();
        await tester.sendKeyEvent(LogicalKeyboardKey.enter);
        await tester.pumpAndSettle();
        expect(find.byType(screen), findsOneWidget);
        _targetNode(tester, find.byType(PrimerDetailBackButton)).requestFocus();
        await tester.pumpAndSettle();
        await tester.sendKeyEvent(LogicalKeyboardKey.enter);
        await tester.pumpAndSettle();
        expect(find.byType(screen), findsNothing);
        expect(find.byKey(ValueKey<String>(key)), findsOneWidget);
        expect(row.hasPrimaryFocus, isTrue);
      });
    }

    testWidgets('headings: the title, the section kickers and the provider '
        'name are headers; facts are not', (WidgetTester tester) async {
      await _pump(tester, location: '/settings/acknowledgements');
      for (final String heading in <String>[
        'Acknowledgements',
        'Data',
        'Data sources',
        'Images',
        'Jolpica F1',
      ]) {
        expect(
          tester.getSemantics(find.text(heading)).flagsCollection.isHeader,
          isTrue,
          reason: heading,
        );
      }
      expect(
        tester.getSemantics(_fact('Data source')).flagsCollection.isHeader,
        isFalse,
      );
    });
  });

  group('rendering', () {
    const List<(String, String)> routes = <(String, String)>[
      ('data', '/settings/data'),
      ('acknowledgements', '/settings/acknowledgements'),
      ('privacy', '/settings/privacy'),
      ('about', '/settings/about'),
    ];
    for (final (String name, String location) in routes) {
      for (final AppThemePreference theme in <AppThemePreference>[
        AppThemePreference.dark,
        AppThemePreference.light,
      ]) {
        for (final (Locale locale, double width, double scale)
            in <(Locale, double, double)>[
              (const Locale('en'), 390, 1),
              (const Locale('es'), 390, 1),
              (const Locale('en'), 320, 2),
              (const Locale('es'), 320, 2),
            ]) {
          testWidgets('$name ${theme.name} ${locale.languageCode} '
              '${width.toInt()} @${(scale * 100).toInt()}%: whole text, '
              'no overflow, 48dp targets', (WidgetTester tester) async {
            await _pump(
              tester,
              location: location,
              theme: theme,
              locale: locale,
              textScale: scale,
              size: Size(width, scale > 1 ? 9000 : 4000),
              linkConfig: _withPolicy,
              observability: _activation(ObservabilityActivation.unavailable),
              sources: name == 'acknowledgements'
                  ? _record(<Map<String, Object?>>[
                      _source(
                        id: 'jolpica',
                        name: 'Jolpica F1',
                        status: 'automatic',
                        termsUrl:
                            'https://github.com/jolpica/jolpica-f1/blob/main/'
                            'TERMS.md',
                        warranty:
                            'Jolpica F1 does not guarantee uptime, '
                            'availability or correctness of the data.',
                      ),
                      _source(
                        name:
                            'Fundación Internacional de Estadísticas '
                            'Históricas del Automovilismo',
                      ),
                    ])
                  : null,
              media: const <MediaAttribution>[
                MediaAttribution(
                  category: MediaCategory.circuitLayout,
                  attribution: 'Second Rights Holder',
                  license: 'CC BY-SA 4.0',
                ),
              ],
            );
            final Finder screen = find.byType(Scaffold).last;
            _expectAllTextVisible(
              tester,
              screen,
              breakable: <String>{
                // A synthetic overlong provider name: the reference breaks
                // it (`overflow-wrap: break-word`), never narrower or
                // smaller.
                'Fundación Internacional de Estadísticas Históricas del '
                    'Automovilismo',
              },
            );
            _expectTargets(tester);
            expect(
              tester.widget<Scaffold>(screen).backgroundColor,
              _roles(tester).surface.page,
            );
          });
        }
      }
    }
  });

  // Step 55C.13BR2, owner decision SF-10R: a single-word app-bar title that
  // does not fit even at wdth 62 takes the reference's last-resort scale,
  // at most 13% below its system-scaled size; otherwise SF-10 holds.
  group('SF-10R single-word title fallback', () {
    /// The app-bar title paragraph and what it shows.
    ({Text text, RenderParagraph paragraph, Rect rect}) title(
      WidgetTester tester,
      String expected,
    ) {
      final Finder text = find.descendant(
        of: find.byType(SettingsAppBar),
        matching: find.text(expected),
      );
      return (
        text: tester.widget<Text>(text),
        paragraph: tester.renderObject<RenderParagraph>(
          find.descendant(of: text, matching: find.byType(RichText)),
        ),
        rect: tester.getRect(text),
      );
    }

    int lines(RenderParagraph p) => <double>{
      for (final TextBox b in p.getBoxesForSelection(
        TextSelection(baseOffset: 0, extentOffset: p.text.toPlainText().length),
      ))
        b.top.roundToDouble(),
    }.length;

    /// The title's column: the app bar width less 6px start padding, the
    /// 48px Back column, 4px gap and the 16px end padding.
    double column(double width) => width - 6 - 48 - 4 - 16;

    void expectIntactHeading(
      WidgetTester tester,
      String expected,
      double width,
    ) {
      final ({Text text, RenderParagraph paragraph, Rect rect}) t = title(
        tester,
        expected,
      );
      expect(t.paragraph.text.toPlainText(), expected);
      expect(t.paragraph.didExceedMaxLines, isFalse);
      expect(
        t.paragraph.textSize.width,
        lessThanOrEqualTo(t.paragraph.size.width + 0.5),
      );
      expect(
        t.paragraph.textSize.height,
        lessThanOrEqualTo(t.paragraph.size.height + 0.5),
      );
      expect(t.rect.left, greaterThanOrEqualTo(0));
      expect(t.rect.right, lessThanOrEqualTo(width + 0.5));
      final Rect back = tester.getRect(find.byType(PrimerDetailBackButton));
      expect(back.overlaps(t.rect), isFalse);
      expect(back.width, greaterThanOrEqualTo(48));
      expect(back.height, greaterThanOrEqualTo(48));
      expect(
        tester.getSemantics(
          find.descendant(
            of: find.byType(SettingsAppBar),
            matching: find.text(expected),
          ),
        ),
        isSemantics(label: expected, isHeader: true, namesRoute: true),
      );
    }

    for (final AppThemePreference theme in <AppThemePreference>[
      AppThemePreference.dark,
      AppThemePreference.light,
    ]) {
      testWidgets('${theme.name}: "Acknowledgements" at 320dp @200% fits on '
          'one line at the reference size (42 → 36.6px), heading intact', (
        WidgetTester tester,
      ) async {
        await _pump(
          tester,
          location: '/settings/acknowledgements',
          theme: theme,
          textScale: 2,
          size: const Size(320, 2000),
        );
        final ({Text text, RenderParagraph paragraph, Rect rect}) t = title(
          tester,
          'Acknowledgements',
        );
        expect(_wdth(t.text.style), 62);
        final double shown = t.text.style!.fontSize! * 2;
        // The reference: 36.63px (`floor(42 × column × 100 / needed) / 100`).
        expect(shown, closeTo(36.63, 0.1));
        expect(shown, greaterThanOrEqualTo(42 * (1 - 0.13) - 0.01));
        expect(lines(t.paragraph), 1);
        expect(
          t.paragraph.textSize.width,
          lessThanOrEqualTo(column(320) + 0.5),
        );
        expectIntactHeading(tester, 'Acknowledgements', 320);

        // Back stays its own action and its keyboard ring is unchanged.
        await _keyboardMode(tester);
        final Finder back = find.byType(PrimerDetailBackButton);
        _targetNode(tester, back).requestFocus();
        await tester.pump();
        await tester.pump();
        expect(_ringVisible(tester, back), isTrue);
        await tester.sendKeyEvent(LogicalKeyboardKey.enter);
        await tester.pumpAndSettle();
        expect(find.byType(AcknowledgementsScreen), findsNothing);
      });
    }

    testWidgets('Dark and Light lay the fitted title out identically', (
      WidgetTester tester,
    ) async {
      final List<Rect> rects = <Rect>[];
      final List<double?> sizes = <double?>[];
      for (final AppThemePreference theme in <AppThemePreference>[
        AppThemePreference.dark,
        AppThemePreference.light,
      ]) {
        await _pump(
          tester,
          location: '/settings/acknowledgements',
          theme: theme,
          textScale: 2,
          size: const Size(320, 2000),
        );
        final ({Text text, RenderParagraph paragraph, Rect rect}) t = title(
          tester,
          'Acknowledgements',
        );
        rects.add(t.rect);
        sizes.add(t.text.style!.fontSize);
      }
      expect(rects.first, rects.last);
      expect(sizes.first, sizes.last);
    });

    // Titles that fit, multi-word titles and the Spanish single word keep
    // the approved size (and their approved wrapping).
    for (final (
          String location,
          Locale locale,
          String expected,
          double w,
          double scale,
          int expectedLines,
        )
        in <(String, Locale, String, double, double, int)>[
          (
            '/settings/acknowledgements',
            const Locale('es'),
            'Agradecimientos',
            320,
            2,
            1,
          ),
          (
            '/settings/acknowledgements',
            const Locale('en'),
            'Acknowledgements',
            390,
            1,
            1,
          ),
          ('/settings/data', const Locale('en'), 'Data and updates', 390, 1, 1),
          ('/settings/about', const Locale('en'), 'App information', 390, 1, 1),
          (
            '/settings/privacy',
            const Locale('en'),
            'Privacy and legal',
            390,
            1,
            1,
          ),
          ('/settings/data', const Locale('en'), 'Data and updates', 320, 2, 2),
          (
            '/settings/about',
            const Locale('es'),
            'Información de la aplicación',
            320,
            2,
            3,
          ),
          (
            '/settings/privacy',
            const Locale('es'),
            'Privacidad y aviso legal',
            320,
            2,
            2,
          ),
          (
            '/settings/privacy',
            const Locale('en'),
            'Privacy and legal',
            320,
            2,
            2,
          ),
        ]) {
      testWidgets('"$expected" at ${w.toInt()}dp @${(scale * 100).toInt()}% '
          'keeps the approved size and $expectedLines line(s)', (
        WidgetTester tester,
      ) async {
        await _pump(
          tester,
          location: location,
          locale: locale,
          textScale: scale,
          size: Size(w, 2000),
        );
        final ({Text text, RenderParagraph paragraph, Rect rect}) t = title(
          tester,
          expected,
        );
        expect(t.text.style!.fontSize, 21);
        expect(lines(t.paragraph), expectedLines);
        expectIntactHeading(tester, expected, w);
      });
    }

    // Beyond the 13% bound nothing shrinks: the word keeps the approved size
    // and wraps, whole and readable, never clipped.
    for (final (double w, double scale) in <(double, double)>[
      (300, 2),
      (300, 2.5),
      (320, 2.5),
    ]) {
      testWidgets(
        '"Acknowledgements" at ${w.toInt()}dp @${(scale * 100).toInt()}% '
        'exceeds the bound and wraps at the approved size',
        (WidgetTester tester) async {
          await _pump(
            tester,
            location: '/settings/acknowledgements',
            textScale: scale,
            size: Size(w, 2400),
          );
          final ({Text text, RenderParagraph paragraph, Rect rect}) t = title(
            tester,
            'Acknowledgements',
          );
          expect(t.text.style!.fontSize, 21);
          expect(_wdth(t.text.style), 62);
          expect(lines(t.paragraph), greaterThan(1));
          expectIntactHeading(tester, 'Acknowledgements', w);
        },
      );
    }

    testWidgets('a language change re-fits the title in place', (
      WidgetTester tester,
    ) async {
      await _pump(
        tester,
        location: '/settings/language',
        textScale: 2,
        size: const Size(320, 2400),
      );
      Future<void> choose(AppLanguagePreference language) async {
        final Finder option = find.byKey(
          ValueKey<Object?>('preference-option-$language'),
        );
        await tester.ensureVisible(option);
        await tester.tap(option);
        await tester.pumpAndSettle();
      }

      Future<void> openAcknowledgements() async {
        unawaited(
          GoRouter.of(
            tester.element(find.byType(SettingsAppBar)),
          ).push<void>('/settings/acknowledgements'),
        );
        await tester.pumpAndSettle();
      }

      await choose(AppLanguagePreference.spanish);
      await openAcknowledgements();
      expect(title(tester, 'Agradecimientos').text.style!.fontSize, 21);
      expectIntactHeading(tester, 'Agradecimientos', 320);
      await tester.tap(find.byType(PrimerDetailBackButton));
      await tester.pumpAndSettle();

      await choose(AppLanguagePreference.english);
      await openAcknowledgements();
      final ({Text text, RenderParagraph paragraph, Rect rect}) en = title(
        tester,
        'Acknowledgements',
      );
      expect(en.text.style!.fontSize! * 2, closeTo(36.63, 0.1));
      expect(lines(en.paragraph), 1);
      expectIntactHeading(tester, 'Acknowledgements', 320);
    });

    test('settingsSingleWordFitSize applies only to one overlong word, '
        'within the bound', () {
      const TextScaler x2 = TextScaler.linear(2);
      // Multi-word text never shrinks, however narrow.
      expect(
        settingsSingleWordFitSize(
          text: 'Data and updates',
          role: SettingsType.appBarTitle,
          width: 62,
          maxWidth: 40,
          textScaler: x2,
          maxReduction: 0.13,
        ),
        isNull,
      );
      // An empty string or an unbounded column does nothing.
      for (final double maxWidth in <double>[double.infinity, 0]) {
        expect(
          settingsSingleWordFitSize(
            text: 'Acknowledgements',
            role: SettingsType.appBarTitle,
            width: 62,
            maxWidth: maxWidth,
            textScaler: x2,
            maxReduction: 0.13,
          ),
          isNull,
        );
      }
    });
  });

  group('rendering (fit)', () {
    testWidgets('fact values take wdth 88 in a list at most 17em wide', (
      WidgetTester tester,
    ) async {
      await _pump(tester, location: '/settings/data');
      expect(
        _wdth(_factValue(tester, 'Data source', 'GridView service').style),
        100,
      );
      await _pump(
        tester,
        location: '/settings/data',
        textScale: 2,
        size: const Size(320, 3000),
      );
      expect(
        _wdth(_factValue(tester, 'Data source', 'GridView service').style),
        88,
      );
    });
  });

  group('components', () {
    test(
      'settingsAttributedLabel drops blanks and marks only located parts',
      () {
        final AttributedString label =
            settingsAttributedLabel(const <SettingsSpokenPart>[
              SettingsSpokenPart('Licence'),
              SettingsSpokenPart('  '),
              SettingsSpokenPart(null),
              SettingsSpokenPart('Title', locale: Locale('en')),
            ]);
        expect(label.string, 'Licence, Title');
        final LocaleStringAttribute mark =
            label.attributes.single as LocaleStringAttribute;
        expect(mark.range, const TextRange(start: 9, end: 14));
      },
    );

    testWidgets('a fact list with no values renders nothing', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        const Directionality(
          textDirection: TextDirection.ltr,
          child: SettingsFactList(
            facts: <SettingsFact>[
              SettingsFact(label: 'A', value: null),
              SettingsFact(label: 'B', value: ''),
            ],
          ),
        ),
      );
      expect(find.text('A'), findsNothing);
      expect(find.text('B'), findsNothing);
    });

    test('the static policy row is a Settings row without an action', () {
      const SettingsNavigationRow row = SettingsNavigationRow(title: 'x');
      expect(row.onActivate, isNull);
    });
  });
}
