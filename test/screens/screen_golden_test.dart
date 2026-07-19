import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:gridview/core/widgets/widgets.dart';

import '../support/router_harness.dart';

// A small set of full-screen goldens for the primary shell and three
// representative skeletons. Animations are disabled and the surface size is
// fixed so the images are deterministic. Cross-platform font antialiasing is
// absorbed by the 2% tolerant comparator in test/flutter_test_config.dart.
const Size _device = Size(390, 844);

Future<void> _pump(WidgetTester tester, String location) async {
  await pumpApp(
    tester,
    initialLocation: location,
    surfaceSize: _device,
    disableAnimations: true,
  );
}

void main() {
  testWidgets('golden: primary shell pill navigation', (
    WidgetTester tester,
  ) async {
    await _pump(tester, '/');
    await expectLater(
      find.byType(GvBottomNav),
      matchesGoldenFile('goldens/primary_shell_nav.png'),
    );
  });

  testWidgets('golden: home skeleton', (WidgetTester tester) async {
    await _pump(tester, '/');
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('goldens/home_skeleton.png'),
    );
  });

  testWidgets('golden: standings skeleton', (WidgetTester tester) async {
    await _pump(tester, '/standings/drivers/2026');
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('goldens/standings_skeleton.png'),
    );
  });

  testWidgets('golden: grand prix detail skeleton', (
    WidgetTester tester,
  ) async {
    await _pump(tester, '/calendar/2026/3');
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('goldens/grand_prix_detail_skeleton.png'),
    );
  });
}
