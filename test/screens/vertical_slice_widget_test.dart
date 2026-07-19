import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/calendar/presentation/grand_prix_detail_screen.dart';
import 'package:gridview/features/home/presentation/home_screen.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix_view.dart';
import 'package:gridview/features/shared/domain/entities/home_view.dart';
import 'package:gridview/features/shared/domain/repositories/race_weekend_repository.dart';
import 'package:gridview/features/shared/presentation/widgets/mock_data_banner.dart';

import '../support/domain_fixtures.dart';
import '../support/fake_repository.dart';
import '../support/router_harness.dart';

void main() {
  group('Home states', () {
    testWidgets('shows a skeleton when there is no cached content', (
      WidgetTester tester,
    ) async {
      final FakeRaceWeekendRepository repo = FakeRaceWeekendRepository(
        homeStream: Stream<HomeView?>.fromFuture(Completer<HomeView?>().future),
        onRefreshHome: () => Completer<RefreshResult>().future,
      );
      await pumpApp(tester, repository: repo, disableAnimations: true);

      expect(find.byType(GvSkeletonCard), findsOneWidget);
      expect(find.text('Belgian Grand Prix'), findsNothing);
    });

    testWidgets('renders cached next Grand Prix content', (
      WidgetTester tester,
    ) async {
      await pumpApp(tester);
      expect(find.byType(HomeScreen), findsOneWidget);
      expect(find.text('Belgian Grand Prix'), findsOneWidget);
      expect(find.text('View Grand Prix'), findsOneWidget);
    });

    testWidgets('keeps content visible during a background refresh', (
      WidgetTester tester,
    ) async {
      final FakeRaceWeekendRepository repo = FakeRaceWeekendRepository(
        home: homeViewFixture(),
        onRefreshHome: () => Completer<RefreshResult>().future, // stays running
      );
      await pumpApp(tester, repository: repo, disableAnimations: true);
      expect(find.text('Belgian Grand Prix'), findsOneWidget);
    });

    testWidgets('shows an offline/stale notice while retaining content', (
      WidgetTester tester,
    ) async {
      final FakeRaceWeekendRepository repo = FakeRaceWeekendRepository(
        home: homeViewFixture(
          withFreshness: freshness(
            generatedAt: DateTime.utc(2026, 7, 18, 11),
            staleAfter: DateTime.utc(2026, 7, 18, 12, 5), // before the clock
          ),
        ),
      );
      await pumpApp(tester, repository: repo, disableAnimations: true);

      expect(find.byType(GvOfflineNotice), findsOneWidget);
      expect(find.text('Belgian Grand Prix'), findsOneWidget);
    });

    testWidgets(
      'first-load failure shows a recoverable error and retry works',
      (WidgetTester tester) async {
        int refreshCalls = 0;
        final FakeRaceWeekendRepository repo = FakeRaceWeekendRepository(
          homeStream: Stream<HomeView?>.value(null),
          onRefreshHome: () async {
            refreshCalls++;
            return const RefreshFailure(
              ApiFailure(kind: ApiFailureKind.networkUnavailable),
            );
          },
        );
        await pumpApp(tester, repository: repo, disableAnimations: true);

        expect(find.text("Can't load Home"), findsOneWidget);
        expect(find.text('Try again'), findsOneWidget);
        expect(refreshCalls, 1);

        await tester.tap(find.text('Try again'));
        await tester.pumpAndSettle();
        expect(refreshCalls, 2);
      },
    );

    testWidgets('shows the dev mock-data banner when mock data is used', (
      WidgetTester tester,
    ) async {
      await pumpApp(tester, mockData: true, disableAnimations: true);
      expect(find.byType(MockDataBanner), findsOneWidget);
    });

    testWidgets('renders Spanish content', (WidgetTester tester) async {
      await pumpApp(tester, locale: const Locale('es'));
      expect(find.text('Próximo Gran Premio'), findsOneWidget);
    });
  });

  group('Home -> Grand Prix detail', () {
    testWidgets('opens Grand Prix detail from the Home hero', (
      WidgetTester tester,
    ) async {
      await pumpApp(tester);
      await tester.tap(find.text('View Grand Prix'));
      await tester.pumpAndSettle();

      expect(find.byType(GrandPrixDetailScreen), findsOneWidget);
      expect(find.text('Race'), findsWidgets);
    });
  });

  group('Grand Prix detail states', () {
    testWidgets('opens directly via deep link with ordered sessions', (
      WidgetTester tester,
    ) async {
      await pumpApp(tester, initialLocation: '/calendar/2026/13');

      expect(find.byType(GrandPrixDetailScreen), findsOneWidget);
      // All five sprint-weekend sessions render.
      for (final String name in <String>[
        'Practice 1',
        'Sprint Qualifying',
        'Sprint',
        'Qualifying',
        'Race',
      ]) {
        expect(find.text(name), findsOneWidget, reason: name);
      }
    });

    testWidgets('sessions are displayed in weekend order', (
      WidgetTester tester,
    ) async {
      await pumpApp(tester, initialLocation: '/calendar/2026/13');

      double dyOf(String name) => tester.getTopLeft(find.text(name)).dy;
      expect(dyOf('Practice 1'), lessThan(dyOf('Sprint Qualifying')));
      expect(dyOf('Sprint Qualifying'), lessThan(dyOf('Sprint')));
      expect(dyOf('Sprint'), lessThan(dyOf('Qualifying')));
      expect(dyOf('Qualifying'), lessThan(dyOf('Race')));
    });

    testWidgets('a missing Grand Prix shows a controlled not-found state', (
      WidgetTester tester,
    ) async {
      final FakeRaceWeekendRepository repo = FakeRaceWeekendRepository(
        grandPrixStream: (int s, int r) =>
            Stream<GrandPrixDetailView?>.value(null),
        onRefreshGrandPrix: (int s, int r) async =>
            const RefreshFailure(ApiFailure(kind: ApiFailureKind.notFound)),
      );
      await pumpApp(
        tester,
        repository: repo,
        initialLocation: '/calendar/2026/22',
        disableAnimations: true,
      );

      expect(find.text('Grand Prix not found'), findsOneWidget);
    });

    testWidgets('works offline from cached detail even if refresh fails', (
      WidgetTester tester,
    ) async {
      final FakeRaceWeekendRepository repo = FakeRaceWeekendRepository(
        grandPrix: (int s, int r) => grandPrixDetailFixture(s, r),
        onRefreshGrandPrix: (int s, int r) async => const RefreshFailure(
          ApiFailure(kind: ApiFailureKind.networkUnavailable),
        ),
      );
      await pumpApp(
        tester,
        repository: repo,
        initialLocation: '/calendar/2026/13',
        disableAnimations: true,
      );

      expect(find.text('Race'), findsWidgets);
      expect(find.byType(GvOfflineNotice), findsOneWidget);
    });
  });
}
