import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:gridview/features/settings/application/external_links.dart';
import 'package:gridview/features/shared/domain/entities/calendar_entry.dart';
import 'package:gridview/features/shared/domain/entities/standing_entry.dart';

import '../support/a11y_harness.dart';
import '../support/domain_fixtures.dart';
import '../support/entity_fixtures.dart';
import '../support/fake_entity_repository.dart';
import '../support/fake_repository.dart';
import '../support/router_harness.dart';

/// Identifier suppression, extended from Explore and Grand Prix (where the
/// pattern already exists) to Home, Calendar, Standings, Settings and the three
/// entity detail screens.
///
/// The method is a sentinel, not a pattern ban: each screen is given data whose
/// stable identifiers and URLs are strings that could not plausibly occur any
/// other way, and the screen must surface none of them — neither as rendered
/// text nor as an accessibility label. Banning identifier-*shaped* strings
/// globally would be both unreliable and unfair to real content ("red-bull" is
/// a plausible word pair), so the assertion is about these exact values.
///
/// A label leak is the same defect as a text leak, in the one place a sighted
/// reviewer will never look.
void main() {
  const Size tall = Size(390, 1600);

  // Deliberately implausible as content, so a match can only be a leak.
  const String driverIdSentinel = 'zzq-driver-id-4f7b91';
  const String teamIdSentinel = 'zzq-team-id-4f7b91';
  const String circuitIdSentinel = 'zzq-circuit-id-4f7b91';
  const String policyUrlSentinel = 'https://zzq-policy-4f7b91.invalid/legal';
  const String contactSentinel = 'zzq-contact-4f7b91@invalid.test';

  /// The humanised form the removed fallbacks used to render, so a regression
  /// to "prettifying" an identifier fails as loudly as printing it raw.
  List<String> forms(String sentinel) => <String>[
    sentinel,
    sentinel.replaceAll('-', ' '),
    sentinel.split('-').map((String p) => p.toUpperCase()).join(' '),
    'Zzq',
  ];

  void expectNoLeak(WidgetTester tester, List<String> sentinels) {
    for (final String sentinel in sentinels) {
      for (final String form in forms(sentinel)) {
        expectNeverSurfaced(tester, form);
      }
    }
  }

  testWidgets('Home surfaces no stable identifier', (
    WidgetTester tester,
  ) async {
    final SemanticsHandle handle = tester.ensureSemantics();
    await pumpApp(
      tester,
      surfaceSize: tall,
      disableAnimations: true,
      repository: FakeRaceWeekendRepository(
        dashboard: homeDashboardFixture(
          upcoming: <CalendarEntry>[
            calendarEntry(
              round: 14,
              name: 'Hungarian Grand Prix',
              circuitId: circuitIdSentinel,
            ),
          ],
          driverLeaders: <DriverStandingEntry>[
            driverStandingEntry(
              driverId: driverIdSentinel,
              driverName: 'Real Leader',
              constructorId: teamIdSentinel,
              constructorName: 'Real Team',
              order: 0,
              position: 1,
              points: 241,
            ),
          ],
        ),
        home: homeViewFixture(),
        calendar: (int season) => calendarFixture(season: season),
        grandPrix: (int season, int round) =>
            grandPrixDetailFixture(season, round),
      ),
    );

    expect(labelOccurrences(tester, 'Real Leader'), greaterThan(0));
    expectNoLeak(tester, <String>[
      driverIdSentinel,
      teamIdSentinel,
      circuitIdSentinel,
    ]);
    handle.dispose();
  });

  testWidgets('Calendar surfaces no stable identifier', (
    WidgetTester tester,
  ) async {
    final SemanticsHandle handle = tester.ensureSemantics();
    await pumpApp(
      tester,
      initialLocation: '/calendar',
      surfaceSize: tall,
      disableAnimations: true,
      repository: FakeRaceWeekendRepository(
        home: homeViewFixture(),
        dashboard: homeDashboardFixture(),
        calendar: (int season) => <CalendarEntry>[
          calendarEntry(
            season: season,
            round: 1,
            name: 'Belgian Grand Prix',
            startDate: '2026-07-24',
            endDate: '2026-07-26',
            circuitId: circuitIdSentinel,
          ),
        ],
        grandPrix: (int season, int round) =>
            grandPrixDetailFixture(season, round),
      ),
    );

    expect(labelOccurrences(tester, 'Belgian Grand Prix'), greaterThan(0));
    expectNoLeak(tester, <String>[circuitIdSentinel]);
    handle.dispose();
  });

  testWidgets('Standings surfaces no stable identifier', (
    WidgetTester tester,
  ) async {
    final SemanticsHandle handle = tester.ensureSemantics();
    await pumpApp(
      tester,
      initialLocation: '/standings/drivers/2026',
      surfaceSize: tall,
      disableAnimations: true,
      standings: FakeStandingsRepository(
        drivers: (int season) => <DriverStandingEntry>[
          driverStandingEntry(
            season: season,
            driverId: driverIdSentinel,
            driverName: 'Real Driver',
            constructorId: teamIdSentinel,
            constructorName: 'Real Team',
            order: 0,
            position: 1,
            points: 100,
          ),
        ],
        constructors: (int season) =>
            constructorStandingsFixture(season: season),
      ),
    );

    expect(labelOccurrences(tester, 'Real Driver'), greaterThan(0));
    expectNoLeak(tester, <String>[driverIdSentinel, teamIdSentinel]);
    handle.dispose();
  });

  testWidgets('the driver detail surfaces neither its own id nor its team id', (
    WidgetTester tester,
  ) async {
    final SemanticsHandle handle = tester.ensureSemantics();
    await pumpApp(
      tester,
      initialLocation: '/drivers/$driverIdSentinel',
      surfaceSize: tall,
      disableAnimations: true,
      drivers: FakeDriverRepository(
        profile: (int season, String driverId) => driverProfileFixture(
          season: season,
          driverId: driverId,
          name: 'Real Driver',
        ),
      ),
    );

    expect(labelOccurrences(tester, 'Real Driver'), greaterThan(0));
    expectNoLeak(tester, <String>[driverIdSentinel]);
    handle.dispose();
  });

  testWidgets('the team detail surfaces no stable identifier', (
    WidgetTester tester,
  ) async {
    final SemanticsHandle handle = tester.ensureSemantics();
    await pumpApp(
      tester,
      initialLocation: '/constructors/$teamIdSentinel',
      surfaceSize: tall,
      disableAnimations: true,
      constructors: FakeConstructorRepository(
        profile: (int season, String constructorId) => teamProfileFixture(
          season: season,
          constructorId: constructorId,
          stableName: 'Real Team',
          seasonName: 'Real Team Racing',
        ),
      ),
    );

    expect(labelOccurrences(tester, 'Real Team'), greaterThan(0));
    expectNoLeak(tester, <String>[teamIdSentinel]);
    handle.dispose();
  });

  testWidgets('the circuit detail surfaces no stable identifier', (
    WidgetTester tester,
  ) async {
    final SemanticsHandle handle = tester.ensureSemantics();
    await pumpApp(
      tester,
      initialLocation: '/circuits/$circuitIdSentinel',
      surfaceSize: tall,
      disableAnimations: true,
      circuits: FakeCircuitRepository(
        profile: (int season, String circuitId) => circuitProfileFixture(
          season: season,
          circuitId: circuitId,
          name: 'Real Circuit',
        ),
      ),
    );

    expect(labelOccurrences(tester, 'Real Circuit'), greaterThan(0));
    expectNoLeak(tester, <String>[circuitIdSentinel]);
    handle.dispose();
  });

  testWidgets('Settings surfaces neither the policy URL nor the contact '
      'address', (WidgetTester tester) async {
    final SemanticsHandle handle = tester.ensureSemantics();
    for (final String location in <String>[
      '/settings',
      '/settings/privacy',
      '/settings/about',
    ]) {
      await pumpApp(
        tester,
        initialLocation: location,
        surfaceSize: tall,
        disableAnimations: true,
        linkConfig: ExternalLinkConfig(
          privacyPolicy: ExternalLink.parse(policyUrlSentinel),
          supportContact: ExternalLink.parse(contactSentinel),
        ),
      );

      expect(
        renderedLabels(tester),
        isNotEmpty,
        reason: '$location must actually have rendered',
      );
      expectNeverSurfaced(tester, policyUrlSentinel);
      expectNeverSurfaced(tester, 'zzq-policy-4f7b91');
      expectNeverSurfaced(tester, contactSentinel);
      expectNeverSurfaced(tester, 'zzq-contact-4f7b91');
    }
    handle.dispose();
  });
}
