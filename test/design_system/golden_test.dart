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
  Brightness brightness = Brightness.dark,
}) async {
  await tester.binding.setSurfaceSize(size);
  addTearDown(() => tester.binding.setSurfaceSize(null));
  await tester.pumpWidget(
    MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: brightness == Brightness.dark
          ? buildGridViewDarkTheme()
          : buildGridViewLightTheme(),
      home: Scaffold(
        body: Center(
          child: RepaintBoundary(
            key: const Key('golden'),
            child: ColoredBox(
              color: brightness == Brightness.dark
                  ? GvColors.background
                  : GvColorsLight.background,
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

  // One light-theme component sheet rather than a light copy of every dark
  // golden. It puts the roles that carry meaning side by side on a light
  // surface — status tones, the filled primary control, a statistic card and a
  // standings row with a decorative team accent — because those are the roles a
  // light-palette regression would break first.
  testWidgets('golden: component sheet light', (WidgetTester tester) async {
    await _expectGolden(
      tester,
      Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
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
          const SizedBox(height: GvSpacing.md),
          GvPrimaryButton(label: 'View results', onPressed: () {}),
          const SizedBox(height: GvSpacing.md),
          const GvDataCard(
            label: 'Points',
            value: '210.5',
            caption: 'Championship leader',
          ),
          const SizedBox(height: GvSpacing.md),
          const GvStandingsRow(
            position: '1',
            name: 'Max Verstappen',
            team: 'Red Bull',
            points: '210.5',
            isLeader: true,
            accentColor: Color(0xFF1E41FF),
          ),
          const SizedBox(height: GvSpacing.md),
          // A placeholder must stay visible on a light surface: no
          // light-icon-on-light-fill.
          const Align(
            alignment: Alignment.centerLeft,
            child: SizedBox(
              width: 96,
              child: GvImagePlaceholder(semanticLabel: 'Driver portrait'),
            ),
          ),
        ],
      ),
      'component_sheet_light',
      size: const Size(360, 500),
      brightness: Brightness.light,
    );
  });
}
