import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/preferences/preference_values.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';

import '../support/domain_fixtures.dart';
import '../support/router_harness.dart';

/// A representative light-theme matrix for the live screens.
///
/// Deliberately **not** a mechanical duplicate of every dark golden. It covers
/// one frame per structural situation the light palette has to survive:
/// data-dense lists, a hero-led dashboard, an entity detail, a degraded state,
/// and the shell chrome. Between them these frames exercise every semantic role
/// the light theme introduces — background versus surface separation, primary and
/// secondary text, muted values, dividers, selected controls, status/stale
/// colours, filled primary controls, decorative team accents and media
/// placeholders — which is what would actually regress.
///
/// Media still renders as placeholders: Phase 8B has not started.
///
/// Every input is pinned: theme preference (light, so the image never depends on
/// the reported platform brightness), platform brightness, locale, surface size,
/// text scale, clock, device time zone, data-source mode and synchronization
/// metadata.
const Size _device = Size(390, 844);

const AppPreferences _light = AppPreferences(
  language: AppLanguagePreference.english,
  theme: AppThemePreference.light,
  timeDisplay: TimeDisplayPreference.device,
);

Future<void> _pumpLight(
  WidgetTester tester,
  String location, {
  ResourceSyncState? Function(String key)? syncMetadata,
}) => pumpApp(
  tester,
  initialLocation: location,
  surfaceSize: _device,
  disableAnimations: true,
  preferences: _light,
  // Pinned to dark on purpose: an explicit light preference must win over the
  // platform, so this also proves the explicit mode ignores platform brightness.
  platformBrightness: Brightness.dark,
  clock: DateTime.utc(2026, 7, 18, 12, 10),
  deviceTimeZone: 'UTC',
  syncMetadata: syncMetadata,
);

Future<void> _expectGolden(WidgetTester tester, String name) => expectLater(
  find.byType(MaterialApp),
  matchesGoldenFile('goldens/$name.png'),
);

void main() {
  // Hero-led dashboard: filled primary control, section headers, cards, the
  // leader card's team accent, and the shell's pill navigation.
  testWidgets('golden: home light', (WidgetTester tester) async {
    await _pumpLight(tester, '/');
    await _expectGolden(tester, 'light_home');
  });

  // Event list: emphasis on the next round, status tones, dimmed completed rows.
  testWidgets('golden: calendar light', (WidgetTester tester) async {
    await _pumpLight(tester, '/calendar');
    await _expectGolden(tester, 'light_calendar');
  });

  // The densest tabular surface: leader emphasis, tabular figures, segmented
  // control in its selected state.
  testWidgets('golden: standings light', (WidgetTester tester) async {
    await _pumpLight(tester, '/standings');
    await _expectGolden(tester, 'light_standings');
  });

  // Rows with decorative team accents and media placeholders.
  testWidgets('golden: explore light', (WidgetTester tester) async {
    await _pumpLight(tester, '/explore/teams');
    await _expectGolden(tester, 'light_explore');
  });

  // Grand Prix detail: session schedule, times with an explicit zone label.
  testWidgets('golden: grand prix detail light', (WidgetTester tester) async {
    await _pumpLight(tester, '/calendar/2026/13');
    await _expectGolden(tester, 'light_grand_prix');
  });

  // Circuit detail: an entity detail with a media placeholder slot.
  testWidgets('golden: circuit detail light', (WidgetTester tester) async {
    await _pumpLight(tester, '/circuits/spa-francorchamps');
    await _expectGolden(tester, 'light_circuit_detail');
  });

  // A degraded state, where the stale/warning role must stay legible on a light
  // surface without shouting.
  testWidgets('golden: stale cached state light', (WidgetTester tester) async {
    await _pumpLight(
      tester,
      '/standings',
      syncMetadata: (String key) =>
          syncedMetadata(key, staleAfter: DateTime.utc(2026, 7, 18, 11)),
    );
    await _expectGolden(tester, 'light_standings_stale');
  });

  // A never-materialized resource that nonetheless has local content: the rows
  // render and no stale or error affordance appears, because "not yet
  // synchronised" is not "wrong". The light empty state itself is *not* pinned
  // here — the circuits fixture is populated — and remains covered only in dark
  // (`explore_empty`).
  testWidgets('golden: unsynchronised collection light', (
    WidgetTester tester,
  ) async {
    await _pumpLight(tester, '/explore/circuits', syncMetadata: (_) => null);
    await _expectGolden(tester, 'light_explore_first_load');
  });
}
