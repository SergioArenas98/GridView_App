import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:gridview/app/router/app_shell.dart';
import 'package:gridview/app/router/shell_branch_resets.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/explore/presentation/explore_screen.dart';
import 'package:gridview/features/shared/presentation/not_found_screen.dart';
import 'package:gridview/features/standings/presentation/standings_screen.dart';

import '../support/router_harness.dart';

/// NF-03 (Step 55C.16R): leaving an invalid Standings page through another
/// tab, without "Go to Home", must not leave that page ready to reopen.
///
/// Before the fix the Standings branch restored its stored invalid location:
/// the first Standings selection showed "Invalid link" again and only a
/// second one reset the branch. The invalid page now reports itself to the
/// shell while it is mounted ([ShellBranchInvalidPage]), and the shell opens
/// the branch's initial location instead. These tests assert the corrected
/// behaviour and the lifecycle of that report (no stale counters, no
/// lingering reset requests). NF-02's "Go to Home" recovery has its own
/// tests in `nf02_branch_recovery_test.dart`.

const String _invalid = '/standings/drivers/abc';
const String _otherInvalid = '/standings/constructors/xyz';

/// The Standings branch's position in the router's branch list (Home,
/// Calendar, Standings, Explore). Used only by these assertions; production
/// code finds the branch through the page's own navigator.
const int _standings = 2;

final Finder _notFound = find.byType(NotFoundScreen);

Future<GoRouter> _open(WidgetTester tester, String location) => pumpApp(
  tester,
  initialLocation: location,
  surfaceSize: const Size(390, 844),
  disableAnimations: true,
);

ShellBranchResets _resets(WidgetTester tester) => tester
    .widget<AppShell>(find.byType(AppShell, skipOffstage: false))
    .branchResets;

/// Exactly one shell and one navigation bar, and no router or layout
/// exception on the way.
void _expectSingleShell(WidgetTester tester) {
  expect(tester.takeException(), isNull);
  expect(find.byType(AppShell, skipOffstage: false), findsOneWidget);
  expect(find.byType(GvPrimerBottomNav, skipOffstage: false), findsOneWidget);
}

/// The valid Standings branch root is on stage, nothing invalid is mounted
/// anywhere, and no reset is left behind.
void _expectValidStandings(WidgetTester tester, GoRouter router) {
  expect(shellLocation(router), '/standings');
  expect(find.byType(StandingsScreen), findsOneWidget);
  expect(find.byType(NotFoundScreen, skipOffstage: false), findsNothing);
  expect(find.text('Invalid link'), findsNothing);
  _expectNothingStale(tester);
}

/// No invalid page reported and no pending reset, for any branch.
void _expectNothingStale(WidgetTester tester) {
  final ShellBranchResets resets = _resets(tester);
  for (int i = 0; i < 4; i++) {
    expect(resets.hasInvalidPage(i), isFalse, reason: 'branch $i counter');
    expect(resets.isPending(i), isFalse, reason: 'branch $i request');
  }
}

void main() {
  group('ShellBranchResets invalid-page counter', () {
    test('mount and removal balance; removal never goes below zero', () {
      final ShellBranchResets resets = ShellBranchResets();
      expect(resets.hasInvalidPage(_standings), isFalse);
      resets.invalidPageMounted(_standings);
      expect(resets.hasInvalidPage(_standings), isTrue);
      resets.invalidPageRemoved(_standings);
      expect(resets.hasInvalidPage(_standings), isFalse);
      resets.invalidPageRemoved(_standings);
      expect(resets.hasInvalidPage(_standings), isFalse);
      resets.invalidPageMounted(_standings);
      expect(resets.hasInvalidPage(_standings), isTrue);
    });

    test('a replacement mounted before the old page is removed keeps the '
        'branch reported', () {
      final ShellBranchResets resets = ShellBranchResets()
        ..invalidPageMounted(_standings)
        ..invalidPageMounted(_standings)
        ..invalidPageRemoved(_standings);
      expect(resets.hasInvalidPage(_standings), isTrue);
      resets.invalidPageRemoved(_standings);
      expect(resets.hasInvalidPage(_standings), isFalse);
    });

    test('shouldReset consumes a request but never clears an invalid page; '
        'branches are independent', () {
      final ShellBranchResets resets = ShellBranchResets()
        ..request(1)
        ..invalidPageMounted(_standings);
      expect(resets.shouldReset(1), isTrue);
      expect(resets.shouldReset(1), isFalse);
      expect(resets.shouldReset(_standings), isTrue);
      expect(resets.shouldReset(_standings), isTrue);
      expect(resets.shouldReset(0), isFalse);
      expect(resets.shouldReset(3), isFalse);
    });
  });

  group(
    'NF-03: re-entering Standings after leaving an invalid page by tab',
    () {
      for (final String other in <String>['Home', 'Calendar', 'Explore']) {
        testWidgets('direct entry, leave by $other: the first Standings tap '
            'opens valid Standings', (WidgetTester tester) async {
          final GoRouter router = await _open(tester, _invalid);
          expect(find.text('Invalid link'), findsOneWidget);
          expect(_resets(tester).hasInvalidPage(_standings), isTrue);

          await tapNav(tester, other);
          expect(find.text('Invalid link'), findsNothing);
          // Still mounted offstage in the Standings branch, still reported.
          expect(_resets(tester).hasInvalidPage(_standings), isTrue);

          await tapNav(tester, 'Standings');
          _expectValidStandings(tester, router);
          _expectSingleShell(tester);
        });
      }

      testWidgets('an invalid route reached with go from within Standings '
          'recovers the same way', (WidgetTester tester) async {
        final GoRouter router = await _open(tester, '/standings');
        router.go(_invalid);
        await tester.pumpAndSettle();
        expect(_notFound, findsOneWidget);

        await tapNav(tester, 'Explore');
        await tapNav(tester, 'Standings');
        _expectValidStandings(tester, router);
        _expectSingleShell(tester);
      });

      testWidgets('one invalid page replacing another is still reset on '
          're-entry, and nothing is left counted', (WidgetTester tester) async {
        final GoRouter router = await _open(tester, _invalid);
        router.go(_otherInvalid);
        await tester.pumpAndSettle();
        expect(shellLocation(router), _otherInvalid);
        expect(_notFound, findsOneWidget);
        expect(_resets(tester).hasInvalidPage(_standings), isTrue);

        await tapNav(tester, 'Home');
        await tapNav(tester, 'Standings');
        _expectValidStandings(tester, router);
      });

      testWidgets('an invalid page pushed over valid Standings is left by tab: '
          're-entry opens the root with nothing to pop', (
        WidgetTester tester,
      ) async {
        final GoRouter router = await _open(tester, '/standings');
        unawaited(router.push(_invalid));
        await tester.pumpAndSettle();
        expect(_notFound, findsOneWidget);

        await tapNav(tester, 'Calendar');
        await tapNav(tester, 'Standings');
        _expectValidStandings(tester, router);
        expect(router.canPop(), isFalse);
      });

      testWidgets('Back pops a pushed invalid page and releases it: the next '
          'return restores Standings normally', (WidgetTester tester) async {
        final GoRouter router = await _open(tester, '/standings');
        unawaited(router.push(_invalid));
        await tester.pumpAndSettle();
        expect(_resets(tester).hasInvalidPage(_standings), isTrue);

        await tester.binding.handlePopRoute();
        await tester.pumpAndSettle();
        _expectValidStandings(tester, router);

        await tapNav(tester, 'Explore');
        await tapNav(tester, 'Standings');
        _expectValidStandings(tester, router);
      });

      testWidgets('tapping Standings while it shows the invalid page opens the '
          'root', (WidgetTester tester) async {
        final GoRouter router = await _open(tester, _invalid);
        await tapNav(tester, 'Standings');
        _expectValidStandings(tester, router);
        _expectSingleShell(tester);
      });

      testWidgets('a valid saved Standings destination is restored after an '
          'earlier invalid episode', (WidgetTester tester) async {
        final GoRouter router = await _open(tester, _invalid);
        await tapNav(tester, 'Home');
        await tapNav(tester, 'Standings');
        _expectValidStandings(tester, router);

        router.go('/standings/constructors/2025');
        await tester.pumpAndSettle();
        await tapNav(tester, 'Calendar');
        await tapNav(tester, 'Standings');
        expect(shellLocation(router), '/standings/constructors/2025');
        expect(find.byType(StandingsScreen), findsOneWidget);
        _expectNothingStale(tester);
      });

      testWidgets('repeated invalid-route episodes each recover on the first '
          'tap and leave nothing stale', (WidgetTester tester) async {
        final GoRouter router = await _open(tester, '/standings');
        for (final (String location, String other) in <(String, String)>[
          (_invalid, 'Home'),
          (_otherInvalid, 'Explore'),
          (_invalid, 'Calendar'),
        ]) {
          router.go(location);
          await tester.pumpAndSettle();
          expect(_notFound, findsOneWidget, reason: location);
          await tapNav(tester, other);
          await tapNav(tester, 'Standings');
          _expectValidStandings(tester, router);
        }
        _expectSingleShell(tester);
      });

      testWidgets('other branches keep their nested state through the '
          're-entry', (WidgetTester tester) async {
        final GoRouter router = await _open(tester, '/explore/teams');
        router.go(_invalid);
        await tester.pumpAndSettle();
        await tapNav(tester, 'Explore');
        expect(shellLocation(router), '/explore/teams');
        expect(find.byType(ExploreScreen), findsOneWidget);

        await tapNav(tester, 'Standings');
        _expectValidStandings(tester, router);
        await tapNav(tester, 'Explore');
        expect(shellLocation(router), '/explore/teams');
      });

      testWidgets('an invalid page above the shell reports nothing to any '
          'branch', (WidgetTester tester) async {
        await _open(tester, '/calendar/notyear/3');
        expect(_notFound, findsOneWidget);
        _expectNothingStale(tester);
      });
    },
  );
}
