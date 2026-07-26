import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:gridview/core/theme/tokens/tokens.dart';
import 'package:gridview/core/widgets/widgets.dart';

import '../support/component_harness.dart';

/// The classification row is the one shared component Phase 7A extended. These
/// tests pin its data-agnostic contract: optional values are omitted rather than
/// zeroed, the two actions are separate accessible hit areas, and a long value
/// wraps instead of overflowing.
void main() {
  const double min = GvLayout.minTouchTarget;

  testWidgets('omitted values are simply not rendered', (
    WidgetTester tester,
  ) async {
    await pumpComponent(
      tester,
      const GvResultRow(position: '—', driverName: 'A Driver'),
    );

    expect(find.text('A Driver'), findsOneWidget);
    expect(find.text('—'), findsOneWidget);
    expect(find.text('0'), findsNothing);
    expect(find.text(''), findsNothing);
  });

  testWidgets('supplied values all render', (WidgetTester tester) async {
    await pumpComponent(
      tester,
      const GvResultRow(
        position: '1',
        driverName: 'A Driver',
        team: 'A Team',
        statusLabel: 'DNF',
        badgeLabel: 'Fastest lap',
        timeOrGap: '+3.456',
        score: '18',
      ),
    );

    expect(find.text('A Driver'), findsOneWidget);
    expect(find.text('A Team · DNF · Fastest lap'), findsOneWidget);
    expect(find.text('+3.456'), findsOneWidget);
    expect(find.text('18'), findsOneWidget);
  });

  testWidgets('the primary and team actions are separate hit areas', (
    WidgetTester tester,
  ) async {
    int primary = 0;
    int team = 0;
    await pumpComponent(
      tester,
      GvResultRow(
        position: '1',
        driverName: 'A Driver',
        team: 'A Team',
        semanticLabel: '1, A Driver, A Team',
        teamSemanticLabel: 'Open team A Team',
        onTap: () => primary++,
        onTeamTap: () => team++,
      ),
    );

    await tester.tap(find.text('A Driver'));
    await tester.pump();
    expect(primary, 1);
    expect(team, 0, reason: 'the actions never overlap');

    await tester.tap(find.text('A Team'));
    await tester.pump();
    expect(team, 1);
    expect(primary, 1);
  });

  testWidgets('both actions expose their own button semantics', (
    WidgetTester tester,
  ) async {
    await pumpComponent(
      tester,
      GvResultRow(
        position: '1',
        driverName: 'A Driver',
        team: 'A Team',
        semanticLabel: '1, A Driver, A Team, 25 Points',
        teamSemanticLabel: 'Open team A Team',
        onTap: () {},
        onTeamTap: () {},
      ),
    );

    expect(find.bySemanticsLabel('1, A Driver, A Team, 25 Points'), findsOne);
    expect(find.bySemanticsLabel('Open team A Team'), findsOne);
  });

  testWidgets('the team action meets the minimum touch target', (
    WidgetTester tester,
  ) async {
    await pumpComponent(
      tester,
      GvResultRow(
        position: '1',
        driverName: 'A Driver',
        team: 'A Team',
        onTap: () {},
        onTeamTap: () {},
      ),
    );

    final Size size = tester.getSize(
      find
          .ancestor(
            of: find.text('A Team'),
            matching: find.byType(ConstrainedBox),
          )
          .first,
    );
    expect(size.height, greaterThanOrEqualTo(min));
  });

  testWidgets('a long trailing value wraps instead of overflowing', (
    WidgetTester tester,
  ) async {
    await pumpComponent(
      tester,
      const GvResultRow(
        position: '1',
        driverName: 'A Driver With A Long Name',
        team: 'A Team',
        timeOrGap: '1:25:03.456',
        score: '25',
      ),
      textScale: 2,
      surfaceSize: const Size(360, 800),
    );

    expect(tester.takeException(), isNull);
  });

  testWidgets('a session row renders an accent only for a non-neutral tone', (
    WidgetTester tester,
  ) async {
    await pumpComponent(
      tester,
      const GvSessionRow(
        name: 'Race',
        statusLabel: 'Sun 26 Jul · Scheduled',
        time: '15:00 CEST',
      ),
    );
    final int neutralContainers = tester
        .widgetList<Container>(find.byType(Container))
        .length;

    await pumpComponent(
      tester,
      const GvSessionRow(
        name: 'Race',
        statusLabel: 'Sun 26 Jul · Cancelled',
        tone: GvStatusTone.warning,
      ),
    );
    final int tonedContainers = tester
        .widgetList<Container>(find.byType(Container))
        .length;

    expect(tonedContainers, greaterThan(neutralContainers));
  });
}
