import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:gridview/core/widgets/widgets.dart';

import '../support/component_harness.dart';

void main() {
  testWidgets('GvPrimaryButton fires onPressed and is disabled when null', (
    WidgetTester tester,
  ) async {
    int taps = 0;
    await pumpComponent(
      tester,
      GvPrimaryButton(label: 'Go', onPressed: () => taps++),
    );
    await tester.tap(find.text('Go'));
    expect(taps, 1);

    await pumpComponent(tester, const GvPrimaryButton(label: 'Off'));
    expect(
      tester.widget<ElevatedButton>(find.byType(ElevatedButton)).onPressed,
      isNull,
    );
  });

  testWidgets('GvPrimaryButton in loading state ignores taps', (
    WidgetTester tester,
  ) async {
    int taps = 0;
    await pumpComponent(
      tester,
      GvPrimaryButton(label: 'Load', isLoading: true, onPressed: () => taps++),
    );
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(
      tester.widget<ElevatedButton>(find.byType(ElevatedButton)).onPressed,
      isNull,
    );
    expect(taps, 0);
  });

  testWidgets('GvSegmentedControl reports the tapped index', (
    WidgetTester tester,
  ) async {
    int selected = 0;
    await pumpComponent(
      tester,
      StatefulBuilder(
        builder: (BuildContext context, StateSetter setState) {
          return GvSegmentedControl(
            segments: const <String>['Drivers', 'Constructors'],
            selectedIndex: selected,
            onChanged: (int i) => setState(() => selected = i),
          );
        },
      ),
    );
    await tester.tap(find.text('Constructors'));
    await tester.pumpAndSettle();
    expect(selected, 1);
  });

  testWidgets('GvBottomNav reports the tapped destination', (
    WidgetTester tester,
  ) async {
    int index = 0;
    await pumpComponent(
      tester,
      StatefulBuilder(
        builder: (BuildContext context, StateSetter setState) {
          return GvBottomNav(
            selectedIndex: index,
            onSelect: (int i) => setState(() => index = i),
            items: const <GvBottomNavItem>[
              GvBottomNavItem(icon: Icons.home_outlined, label: 'Home'),
              GvBottomNavItem(icon: Icons.explore_outlined, label: 'Explore'),
            ],
          );
        },
      ),
    );
    await tester.tap(find.text('Explore'));
    await tester.pump();
    expect(index, 1);
  });

  testWidgets('GvErrorState retry button invokes onRetry', (
    WidgetTester tester,
  ) async {
    int retries = 0;
    await pumpComponent(
      tester,
      GvErrorState(
        title: 'Oops',
        message: 'Failed',
        retryLabel: 'Retry',
        onRetry: () => retries++,
      ),
    );
    await tester.tap(find.text('Retry'));
    expect(retries, 1);
  });

  testWidgets('GvStandingsRow omits every value the caller does not supply', (
    WidgetTester tester,
  ) async {
    // No team, no statistic and no badge: the secondary line is absent rather
    // than rendered as an empty container or a dangling separator.
    await pumpComponent(
      tester,
      const GvStandingsRow(
        position: '—',
        name: 'Unranked Entrant',
        points: '0',
      ),
    );
    expect(find.text('Unranked Entrant'), findsOneWidget);
    expect(find.text('0'), findsOneWidget);
    expect(find.textContaining('·'), findsNothing);
  });

  testWidgets('GvStandingsRow joins the values it is given', (
    WidgetTester tester,
  ) async {
    await pumpComponent(
      tester,
      const GvStandingsRow(
        position: '1',
        name: 'Max Verstappen',
        team: 'Red Bull Racing',
        stat: '6 wins',
        badgeLabel: 'Provisional',
        points: '210.5',
      ),
    );
    expect(find.text('Red Bull Racing · 6 wins · Provisional'), findsOneWidget);
  });

  testWidgets('GvStandingsRow keeps a two-digit position on one line', (
    WidgetTester tester,
  ) async {
    await pumpComponent(
      tester,
      const GvStandingsRow(position: '19', name: 'A driver', points: '0'),
    );
    // A wrapped position would be twice as tall as a single line.
    final Size single = tester.getSize(find.text('19'));
    expect(
      single.height,
      lessThan(40),
      reason: 'the leading slot grows instead of wrapping the position',
    );
  });

  testWidgets('GvStandingsRow exposes one explicit reading order', (
    WidgetTester tester,
  ) async {
    await pumpComponent(
      tester,
      GvStandingsRow(
        position: '1',
        name: 'Max Verstappen',
        team: 'Red Bull Racing',
        points: '210.5',
        isLeader: true,
        semanticLabel:
            'Position 1, Max Verstappen, Red Bull Racing, 210.5 points, '
            'Championship leader',
        onTap: () {},
      ),
    );
    expect(
      find.bySemanticsLabel(
        'Position 1, Max Verstappen, Red Bull Racing, 210.5 points, '
        'Championship leader',
      ),
      findsOneWidget,
    );
  });
}
