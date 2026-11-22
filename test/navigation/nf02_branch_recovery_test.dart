import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:gridview/app/router/app_shell.dart';
import 'package:gridview/app/router/shell_branch_resets.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/drivers/presentation/driver_detail_screen.dart';
import 'package:gridview/features/explore/presentation/explore_screen.dart';
import 'package:gridview/features/home/presentation/home_screen.dart';
import 'package:gridview/features/shared/presentation/not_found_screen.dart';
import 'package:gridview/features/standings/presentation/standings_screen.dart';

import '../support/router_harness.dart';

/// NF-02 (Step 55C.15, P1): recovering Home from an invalid Standings route
/// must not leave that route ready to reopen.
///
/// Before the fix, `StatefulShellRoute` kept `/standings/drivers/abc` as the
/// Standings branch's location after "Go to Home", so the first Standings
/// selection showed "Invalid link" again and only a second one reset the
/// branch. These tests assert the corrected behaviour only; the defective
/// sequence is not encoded anywhere.

const String _invalid = '/standings/drivers/abc';

final Finder _notFound = find.byType(NotFoundScreen);
final Finder _goHome = find.byKey(const ValueKey<String>('not-found-home'));

Future<GoRouter> _open(WidgetTester tester, String location) => pumpApp(
  tester,
  initialLocation: location,
  surfaceSize: const Size(390, 844),
  disableAnimations: true,
);

Future<void> _recoverHome(WidgetTester tester) async {
  expect(_notFound, findsOneWidget);
  await tester.tap(_goHome);
  await tester.pumpAndSettle();
}

/// Exactly one shell and one navigation bar, on stage or not, and no
/// router or layout exception on the way.
void _expectSingleShell(WidgetTester tester) {
  expect(tester.takeException(), isNull);
  expect(find.byType(AppShell, skipOffstage: false), findsOneWidget);
  expect(find.byType(GvPrimerBottomNav, skipOffstage: false), findsOneWidget);
}

/// The valid Standings branch root is on stage and nothing invalid is.
void _expectValidStandings(GoRouter router) {
  expect(shellLocation(router), '/standings');
  expect(find.byType(StandingsScreen), findsOneWidget);
  expect(_notFound, findsNothing);
  expect(find.text('Invalid link'), findsNothing);
}

void main() {
  group('ShellBranchResets', () {
    test('a request is consumed once', () {
      final ShellBranchResets resets = ShellBranchResets()..request(2);
      expect(resets.isPending(2), isTrue);
      expect(resets.consume(2), isTrue);
      expect(resets.consume(2), isFalse);
      expect(resets.isPending(2), isFalse);
    });

    test('requests are per branch, and discard drops only its own', () {
      final ShellBranchResets resets = ShellBranchResets()
        ..request(1)
        ..request(2);
      resets.discard(2);
      expect(resets.isPending(1), isTrue);
      expect(resets.isPending(2), isFalse);
      expect(resets.consume(0), isFalse);
    });
  });

  group('NF-02: recovery from an invalid Standings route', () {
    testWidgets('direct entry: the first Standings selection after "Go to '
        'Home" opens valid Standings', (WidgetTester tester) async {
      final GoRouter router = await _open(tester, _invalid);
      expect(find.text('Invalid link'), findsOneWidget);

      await _recoverHome(tester);
      expect(shellLocation(router), '/');
      expect(find.byType(HomeScreen), findsOneWidget);
      expect(router.canPop(), isFalse);
      _expectSingleShell(tester);

      await tapNav(tester, 'Standings');
      _expectValidStandings(router);
      _expectSingleShell(tester);
    });

    testWidgets('invalid navigation from within Standings (go) recovers the '
        'same way', (WidgetTester tester) async {
      final GoRouter router = await _open(tester, '/standings');
      router.go(_invalid);
      await tester.pumpAndSettle();

      await _recoverHome(tester);
      await tapNav(tester, 'Standings');
      _expectValidStandings(router);
      _expectSingleShell(tester);
    });

    testWidgets('an invalid route pushed inside Standings recovers the same '
        'way, with nothing left to pop', (WidgetTester tester) async {
      final GoRouter router = await _open(tester, '/standings');
      unawaited(router.push(_invalid));
      await tester.pumpAndSettle();

      await _recoverHome(tester);
      await tapNav(tester, 'Standings');
      _expectValidStandings(router);
      expect(router.canPop(), isFalse);
    });

    testWidgets('repeated selections keep a valid Standings destination', (
      WidgetTester tester,
    ) async {
      final GoRouter router = await _open(tester, _invalid);
      await _recoverHome(tester);

      await tapNav(tester, 'Standings');
      _expectValidStandings(router);
      // Re-selecting the active branch still returns it to its root.
      await tapNav(tester, 'Standings');
      _expectValidStandings(router);
      // Leaving and coming back restores the valid root normally.
      await tapNav(tester, 'Home');
      await tapNav(tester, 'Standings');
      _expectValidStandings(router);
      _expectSingleShell(tester);
    });

    testWidgets('the reset is spent: a valid Standings location reached '
        'afterwards is restored normally', (WidgetTester tester) async {
      final GoRouter router = await _open(tester, _invalid);
      await _recoverHome(tester);
      await tapNav(tester, 'Standings');

      router.go('/standings/constructors/2025');
      await tester.pumpAndSettle();
      await tapNav(tester, 'Home');
      await tapNav(tester, 'Standings');
      expect(shellLocation(router), '/standings/constructors/2025');
      expect(_notFound, findsNothing);
    });

    testWidgets('a deep link into valid Standings after recovery drops the '
        'pending reset', (WidgetTester tester) async {
      final GoRouter router = await _open(tester, _invalid);
      await _recoverHome(tester);

      // Reached by a link, not the bar: the branch's location is replaced, so
      // nothing stale is left and the next return restores this season.
      router.go('/standings/drivers/2025');
      await tester.pumpAndSettle();
      expect(find.byType(StandingsScreen), findsOneWidget);
      await tapNav(tester, 'Home');
      await tapNav(tester, 'Standings');
      expect(shellLocation(router), '/standings/drivers/2025');
      expect(_notFound, findsNothing);
    });

    testWidgets('other branches keep their nested state through the '
        'recovery', (WidgetTester tester) async {
      final GoRouter router = await _open(tester, '/explore/teams');
      await tapNav(tester, 'Standings');
      router.go(_invalid);
      await tester.pumpAndSettle();
      await _recoverHome(tester);

      await tapNav(tester, 'Explore');
      expect(shellLocation(router), '/explore/teams');
      expect(find.byType(ExploreScreen), findsOneWidget);
    });

    testWidgets('a valid Standings season is still restored when no recovery '
        'happened', (WidgetTester tester) async {
      final GoRouter router = await _open(
        tester,
        '/standings/constructors/2025',
      );
      await tapNav(tester, 'Home');
      await tapNav(tester, 'Standings');
      expect(shellLocation(router), '/standings/constructors/2025');
    });

    testWidgets('Back and system Back work after the recovery', (
      WidgetTester tester,
    ) async {
      final GoRouter router = await _open(tester, _invalid);
      await _recoverHome(tester);
      await tapNav(tester, 'Standings');

      // A detail above the shell, then system Back, returns to Standings.
      unawaited(router.push('/drivers/max-verstappen'));
      await tester.pumpAndSettle();
      expect(find.byType(DriverDetailScreen), findsOneWidget);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      _expectValidStandings(router);
      _expectSingleShell(tester);
    });

    testWidgets('Back from a pushed invalid route returns to Standings, '
        'unchanged by the fix', (WidgetTester tester) async {
      final GoRouter router = await _open(tester, '/standings');
      unawaited(router.push(_invalid));
      await tester.pumpAndSettle();
      expect(_notFound, findsOneWidget);

      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      _expectValidStandings(router);
    });
  });
}
