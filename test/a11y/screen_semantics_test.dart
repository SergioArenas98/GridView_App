import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/shared/domain/entities/calendar_entry.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';

import '../support/a11y_harness.dart';
import '../support/component_harness.dart';
import '../support/domain_fixtures.dart';
import '../support/fake_repository.dart';
import '../support/router_harness.dart';

/// Cross-screen accessibility coverage: reading order (B1), the semantic flags
/// the shared states and controls must carry (B3), and the three Home module
/// states (B6).
///
/// Reading order is asserted as a sequence of landmarks rather than as a dump
/// of every internal node: a snapshot of the whole tree fails whenever a screen
/// changes its layout at all, which teaches nobody anything and trains everyone
/// to re-bless it. What must not silently change is that the Standings title is
/// read before the championship selector, which is read before the first row.
void main() {
  const Size tall = Size(390, 1600);

  Future<void> open(WidgetTester tester, String location) => pumpApp(
    tester,
    initialLocation: location,
    surfaceSize: tall,
    disableAnimations: true,
  );

  group('B1 reading order', () {
    final Map<String, (String, List<String>)> families =
        <String, (String, List<String>)>{
          'Home': (
            '/',
            <String>[
              'GridView',
              'Refresh Home',
              'Open settings',
              '2026 season',
              'Next Grand Prix',
              'Weekend sessions',
              'Latest result',
              'Upcoming events',
              'Home',
              'Calendar',
              'Standings',
              'Explore',
            ],
          ),
          'Calendar': (
            '/calendar',
            <String>[
              'Calendar',
              'Refresh calendar',
              'Open settings',
              '2026 season',
              'British Grand Prix, round 11',
              'Belgian Grand Prix, round 13',
              'Dutch Grand Prix, round 15',
              'Home',
              'Calendar',
              'Standings',
              'Explore',
            ],
          ),
          'Grand Prix': (
            '/calendar/2026/13',
            <String>[
              'Back',
              'Grand Prix',
              'Belgian Grand Prix',
              'Circuit',
              'View circuit',
              'Sessions',
              'Results',
            ],
          ),
          'Standings drivers': (
            '/standings/drivers/2026',
            <String>[
              'Standings',
              'Refresh standings',
              'Open settings',
              '2026 season',
              'Championship',
              'Drivers',
              'Constructors',
              'Position 1, Max Verstappen',
              'Home',
              'Calendar',
              'Standings',
              'Explore',
            ],
          ),
          'Standings constructors': (
            '/standings/constructors/2026',
            <String>[
              'Standings',
              '2026 season',
              'Championship',
              'Drivers',
              'Constructors',
              'Position 1, McLaren Formula 1 Team',
              'Home',
            ],
          ),
          'Explore drivers': (
            '/explore/drivers',
            <String>[
              'Explore',
              'Open settings',
              '2026 season',
              'Explore category',
              'Drivers',
              'Teams',
              'Circuits',
              'Max Verstappen',
              'Home',
              'Calendar',
              'Standings',
              'Explore',
            ],
          ),
          'Explore teams': (
            '/explore/teams',
            <String>[
              'Explore',
              'Explore category',
              'Drivers',
              'Teams',
              'Circuits',
              'BWT Alpine Formula One Team',
              'Home',
            ],
          ),
          'Explore circuits': (
            '/explore/circuits',
            <String>[
              'Explore',
              'Explore category',
              'Drivers',
              'Teams',
              'Circuits',
              'Autodromo Nazionale Monza',
              'Home',
            ],
          ),
          'Driver detail': (
            '/drivers/max-verstappen',
            <String>[
              'Driver',
              'Max Verstappen',
              'Team',
              'Championship',
              'Season participation',
              'Profile',
              'About',
            ],
          ),
          'Team detail': (
            '/constructors/alpine',
            <String>[
              'Team',
              'BWT Alpine Formula One Team',
              'Championship',
              'Drivers',
              'Team details',
              'Team information',
              'About',
            ],
          ),
          'Circuit detail': (
            '/circuits/spa-francorchamps',
            <String>[
              'Circuit',
              'Circuit de Spa-Francorchamps',
              'Circuit facts',
              'Lap record',
              "This season's Grand Prix",
            ],
          ),
          'Settings': (
            '/settings',
            <String>[
              'Settings',
              'Preferences',
              'Language',
              'Theme',
              'Time display',
              'Data and application',
              'Data and updates',
              'Acknowledgements',
              'App information',
              'Privacy and support',
            ],
          ),
          'Settings language': (
            '/settings/language',
            <String>['Back', 'Language', 'System default', 'Español'],
          ),
          'Settings theme': (
            '/settings/theme',
            <String>['Back', 'Theme', 'System', 'Dark', 'Light'],
          ),
          'Settings time': (
            '/settings/time',
            <String>[
              'Back',
              'Time display',
              'Device time',
              'Event time',
              'Both',
            ],
          ),
          // The information screens merge their whole field list into one
          // node, so the landmarks here are node-granular rather than
          // field-granular: the order that matters is back, title, the facts,
          // then the explanatory note.
          'Settings data': (
            '/settings/data',
            <String>[
              'Back',
              'Data and updates',
              'Environment',
              'GridView keeps the season on your device',
            ],
          ),
          'Settings acknowledgements': (
            '/settings/acknowledgements',
            <String>[
              'Back',
              'Acknowledgements',
              'independent application',
              'Data source',
              'Images',
            ],
          ),
          'Settings privacy': (
            '/settings/privacy',
            <String>[
              'Back',
              'Privacy and legal',
              'independent application',
              'Crash reporting',
              'Diagnostic components are included',
              'No privacy policy is configured',
            ],
          ),
          'Settings about': (
            '/settings/about',
            <String>[
              'Back',
              'App information',
              'Application',
              'independent application',
            ],
          ),
        };

    families.forEach((String family, (String, List<String>) spec) {
      final (String location, List<String> landmarks) = spec;
      testWidgets('$family reads its landmarks in order', (
        WidgetTester tester,
      ) async {
        final SemanticsHandle handle = tester.ensureSemantics();
        await open(tester, location);

        expectReadingOrder(tester, landmarks);
        handle.dispose();
      });
    });

    testWidgets('every screen family is covered', (WidgetTester tester) async {
      // A guard against a family being quietly dropped from the table above.
      expect(families, hasLength(19));
    });
  });

  group('B3 semantic flags on shared states and controls', () {
    testWidgets('a bottom-navigation destination is a button, and the current '
        'one is selected', (WidgetTester tester) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await open(tester, '/calendar');

      expect(
        tester.getSemantics(
          find
              .descendant(
                of: find.byType(GvBottomNav),
                matching: find.text('Calendar'),
              )
              .first,
        ),
        isSemantics(isButton: true, isSelected: true),
      );
      expect(
        tester.getSemantics(
          find
              .descendant(
                of: find.byType(GvBottomNav),
                matching: find.text('Home'),
              )
              .first,
        ),
        isSemantics(isButton: true, isSelected: false),
      );
      handle.dispose();
    });

    testWidgets('the championship selector flags the selected segment', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await open(tester, '/standings/constructors/2026');

      expect(
        tester.getSemantics(
          find
              .descendant(
                of: find.byType(GvSegmentedControl),
                matching: find.text('Constructors'),
              )
              .first,
        ),
        isSemantics(isButton: true, isSelected: true),
      );
      handle.dispose();
    });

    testWidgets('a preference option is a checked member of a mutually '
        'exclusive group', (WidgetTester tester) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await open(tester, '/settings/theme');

      expect(
        tester.getSemantics(find.text('Dark')),
        isSemantics(
          isButton: true,
          isChecked: true,
          isSelected: true,
          isInMutuallyExclusiveGroup: true,
        ),
      );
      expect(
        tester.getSemantics(find.text('Light')),
        isSemantics(isChecked: false, isInMutuallyExclusiveGroup: true),
      );
      handle.dispose();
    });

    testWidgets('a settings row is a button carrying its whole name', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await open(tester, '/settings');

      expect(
        tester.getSemantics(find.text('Language')),
        isSemantics(isButton: true),
      );
      handle.dispose();
    });

    testWidgets('an empty state on a real screen is one live region with a '
        'heading title', (WidgetTester tester) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      // The Grand Prix results section before the weekend has run: a genuine
      // GvEmptyState reached through the router, not a component in a vacuum.
      await open(tester, '/calendar/2026/13');

      final List<SemanticsData> regions = liveRegions(tester);
      expect(regions, hasLength(1));
      expect(regions.single.label, 'Results not available yet');
      expect(regions.single.flagsCollection.isHeader, isTrue);
      expect(labelOccurrences(tester, 'Results not available yet'), 1);
      handle.dispose();
    });

    testWidgets('a section header is a heading', (WidgetTester tester) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await open(tester, '/calendar/2026/13');

      final Iterable<String> headingLabels = headings(
        tester,
      ).map((SemanticsData d) => d.label);
      for (final String title in <String>['Circuit', 'Sessions', 'Results']) {
        expect(
          headingLabels.any((String label) => label.contains(title)),
          isTrue,
          reason:
              '"$title" must be reachable as a heading; '
              'headings were $headingLabels',
        );
      }
      handle.dispose();
    });

    testWidgets('a loading screen is one live region and nothing is a '
        'heading below it', (WidgetTester tester) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await pumpApp(
        tester,
        initialLocation: '/standings/drivers/2026',
        surfaceSize: tall,
        disableAnimations: true,
        standings: FakeStandingsRepository(),
        syncMetadata: (String key) => null,
      );

      final List<SemanticsData> regions = liveRegions(tester);
      expect(regions, hasLength(1));
      expect(regions.single.label, 'Loading');
      handle.dispose();
    });

    testWidgets('an offline notice is a live region carrying its message '
        'once', (WidgetTester tester) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await pumpApp(
        tester,
        initialLocation: '/calendar',
        surfaceSize: tall,
        disableAnimations: true,
        // Synced, but past its freshness horizon, so the cached-data notice is
        // the state under test rather than a first load.
        syncMetadata: (String key) => syncedMetadata(
          key,
          lastSuccessAt: DateTime.utc(2026, 7, 1),
          staleAfter: DateTime.utc(2026, 7, 2),
        ),
      );

      expect(find.byType(GvOfflineNotice), findsOneWidget);
      final String message = tester
          .widget<GvOfflineNotice>(find.byType(GvOfflineNotice))
          .message;
      expect(labelOccurrences(tester, message), 1);
      expect(
        liveRegions(
          tester,
        ).where((SemanticsData d) => d.label.contains(message)),
        hasLength(1),
      );
      handle.dispose();
    });

    testWidgets('an informative image is flagged as an image and named once', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await pumpComponent(
        tester,
        const SizedBox(
          width: 120,
          child: GvRemoteImage(
            request: null,
            aspectRatio: 1,
            logicalWidth: 120,
            semanticLabel: 'Portrait of Max Verstappen',
          ),
        ),
      );

      final SemanticsData data = nodeLabelled(
        tester,
        'Portrait of Max Verstappen',
      );
      expect(data.flagsCollection.isImage, isTrue);
      expect(labelOccurrences(tester, 'Portrait of Max Verstappen'), 1);
      handle.dispose();
    });

    testWidgets('a decorative image contributes no semantics at all', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await pumpComponent(
        tester,
        const SizedBox(
          width: 120,
          child: GvRemoteImage(
            request: null,
            aspectRatio: 1,
            logicalWidth: 120,
            decorative: true,
          ),
        ),
      );

      expect(renderedLabels(tester), isEmpty);
      expect(
        semanticsDataList(
          tester,
        ).where((SemanticsData d) => d.flagsCollection.isImage),
        isEmpty,
      );
      handle.dispose();
    });
  });

  group('B6 Home module states', () {
    /// Metadata streams that are open but have emitted nothing, so the module's
    /// materialization record is genuinely still being read.
    ({
      Stream<ResourceSyncState?> Function(String key) streams,
      void Function() close,
    })
    pending() {
      final Map<String, StreamController<ResourceSyncState?>> controllers =
          <String, StreamController<ResourceSyncState?>>{};
      return (
        streams: (String key) => controllers
            .putIfAbsent(key, StreamController<ResourceSyncState?>.broadcast)
            .stream,
        close: () {
          for (final StreamController<ResourceSyncState?> c
              in controllers.values) {
            c.close();
          }
        },
      );
    }

    Future<void> pumpHome(
      WidgetTester tester, {
      List<CalendarEntry>? upcoming,
      ResourceSyncState? Function(String key)? syncMetadata,
      Stream<ResourceSyncState?> Function(String key)? syncMetadataStream,
    }) => pumpApp(
      tester,
      surfaceSize: tall,
      disableAnimations: true,
      syncMetadata: syncMetadata,
      syncMetadataStream: syncMetadataStream,
      repository: FakeRaceWeekendRepository(
        dashboard: homeDashboardFixture(upcoming: upcoming),
        home: homeViewFixture(),
        calendar: (int season) => calendarFixture(season: season),
        grandPrix: (int season, int round) =>
            grandPrixDetailFixture(season, round),
      ),
    );

    testWidgets('resolving asserts nothing about stored data and adds no live '
        'region of its own', (WidgetTester tester) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      final ({
        Stream<ResourceSyncState?> Function(String key) streams,
        void Function() close,
      })
      records = pending();
      addTearDown(records.close);

      await pumpHome(
        tester,
        upcoming: const <CalendarEntry>[],
        syncMetadataStream: records.streams,
      );

      // The section header is still read; the module below it says nothing,
      // because nothing is known yet.
      expect(labelOccurrences(tester, 'Upcoming events'), 1);
      expect(labelOccurrences(tester, 'No upcoming events'), 0);
      expect(labelOccurrences(tester, 'Upcoming events unavailable'), 0);
      expect(
        liveRegions(tester),
        isEmpty,
        reason: 'a module that knows nothing yet must not announce a state',
      );
      handle.dispose();
    });

    testWidgets('unavailable announces its own copy exactly once', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await pumpHome(
        tester,
        upcoming: const <CalendarEntry>[],
        syncMetadata: unmaterialized(<String>{'calendar:2026'}),
      );

      expect(labelOccurrences(tester, 'Upcoming events unavailable'), 1);
      expect(labelOccurrences(tester, 'No upcoming events'), 0);
      handle.dispose();
    });

    testWidgets('available-empty announces its own, different copy exactly '
        'once', (WidgetTester tester) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await pumpHome(tester, upcoming: const <CalendarEntry>[]);

      expect(labelOccurrences(tester, 'No upcoming events'), 1);
      expect(labelOccurrences(tester, 'Upcoming events unavailable'), 0);
      handle.dispose();
    });

    testWidgets('resolving into unavailable announces the new state once, not '
        'twice', (WidgetTester tester) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      final Map<String, StreamController<ResourceSyncState?>> controllers =
          <String, StreamController<ResourceSyncState?>>{};
      addTearDown(() {
        for (final StreamController<ResourceSyncState?> c
            in controllers.values) {
          c.close();
        }
      });

      await pumpHome(
        tester,
        upcoming: const <CalendarEntry>[],
        syncMetadataStream: (String key) => controllers
            .putIfAbsent(key, StreamController<ResourceSyncState?>.broadcast)
            .stream,
      );
      expect(labelOccurrences(tester, 'Upcoming events unavailable'), 0);

      final ResourceSyncState? Function(String key) resolved = unmaterialized(
        <String>{'calendar:2026'},
      );
      for (final MapEntry<String, StreamController<ResourceSyncState?>> entry
          in controllers.entries) {
        entry.value.add(resolved(entry.key));
      }
      await tester.pumpAndSettle();

      expect(
        labelOccurrences(tester, 'Upcoming events unavailable'),
        1,
        reason: 'the resolved state is announced once, from one node',
      );
      handle.dispose();
    });
  });
}
