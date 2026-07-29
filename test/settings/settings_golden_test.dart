import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/app/environment/app_environment.dart';
import 'package:gridview/core/preferences/preference_values.dart';
import 'package:gridview/features/settings/application/app_info.dart';
import 'package:gridview/features/settings/application/external_links.dart';
import 'package:gridview/features/shared/domain/entities/enums.dart';
import 'package:gridview/features/shared/domain/entities/media.dart';

import '../support/router_harness.dart';

/// Visual coverage for the Phase 8A Settings surfaces.
///
/// Everything that could make an image non-deterministic is pinned: locale,
/// theme preference, platform brightness, surface size, text scale, clock,
/// device time zone, data-source mode, package metadata and the external-link
/// configuration. Animations are disabled, so no frame is captured mid-transition.
///
/// The flutter_test font does not render real glyph shapes, so these images
/// verify layout, colour and hierarchy only. The exact visible copy is asserted
/// separately, by widget and semantics matchers, in settings_widget_test.dart.
const Size _device = Size(390, 844);

/// Package metadata is fixed so the About screen never renders a moving version.
const AppInfoReader _appInfo = FakeAppInfoReader(
  AppInfo(appName: 'GridView', version: '1.2.1', buildNumber: '7'),
);

Future<void> _pumpSettings(
  WidgetTester tester, {
  String location = '/settings',
  Locale locale = const Locale('en'),
  AppPreferences preferences = AppPreferences.defaults,
  AppEnvironment environment = AppEnvironment.development,
  ExternalLinkConfig linkConfig = const ExternalLinkConfig(),
  double textScale = 1.0,
  Size surfaceSize = _device,
  List<MediaAttribution> mediaAttributions = const <MediaAttribution>[],
}) => pumpApp(
  tester,
  initialLocation: location,
  locale: locale,
  preferences: preferences,
  environment: environment,
  linkConfig: linkConfig,
  appInfoReader: _appInfo,
  mediaAttributions: mediaAttributions,
  textScale: textScale,
  surfaceSize: surfaceSize,
  // Pinned so `AppThemePreference.system` — if ever captured — is deterministic.
  platformBrightness: Brightness.dark,
  disableAnimations: true,
  // The pinned clock and device zone keep the Data screen's season and any time
  // output stable.
  clock: DateTime.utc(2026, 7, 18, 12, 10),
  deviceTimeZone: 'UTC',
);

Future<void> _expectGolden(WidgetTester tester, String name) => expectLater(
  find.byType(MaterialApp),
  matchesGoldenFile('goldens/$name.png'),
);

void main() {
  testWidgets('golden: settings root dark English', (
    WidgetTester tester,
  ) async {
    await _pumpSettings(tester);
    await _expectGolden(tester, 'settings_root_dark_en');
  });

  testWidgets('golden: settings root dark Spanish', (
    WidgetTester tester,
  ) async {
    await _pumpSettings(
      tester,
      preferences: AppPreferences.defaults.copyWith(
        language: AppLanguagePreference.spanish,
      ),
    );
    await _expectGolden(tester, 'settings_root_dark_es');
  });

  testWidgets('golden: language selection', (WidgetTester tester) async {
    await _pumpSettings(tester, location: '/settings/language');
    await _expectGolden(tester, 'settings_language');
  });

  testWidgets('golden: theme selection', (WidgetTester tester) async {
    await _pumpSettings(tester, location: '/settings/theme');
    await _expectGolden(tester, 'settings_theme');
  });

  testWidgets('golden: time display selection', (WidgetTester tester) async {
    await _pumpSettings(tester, location: '/settings/time');
    await _expectGolden(tester, 'settings_time');
  });

  testWidgets('golden: data and application information', (
    WidgetTester tester,
  ) async {
    await _pumpSettings(tester, location: '/settings/data');
    await _expectGolden(tester, 'settings_data');
  });

  testWidgets('golden: application information', (WidgetTester tester) async {
    await _pumpSettings(tester, location: '/settings/about');
    await _expectGolden(tester, 'settings_about');
  });

  // The privacy screen with nothing configured — the state a build actually has
  // today — so the absence of an external-link action is visually pinned.
  testWidgets('golden: privacy and legal with no configured policy', (
    WidgetTester tester,
  ) async {
    await _pumpSettings(tester, location: '/settings/privacy');
    await _expectGolden(tester, 'settings_privacy_unconfigured');
  });

  testWidgets('golden: privacy and legal with a configured policy', (
    WidgetTester tester,
  ) async {
    await _pumpSettings(
      tester,
      location: '/settings/privacy',
      linkConfig: ExternalLinkConfig(
        privacyPolicy: ExternalLink.parse('https://example.org/privacy'),
      ),
    );
    await _expectGolden(tester, 'settings_privacy_configured');
  });

  testWidgets('golden: acknowledgements empty state', (
    WidgetTester tester,
  ) async {
    await _pumpSettings(tester, location: '/settings/acknowledgements');
    await _expectGolden(tester, 'settings_acknowledgements_empty');
  });

  testWidgets('golden: acknowledgements populated', (
    WidgetTester tester,
  ) async {
    await _pumpSettings(
      tester,
      location: '/settings/acknowledgements',
      // Deterministic, repository-owned fixtures: no real asset, no network.
      mediaAttributions: const <MediaAttribution>[
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
    await _expectGolden(tester, 'settings_acknowledgements_populated');
  });

  // Large text on the narrowest supported width: the case that would expose a
  // clipped preference value or a fixed-height row.
  testWidgets('golden: settings root at 200% text on a narrow phone', (
    WidgetTester tester,
  ) async {
    await _pumpSettings(
      tester,
      textScale: 2.0,
      surfaceSize: const Size(320, 1400),
    );
    await _expectGolden(tester, 'settings_root_large_text_narrow');
  });

  testWidgets('golden: time display selection at 200% text', (
    WidgetTester tester,
  ) async {
    await _pumpSettings(
      tester,
      location: '/settings/time',
      textScale: 2.0,
      surfaceSize: const Size(320, 1000),
    );
    await _expectGolden(tester, 'settings_time_large_text_narrow');
  });

  // Production with nothing configured: the Developer section and the feedback
  // row are both absent, so the omission is pinned visually and cannot regress
  // into a dead control or a self-explaining absence.
  testWidgets('golden: settings root production with nothing configured', (
    WidgetTester tester,
  ) async {
    await _pumpSettings(tester, environment: AppEnvironment.production);
    await _expectGolden(tester, 'settings_root_production');
  });

  testWidgets('golden: privacy and legal in production with no policy', (
    WidgetTester tester,
  ) async {
    await _pumpSettings(
      tester,
      location: '/settings/privacy',
      environment: AppEnvironment.production,
    );
    await _expectGolden(tester, 'settings_privacy_production');
  });

  testWidgets('golden: settings root light theme', (WidgetTester tester) async {
    await _pumpSettings(
      tester,
      preferences: AppPreferences.defaults.copyWith(
        theme: AppThemePreference.light,
      ),
    );
    await _expectGolden(tester, 'settings_root_light');
  });
}
