import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/calendar/presentation/grand_prix_detail_screen.dart';
import 'package:gridview/features/shared/domain/entities/grand_prix_view.dart';
import 'package:gridview/features/shared/domain/refresh_result.dart';

import '../support/domain_fixtures.dart';
import '../support/fake_repository.dart';
import '../support/router_harness.dart';

/// The Grand Prix detail screen is a long scrolling page (hero, weekend facts,
/// the full session schedule and the classifications). These tests assert on
/// content across the whole page, so they use a tall surface instead of
/// scrolling step by step — nothing about the assertions is relaxed.
const Size _tallDetail = Size(400, 1600);

void main() {
  // The Home dashboard's own states, navigation, accessibility and offline
  // behaviour are covered in full by `home_widget_test.dart`; what remains here
  // is the Home -> Grand Prix hand-off and the Grand Prix screen itself.
  group('Home -> Grand Prix detail', () {
    testWidgets('opens Grand Prix detail from the Home hero', (
      WidgetTester tester,
    ) async {
      await pumpApp(tester, surfaceSize: _tallDetail);
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
      await pumpApp(
        tester,
        initialLocation: '/calendar/2026/13',
        surfaceSize: _tallDetail,
      );

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
      await pumpApp(
        tester,
        initialLocation: '/calendar/2026/13',
        surfaceSize: _tallDetail,
      );

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
        surfaceSize: _tallDetail,
      );

      expect(find.text('Race'), findsWidgets);
      expect(find.byType(GvOfflineNotice), findsOneWidget);
    });
  });
}
