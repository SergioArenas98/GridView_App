import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/app/environment/app_environment.dart';
import 'package:gridview/core/preferences/preference_values.dart';
import 'package:gridview/core/theme/tokens/gv_primer_metrics.dart';
import 'package:gridview/core/widgets/widgets.dart';
import 'package:gridview/features/explore/presentation/explore_screen.dart';
import 'package:gridview/features/explore/presentation/widgets/explore_header.dart';
import 'package:gridview/features/shared/presentation/widgets/primer_pinned_header_layout.dart';
import 'package:gridview/features/standings/presentation/standings_screen.dart';
import 'package:gridview/features/standings/presentation/widgets/standings_header.dart';

import '../support/primer_fonts.dart';
import '../support/router_harness.dart';

/// XS-34 (Step 55C.16R): keyboard focus on a block taller than the visible
/// list brings the block's **top** (and its focus ring) into view.
///
/// Before the fix, forward Tab aligned such a block's end with the end of
/// the list, so its top was hidden under the pinned header: 2.9px for the
/// English Standings leader card and 38.9px for the Spanish one at 320dp
/// @200% (Step 55C.16 probe). These tests check the visible **top** of the
/// focused block, not merely that some part of it intersects the screen.
/// The existing first/last-row reachability tests are unchanged.

const ValueKey<String> _leaderKey = ValueKey<String>(
  'driver-standing-max-verstappen',
);
final Finder _nav = find.byType(GvPrimerBottomNav);
final Finder _strip = find.byKey(
  const ValueKey<String>('environment-badge-strip'),
);

Finder _listOf(Type screen) => find
    .descendant(of: find.byType(screen), matching: find.byType(Scrollable))
    .last;

/// The part of the screen where list content is visible: below the list's
/// top, the header and the environment strip, above the navigation.
Rect _visibleArea(WidgetTester tester, Type screen, Finder header) {
  final Rect list = tester.getRect(_listOf(screen));
  double top = math.max(list.top, tester.getRect(header).bottom);
  if (_strip.evaluate().isNotEmpty) {
    top = math.max(top, tester.getRect(_strip).bottom);
  }
  return Rect.fromLTRB(
    list.left,
    top,
    list.right,
    math.min(list.bottom, tester.getRect(_nav).top),
  );
}

/// How far the focused target's ring extends outside its box.
double _ringOutset(FocusNode node) {
  final GvPrimerFocusTarget? target = node.context!
      .findAncestorWidgetOfExactType<GvPrimerFocusTarget>();
  if (target == null) return 0;
  return math.max(0, target.geometry.offset + GvPrimerMetrics.focusRingWidth);
}

bool _within(FocusNode node, Finder ancestor) => find
    .ancestor(
      of: find.byElementPredicate((Element e) => e == node.context),
      matching: ancestor,
    )
    .evaluate()
    .isNotEmpty;

/// Tabs forward until [hit] accepts the focused node; fails after [limit].
Future<FocusNode> _tabTo(
  WidgetTester tester,
  bool Function(FocusNode node) hit, {
  int limit = 40,
}) async {
  for (int i = 0; i < limit; i++) {
    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.pumpAndSettle();
    final FocusNode? node = FocusManager.instance.primaryFocus;
    if (node?.context != null && hit(node!)) return node;
  }
  fail('no matching Tab stop in $limit steps');
}

Future<void> _shiftTab(WidgetTester tester) async {
  await tester.sendKeyDownEvent(LogicalKeyboardKey.shiftLeft);
  await tester.sendKeyEvent(LogicalKeyboardKey.tab);
  await tester.sendKeyUpEvent(LogicalKeyboardKey.shiftLeft);
  await tester.pumpAndSettle();
}

/// The focused oversized block shows its top and the top of its ring in
/// the visible area, stays put over further frames, and its end can still
/// be scrolled into view.
Future<void> _expectTopRevealed(
  WidgetTester tester,
  FocusNode node, {
  required Type screen,
  required Finder header,
  required String reason,
}) async {
  final Rect area = _visibleArea(tester, screen, header);
  final Rect r = node.rect;
  expect(
    r.height,
    greaterThan(area.height),
    reason: '$reason: the block must be taller than the visible list',
  );
  expect(
    r.top - _ringOutset(node),
    greaterThanOrEqualTo(area.top - 0.5),
    reason: '$reason: the top (with its ring) is hidden: $r in $area',
  );
  expect(r.top, lessThan(area.bottom), reason: '$reason: top below nav');

  // Stable: no further movement over later frames.
  final ScrollPosition list = tester
      .state<ScrollableState>(_listOf(screen))
      .position;
  final double offset = list.pixels;
  for (int i = 0; i < 5; i++) {
    await tester.pump(const Duration(milliseconds: 16));
  }
  await tester.pumpAndSettle();
  expect(list.pixels, offset, reason: '$reason: scrolling oscillated');
  expect(FocusManager.instance.primaryFocus, same(node));

  // The rest of the block is still reachable by scrolling.
  list.jumpTo(math.min(list.maxScrollExtent, offset + r.bottom - area.bottom));
  await tester.pumpAndSettle();
  expect(
    node.rect.bottom,
    lessThanOrEqualTo(_visibleArea(tester, screen, header).bottom + 0.5),
    reason: '$reason: the end cannot be scrolled into view',
  );
  list.jumpTo(offset);
  await tester.pumpAndSettle();
}

Future<void> _openLarge(
  WidgetTester tester, {
  required String location,
  required Locale locale,
  required AppThemePreference theme,
  Size size = const Size(320, 693),
  double scale = 2,
  bool staging = false,
}) async {
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.pump();
  await loadArchivo(tester);
  await pumpApp(
    tester,
    initialLocation: location,
    surfaceSize: size,
    textScale: scale,
    locale: locale,
    disableAnimations: true,
    environment: staging ? AppEnvironment.staging : AppEnvironment.development,
    environmentBadge: staging,
    mockData: staging,
    padding: staging ? const EdgeInsets.only(top: 24) : EdgeInsets.zero,
    preferences: AppPreferences.defaults.copyWith(theme: theme),
  );
  FocusManager.instance.highlightStrategy =
      FocusHighlightStrategy.alwaysTraditional;
}

void main() {
  tearDown(() {
    FocusManager.instance.highlightStrategy = FocusHighlightStrategy.automatic;
  });

  const List<AppThemePreference> themes = <AppThemePreference>[
    AppThemePreference.dark,
    AppThemePreference.light,
  ];
  const List<Locale> locales = <Locale>[Locale('en'), Locale('es')];

  group('Standings leader card, 320 @200% (pinned header)', () {
    for (final AppThemePreference theme in themes) {
      for (final Locale locale in locales) {
        final String name = '${theme.wire} ${locale.languageCode}';
        testWidgets('$name: Tab reveals the card top and ring; the next '
            'stop is the next row; Shift+Tab returns to the header', (
          WidgetTester tester,
        ) async {
          await _openLarge(
            tester,
            location: '/standings',
            locale: locale,
            theme: theme,
          );
          final Finder header = find.byType(StandingsHeader);
          final FocusNode leader = await _tabTo(
            tester,
            (FocusNode n) => _within(n, find.byKey(_leaderKey)),
          );
          await _expectTopRevealed(
            tester,
            leader,
            screen: StandingsScreen,
            header: header,
            reason: name,
          );

          // Order unchanged: the following stop is a ranking row below the
          // card, whole in view (a row that fits keeps the default).
          await tester.sendKeyEvent(LogicalKeyboardKey.tab);
          await tester.pumpAndSettle();
          final FocusNode next = FocusManager.instance.primaryFocus!;
          expect(_within(next, find.byKey(_leaderKey)), isFalse);
          expect(_within(next, find.byType(GvPrimerStandingsRow)), isTrue);
          final Rect area = _visibleArea(tester, StandingsScreen, header);
          expect(next.rect.top, greaterThanOrEqualTo(area.top - 0.5));
          expect(next.rect.bottom, lessThanOrEqualTo(area.bottom + 0.5));

          // Back to the card, then back into the header.
          await _shiftTab(tester);
          expect(
            _within(
              FocusManager.instance.primaryFocus!,
              find.byKey(_leaderKey),
            ),
            isTrue,
          );
          await _shiftTab(tester);
          final FocusNode inHeader = FocusManager.instance.primaryFocus!;
          expect(_within(inHeader, header), isTrue);
          expect(inHeader.rect.top, greaterThanOrEqualTo(0));
          expect(
            inHeader.rect.bottom,
            lessThanOrEqualTo(tester.getRect(_nav).top),
          );
        });
      }
    }
  });

  group('Standings leader card, 320×480 @200% STAGING (scrolling header)', () {
    for (final AppThemePreference theme in themes) {
      for (final Locale locale in locales) {
        final String name = '${theme.wire} ${locale.languageCode}';
        testWidgets('$name: the card top and ring are revealed below the '
            'strip, the header scrolled away', (WidgetTester tester) async {
          await _openLarge(
            tester,
            location: '/standings',
            locale: locale,
            theme: theme,
            size: const Size(320, 480),
            staging: true,
          );
          expect(
            find.byKey(const ValueKey<String>('primer-pinned-header-scroll')),
            findsOneWidget,
            reason: 'short viewport must use the scrolling-header mode',
          );
          final FocusNode leader = await _tabTo(
            tester,
            (FocusNode n) => _within(n, find.byKey(_leaderKey)),
          );
          final Rect area = _visibleArea(
            tester,
            StandingsScreen,
            find.byType(StandingsHeader),
          );
          expect(
            leader.rect.top - _ringOutset(leader),
            greaterThanOrEqualTo(area.top - 0.5),
            reason: '$name: ${leader.rect} in $area',
          );
          expect(leader.rect.top, lessThan(area.bottom));
          expect(find.byType(PrimerPinnedHeaderLayout), findsOneWidget);
        });
      }
    }
  });

  group('Explore Circuits tall rows, 320 @200%', () {
    for (final AppThemePreference theme in themes) {
      for (final Locale locale in locales) {
        final String name = '${theme.wire} ${locale.languageCode}';
        testWidgets('$name: Tab onto a row taller than the list reveals its '
            'top', (WidgetTester tester) async {
          await _openLarge(
            tester,
            location: '/explore/circuits',
            locale: locale,
            theme: theme,
          );
          final Finder header = find.byType(ExploreHeader);
          final FocusNode row = await _tabTo(tester, (FocusNode n) {
            final Rect area = _visibleArea(tester, ExploreScreen, header);
            return !_within(n, header) &&
                !_within(n, _nav) &&
                n.rect.height > area.height;
          });
          await _expectTopRevealed(
            tester,
            row,
            screen: ExploreScreen,
            header: header,
            reason: name,
          );
        });
      }
    }
  });

  testWidgets('390 @100%: rows that fit keep the default behaviour (whole '
      'row in view)', (WidgetTester tester) async {
    await _openLarge(
      tester,
      location: '/standings',
      locale: const Locale('en'),
      theme: AppThemePreference.dark,
      size: const Size(390, 844),
      scale: 1,
    );
    final Finder header = find.byType(StandingsHeader);
    final FocusNode leader = await _tabTo(
      tester,
      (FocusNode n) => _within(n, find.byKey(_leaderKey)),
    );
    final Rect area = _visibleArea(tester, StandingsScreen, header);
    expect(leader.rect.height, lessThan(area.height));
    expect(leader.rect.top, greaterThanOrEqualTo(area.top - 0.5));
    expect(leader.rect.bottom, lessThanOrEqualTo(area.bottom + 0.5));
  });
}
