import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:gridview/core/theme/gridview_theme.dart';
import 'package:gridview/core/theme/tokens/tokens.dart';
import 'package:gridview/core/widgets/widgets.dart';

// Golden tests cover a small representative set of stable components in the dark
// theme. No custom fonts are bundled, so text renders with flutter_test's
// deterministic default font and goldens are stable across platforms.
Future<void> _expectGolden(
  WidgetTester tester,
  Widget target,
  String name, {
  Size size = const Size(360, 140),
}) async {
  await tester.binding.setSurfaceSize(size);
  addTearDown(() => tester.binding.setSurfaceSize(null));
  await tester.pumpWidget(
    MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: buildGridViewDarkTheme(),
      home: Scaffold(
        body: Center(
          child: RepaintBoundary(
            key: const Key('golden'),
            child: ColoredBox(
              color: GvColors.background,
              child: Padding(
                padding: const EdgeInsets.all(GvSpacing.md),
                child: target,
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pump();
  await expectLater(
    find.byKey(const Key('golden')),
    matchesGoldenFile('goldens/$name.png'),
  );
}

void main() {
  testWidgets('golden: status chips', (WidgetTester tester) async {
    await _expectGolden(
      tester,
      const Wrap(
        spacing: GvSpacing.xs,
        runSpacing: GvSpacing.xs,
        children: <Widget>[
          GvStatusChip(label: 'Upcoming', tone: GvStatusTone.info),
          GvStatusChip(label: 'Live', tone: GvStatusTone.live),
          GvStatusChip(label: 'Completed', tone: GvStatusTone.success),
          GvStatusChip(label: 'Postponed', tone: GvStatusTone.warning),
        ],
      ),
      'status_chips',
    );
  });

  testWidgets('golden: primary button', (WidgetTester tester) async {
    await _expectGolden(
      tester,
      GvPrimaryButton(label: 'View results', onPressed: () {}),
      'primary_button',
    );
  });

  testWidgets('golden: data card', (WidgetTester tester) async {
    await _expectGolden(
      tester,
      const GvDataCard(
        label: 'Points',
        value: '210.5',
        caption: 'Championship leader',
      ),
      'data_card',
    );
  });

  testWidgets('golden: standings row (leader)', (WidgetTester tester) async {
    await _expectGolden(
      tester,
      const GvStandingsRow(
        position: '1',
        name: 'Max Verstappen',
        team: 'Red Bull',
        points: '210.5',
        isLeader: true,
        accentColor: Color(0xFF1E41FF),
      ),
      'standings_row_leader',
    );
  });
}
