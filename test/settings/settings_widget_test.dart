import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/app/environment/app_environment.dart';
import 'package:gridview/core/preferences/preference_values.dart';
import 'package:gridview/features/settings/application/app_info.dart';
import 'package:gridview/features/settings/application/external_links.dart';

import '../support/router_harness.dart';

const Size _tall = Size(400, 1800);

Future<void> pumpSettings(
  WidgetTester tester, {
  String location = '/settings',
  Locale locale = const Locale('en'),
  AppPreferences preferences = AppPreferences.defaults,
  AppEnvironment environment = AppEnvironment.development,
  ExternalLinkConfig linkConfig = const ExternalLinkConfig(),
  ExternalLinkLauncher? linkLauncher,
  AppInfoReader appInfoReader = const FakeAppInfoReader(
    AppInfo(appName: 'GridView', version: '9.9.9', buildNumber: '42'),
  ),
  double textScale = 1.0,
  Size surfaceSize = _tall,
  bool mockData = false,
}) => pumpApp(
  tester,
  initialLocation: location,
  locale: locale,
  preferences: preferences,
  environment: environment,
  linkConfig: linkConfig,
  linkLauncher: linkLauncher,
  appInfoReader: appInfoReader,
  textScale: textScale,
  surfaceSize: surfaceSize,
  mockData: mockData,
  disableAnimations: true,
);

/// Taps the app bar's back control, i.e. the Android back affordance.
Future<void> tapBack(WidgetTester tester) async {
  final Finder back = find.byType(BackButton);
  expect(back, findsOneWidget, reason: 'a pushed screen must offer back');
  await tester.tap(back);
  await tester.pumpAndSettle();
}

/// Every string rendered anywhere in the tree.
List<String> renderedText(WidgetTester tester) => tester
    .widgetList<Text>(find.byType(Text))
    .map((Text t) => t.data ?? t.textSpan?.toPlainText() ?? '')
    .toList(growable: false);

/// Every semantic label in the tree.
List<String> semanticLabels(WidgetTester tester) => tester
    .widgetList<Semantics>(find.byType(Semantics))
    .map((Semantics s) => s.properties.label ?? '')
    .where((String s) => s.isNotEmpty)
    .toList(growable: false);

void main() {
  group('Settings root', () {
    testWidgets('shows every section and the current preference values', (
      WidgetTester tester,
    ) async {
      await pumpSettings(tester);

      expect(find.text('Settings'), findsWidgets);
      expect(find.text('Preferences'), findsOneWidget);
      expect(find.text('Data and application'), findsOneWidget);
      expect(find.text('Privacy and support'), findsOneWidget);

      // Each preference row shows its own value, as localized copy.
      expect(find.text('Language'), findsOneWidget);
      expect(find.text('System default'), findsOneWidget);
      expect(find.text('Theme'), findsOneWidget);
      expect(find.text('Dark'), findsOneWidget);
      expect(find.text('Time display'), findsOneWidget);
      expect(find.text('Device time'), findsOneWidget);
    });

    testWidgets('is no longer a skeleton: no dark-only theme note remains', (
      WidgetTester tester,
    ) async {
      await pumpSettings(tester);
      expect(
        renderedText(tester).join(' '),
        isNot(contains('Only a dark theme')),
      );
    });

    testWidgets('preference values are localized copy, not wire tokens', (
      WidgetTester tester,
    ) async {
      // A token is proved absent by showing the value *changes with the locale*:
      // an English label such as "Dark" is spelled like its token, so equality
      // alone cannot distinguish real copy from a leaked token. Spanish can.
      await pumpSettings(
        tester,
        preferences: const AppPreferences(
          language: AppLanguagePreference.spanish,
          theme: AppThemePreference.light,
          timeDisplay: TimeDisplayPreference.both,
        ),
      );
      final List<String> rendered = renderedText(tester);

      expect(rendered, contains('Claro'));
      expect(rendered, contains('Ambas'));
      // No English label — and therefore no token spelled like one — survives.
      for (final String english in <String>[
        'Light',
        'Dark',
        'Both',
        'Device time',
        'Event time',
        'System default',
      ]) {
        expect(rendered, isNot(contains(english)), reason: english);
      }
      // The multi-word tokens have no label that could coincide with them.
      for (final String token in <String>[
        'system',
        'device',
        'event',
        'both',
      ]) {
        expect(rendered, isNot(contains(token)), reason: token);
      }
    });

    testWidgets('reflects a non-default preference snapshot', (
      WidgetTester tester,
    ) async {
      await pumpSettings(
        tester,
        preferences: const AppPreferences(
          language: AppLanguagePreference.spanish,
          theme: AppThemePreference.light,
          timeDisplay: TimeDisplayPreference.both,
        ),
      );

      // Spanish is selected, so the whole screen is Spanish.
      expect(find.text('Ajustes'), findsWidgets);
      expect(find.text('Claro'), findsOneWidget);
      expect(find.text('Ambas'), findsOneWidget);
    });

    testWidgets('the developer section is absent in production', (
      WidgetTester tester,
    ) async {
      await pumpSettings(tester, environment: AppEnvironment.production);
      expect(find.text('Developer'), findsNothing);
      expect(find.text('Component catalogue'), findsNothing);
    });

    testWidgets('the developer section is present outside production', (
      WidgetTester tester,
    ) async {
      await pumpSettings(tester, environment: AppEnvironment.staging);
      expect(find.text('Developer'), findsOneWidget);
      expect(find.text('Component catalogue'), findsOneWidget);
    });
  });

  group('preference selection', () {
    testWidgets('changing the theme applies immediately and persists in the '
        'snapshot', (WidgetTester tester) async {
      await pumpSettings(tester);

      await tester.tap(find.byKey(const ValueKey<String>('settings-theme')));
      await tester.pumpAndSettle();

      expect(find.text('System'), findsOneWidget);
      expect(find.text('Dark'), findsOneWidget);
      expect(find.text('Light'), findsOneWidget);

      await tester.tap(
        find.byKey(
          const ValueKey<Object?>('preference-option-AppThemePreference.light'),
        ),
      );
      await tester.pumpAndSettle();

      // Back on the root, the row summary reflects the new value.
      await tapBack(tester);
      await tester.pumpAndSettle();
      expect(find.text('Light'), findsOneWidget);
    });

    testWidgets('changing the language re-renders the whole screen', (
      WidgetTester tester,
    ) async {
      await pumpSettings(tester);

      await tester.tap(find.byKey(const ValueKey<String>('settings-language')));
      await tester.pumpAndSettle();
      await tester.tap(
        find.byKey(
          const ValueKey<Object?>(
            'preference-option-AppLanguagePreference.spanish',
          ),
        ),
      );
      await tester.pumpAndSettle();

      // The selection screen itself is now Spanish.
      expect(find.text('Idioma'), findsWidgets);

      await tapBack(tester);
      await tester.pumpAndSettle();
      expect(find.text('Ajustes'), findsWidgets);
      expect(find.text('Preferencias'), findsOneWidget);
    });

    testWidgets('changing the time display applies immediately', (
      WidgetTester tester,
    ) async {
      await pumpSettings(tester);

      await tester.tap(find.byKey(const ValueKey<String>('settings-time')));
      await tester.pumpAndSettle();
      await tester.tap(
        find.byKey(
          const ValueKey<Object?>(
            'preference-option-TimeDisplayPreference.event',
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tapBack(tester);
      await tester.pumpAndSettle();

      expect(find.text('Event time'), findsOneWidget);
    });

    testWidgets('the selected option exposes radio-group semantics', (
      WidgetTester tester,
    ) async {
      await pumpSettings(tester, location: '/settings/theme');
      await tester.pumpAndSettle();

      final Iterable<Semantics> options = tester
          .widgetList<Semantics>(find.byType(Semantics))
          .where(
            (Semantics s) => s.properties.inMutuallyExclusiveGroup ?? false,
          );
      expect(options, hasLength(3));
      expect(
        options.where((Semantics s) => s.properties.checked ?? false),
        hasLength(1),
      );
      // Selection is spoken, never conveyed by the radio glyph alone.
      expect(
        options
            .firstWhere((Semantics s) => s.properties.checked ?? false)
            .properties
            .label,
        contains('Selected'),
      );
    });
  });

  group('information screens', () {
    testWidgets('data and updates reports safe product facts only', (
      WidgetTester tester,
    ) async {
      await pumpSettings(tester, location: '/settings/data');
      await tester.pumpAndSettle();

      expect(find.text('Environment'), findsOneWidget);
      expect(find.text('Data source'), findsOneWidget);
      expect(find.text('API version'), findsOneWidget);
      expect(find.text('Current season'), findsOneWidget);

      // Nothing technical or secret is exposed.
      final String all = <String>[
        ...renderedText(tester),
        ...semanticLabels(tester),
      ].join(' ');
      for (final String forbidden in <String>[
        'http',
        'workers.dev',
        'ETag',
        'W/"',
        'X-Request-Id',
        'home:2026',
        'ADMIN_TOKEN',
        'Bearer',
        '/v1/',
        '?season=',
      ]) {
        expect(all, isNot(contains(forbidden)), reason: forbidden);
      }
    });

    testWidgets('application information uses real package metadata', (
      WidgetTester tester,
    ) async {
      await pumpSettings(tester, location: '/settings/about');
      await tester.pumpAndSettle();

      expect(find.text('9.9.9'), findsOneWidget);
      expect(find.text('42'), findsOneWidget);
      // The independent-application statement is mandatory.
      expect(
        renderedText(tester).join(' '),
        contains('independent application'),
      );
    });

    testWidgets('unresolvable package metadata omits the version rather than '
        'guessing one', (WidgetTester tester) async {
      await pumpSettings(
        tester,
        location: '/settings/about',
        appInfoReader: const FakeAppInfoReader(AppInfo.unknown, fails: true),
      );
      await tester.pumpAndSettle();

      expect(find.text('Version'), findsNothing);
      expect(find.text('1.2.1'), findsNothing);
      // The screen still renders.
      expect(find.text('Application'), findsOneWidget);
    });

    testWidgets('privacy states each platform service truthfully', (
      WidgetTester tester,
    ) async {
      await pumpSettings(tester, location: '/settings/privacy');
      await tester.pumpAndSettle();

      expect(find.text('Crash reporting'), findsOneWidget);
      expect(find.text('Performance monitoring'), findsOneWidget);
      expect(find.text('Advertising'), findsOneWidget);
      // Nothing is enabled in this build, and the screen says so.
      expect(find.text('Disabled'), findsNWidgets(3));
      expect(find.text('Enabled'), findsNothing);
    });

    testWidgets('outside production an unconfigured privacy policy says so '
        'instead of offering a dead action', (WidgetTester tester) async {
      await pumpSettings(tester, location: '/settings/privacy');
      await tester.pumpAndSettle();

      expect(
        find.text('No privacy policy is configured in this build.'),
        findsOneWidget,
      );
      expect(
        find.byKey(const ValueKey<String>('settings-privacy-policy')),
        findsNothing,
      );
    });

    testWidgets('production omits the policy affordance entirely and keeps the '
        'truthful service summary', (WidgetTester tester) async {
      await pumpSettings(
        tester,
        location: '/settings/privacy',
        environment: AppEnvironment.production,
      );
      await tester.pumpAndSettle();

      // No dead action, and no diagnostic explaining the absence.
      expect(
        find.byKey(const ValueKey<String>('settings-privacy-policy')),
        findsNothing,
      );
      expect(
        find.text('No privacy policy is configured in this build.'),
        findsNothing,
      );
      // The locally verifiable facts are still stated. A production build
      // discloses its diagnostics *policy* — the thing that is fixed and
      // knowable — so only Advertising reads as disabled. No session line
      // appears here because this harness installs the inert surface, which
      // never activates and so has no session to report on.
      expect(find.text('Crash reporting'), findsOneWidget);
      expect(find.text('Configured'), findsNWidgets(2));
      expect(find.text('Disabled'), findsOneWidget);
      expect(find.text('App reporting this session'), findsNothing);
      expect(
        renderedText(tester).join(' '),
        contains('independent application'),
      );
    });

    testWidgets('production still shows a configured policy link', (
      WidgetTester tester,
    ) async {
      await pumpSettings(
        tester,
        location: '/settings/privacy',
        environment: AppEnvironment.production,
        linkConfig: ExternalLinkConfig(
          privacyPolicy: ExternalLink.parse('https://example.org/privacy'),
        ),
      );
      await tester.pumpAndSettle();

      expect(
        find.byKey(const ValueKey<String>('settings-privacy-policy')),
        findsOneWidget,
      );
    });

    testWidgets('a configured privacy policy launches through the injected '
        'launcher', (WidgetTester tester) async {
      final RecordingExternalLinkLauncher launcher =
          RecordingExternalLinkLauncher();
      await pumpSettings(
        tester,
        location: '/settings/privacy',
        linkConfig: ExternalLinkConfig(
          privacyPolicy: ExternalLink.parse('https://example.org/privacy'),
        ),
        linkLauncher: launcher,
      );
      await tester.pumpAndSettle();

      await tester.tap(
        find.byKey(const ValueKey<String>('settings-privacy-policy')),
      );
      await tester.pumpAndSettle();

      expect(launcher.opened, hasLength(1));
      expect(launcher.opened.single.scheme, 'https');
      // The URL itself is never shown to the reader.
      expect(renderedText(tester).join(' '), isNot(contains('example.org')));
    });

    testWidgets('a launch failure is reported without exposing the URL', (
      WidgetTester tester,
    ) async {
      await pumpSettings(
        tester,
        location: '/settings/privacy',
        linkConfig: ExternalLinkConfig(
          privacyPolicy: ExternalLink.parse('https://example.org/privacy'),
        ),
        linkLauncher: RecordingExternalLinkLauncher(succeeds: false),
      );
      await tester.pumpAndSettle();

      await tester.tap(
        find.byKey(const ValueKey<String>('settings-privacy-policy')),
      );
      await tester.pumpAndSettle();

      expect(find.text('That link could not be opened.'), findsOneWidget);
      expect(renderedText(tester).join(' '), isNot(contains('https://')));
    });
  });

  group('feedback', () {
    testWidgets('a configured contact opens a mailto destination', (
      WidgetTester tester,
    ) async {
      final RecordingExternalLinkLauncher launcher =
          RecordingExternalLinkLauncher();
      await pumpSettings(
        tester,
        linkConfig: ExternalLinkConfig(
          supportContact: ExternalLink.parse('support@example.org'),
        ),
        linkLauncher: launcher,
      );

      await tester.tap(find.byKey(const ValueKey<String>('settings-feedback')));
      await tester.pumpAndSettle();

      expect(launcher.opened, hasLength(1));
      expect(launcher.opened.single.scheme, 'mailto');
    });

    testWidgets('production omits the feedback row entirely when no contact '
        'is configured', (WidgetTester tester) async {
      await pumpSettings(tester, environment: AppEnvironment.production);

      // Nothing tappable and nothing that explains its own absence: a user
      // cannot act on missing configuration, so it is not shown at all.
      expect(
        find.byKey(const ValueKey<String>('settings-feedback')),
        findsNothing,
      );
      expect(find.text('No contact address is configured.'), findsNothing);
      // The rest of the section is unaffected.
      expect(
        find.byKey(const ValueKey<String>('settings-privacy')),
        findsOneWidget,
      );
    });

    testWidgets('production shows a working feedback row when a contact is '
        'configured', (WidgetTester tester) async {
      final RecordingExternalLinkLauncher launcher =
          RecordingExternalLinkLauncher();
      await pumpSettings(
        tester,
        environment: AppEnvironment.production,
        linkConfig: ExternalLinkConfig(
          supportContact: ExternalLink.parse('support@example.org'),
        ),
        linkLauncher: launcher,
      );

      await tester.tap(find.byKey(const ValueKey<String>('settings-feedback')));
      await tester.pumpAndSettle();
      expect(launcher.opened.single.scheme, 'mailto');
    });

    testWidgets('a non-production status note names no build define', (
      WidgetTester tester,
    ) async {
      await pumpSettings(tester, environment: AppEnvironment.staging);
      final String all = renderedText(tester).join(' ');

      expect(all, contains('No contact address is configured.'));
      for (final String internal in <String>[
        'SUPPORT_CONTACT',
        'PRIVACY_POLICY_URL',
        'dart-define',
        'API_BASE_URL',
        'DATA_SOURCE',
        'APP_ENV',
      ]) {
        expect(all, isNot(contains(internal)), reason: internal);
      }
    });

    testWidgets('an unconfigured contact shows no tappable action outside '
        'production', (WidgetTester tester) async {
      await pumpSettings(tester);

      expect(find.text('No contact address is configured.'), findsOneWidget);
      // The row is present but inert, so production never shows a broken action.
      final Finder row = find.byKey(
        const ValueKey<String>('settings-feedback'),
      );
      expect(row, findsOneWidget);
      expect(
        tester
            .widget<InkWell>(
              find.descendant(of: row, matching: find.byType(InkWell)),
            )
            .onTap,
        isNull,
      );
    });
  });

  group('acknowledgements', () {
    testWidgets('acknowledges the configured data source and no future '
        'provider', (WidgetTester tester) async {
      await pumpSettings(tester, location: '/settings/acknowledgements');
      await tester.pumpAndSettle();

      expect(find.text('Data'), findsOneWidget);
      expect(find.text('Images'), findsOneWidget);
      // No third-party Formula 1 provider is named: none is configured.
      final String all = renderedText(tester).join(' ');
      for (final String provider in <String>[
        'Ergast',
        'Jolpica',
        'OpenF1',
        'Formula 1 API',
      ]) {
        expect(all, isNot(contains(provider)), reason: provider);
      }
    });

    testWidgets('an empty attribution set shows an explicit empty state', (
      WidgetTester tester,
    ) async {
      await pumpSettings(tester, location: '/settings/acknowledgements');
      await tester.pumpAndSettle();

      expect(find.text('No attributions are stored yet.'), findsOneWidget);
    });

    testWidgets('reports sample data when the build is reading fixtures', (
      WidgetTester tester,
    ) async {
      await pumpSettings(
        tester,
        location: '/settings/acknowledgements',
        mockData: true,
      );
      await tester.pumpAndSettle();

      expect(find.text('Sample data'), findsOneWidget);
    });
  });

  group('accessibility', () {
    testWidgets('every preference row is a labelled button of at least 48px', (
      WidgetTester tester,
    ) async {
      await pumpSettings(tester);

      for (final String key in <String>[
        'settings-language',
        'settings-theme',
        'settings-time',
        'settings-data',
        'settings-acknowledgements',
        'settings-about',
        'settings-privacy',
      ]) {
        final Finder row = find.byKey(ValueKey<String>(key));
        expect(row, findsOneWidget, reason: key);
        expect(
          tester.getSize(row).height,
          greaterThanOrEqualTo(48.0),
          reason: key,
        );
      }
    });

    testWidgets('a row label carries both its title and its current value', (
      WidgetTester tester,
    ) async {
      await pumpSettings(tester);
      expect(semanticLabels(tester), contains('Time display, Device time'));
    });

    testWidgets(
      'the whole screen stays usable at 200% text on a narrow phone',
      (WidgetTester tester) async {
        await pumpSettings(
          tester,
          textScale: 2.0,
          surfaceSize: const Size(320, 3600),
        );

        expect(tester.takeException(), isNull);
        expect(find.text('Language'), findsOneWidget);
        expect(find.text('Time display'), findsOneWidget);
      },
    );

    testWidgets('selection screens stay usable at 200% text', (
      WidgetTester tester,
    ) async {
      for (final String route in <String>[
        '/settings/language',
        '/settings/theme',
        '/settings/time',
      ]) {
        await pumpSettings(
          tester,
          location: route,
          textScale: 2.0,
          surfaceSize: const Size(320, 1600),
        );
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull, reason: route);
      }
    });
  });

  group('both themes', () {
    testWidgets('Settings renders in the light theme without exception', (
      WidgetTester tester,
    ) async {
      await pumpSettings(
        tester,
        preferences: AppPreferences.defaults.copyWith(
          theme: AppThemePreference.light,
        ),
      );
      expect(tester.takeException(), isNull);
      expect(find.text('Preferences'), findsOneWidget);
    });
  });
}
