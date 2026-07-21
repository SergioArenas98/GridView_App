import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/app/app.dart';
import 'package:gridview/app/environment/app_environment.dart';
import 'package:gridview/features/settings/presentation/settings_screen.dart';
import 'package:gridview/features/shared/application/providers.dart';
import 'package:gridview/features/shared/presentation/widgets/environment_badge.dart';
import 'package:gridview/features/shared/presentation/widgets/mock_data_banner.dart';

import '../support/router_harness.dart';

void main() {
  // Pumps the real [GridViewApp] (so the badge is exercised through the actual
  // MaterialApp builder wiring) with the fake repository, avoiding the Drift
  // stream timers that are incompatible with pumpAndSettle.
  Future<void> pumpAppInEnvironment(
    WidgetTester tester, {
    required AppEnvironment environment,
    bool mockData = false,
  }) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          raceWeekendRepositoryProvider.overrideWithValue(
            defaultFakeRepository(),
          ),
          clockProvider.overrideWithValue(() => DateTime.utc(2026, 7, 18, 12)),
          appEnvironmentProvider.overrideWithValue(environment),
          usesMockDataProvider.overrideWithValue(mockData),
        ],
        child: const GridViewApp(),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('a staging build shows the STAGING environment badge', (
    tester,
  ) async {
    await pumpAppInEnvironment(tester, environment: AppEnvironment.staging);

    expect(find.byType(GvEnvironmentBadge), findsOneWidget);
    expect(find.text('STAGING'), findsOneWidget);
  });

  testWidgets('a production build shows no environment badge', (tester) async {
    await pumpAppInEnvironment(tester, environment: AppEnvironment.production);

    // The overlay is present but renders nothing in production.
    expect(find.text('STAGING'), findsNothing);
    expect(find.text('DEV'), findsNothing);
    expect(find.text('PRODUCTION'), findsNothing);
  });

  testWidgets(
    'a staging build on the real API shows STAGING but not the Sample data banner',
    (tester) async {
      // With API_BASE_URL configured, staging uses DioGridViewApi, which reports
      // usesMockData = false — so the fixture banner must not appear.
      await pumpAppInEnvironment(
        tester,
        environment: AppEnvironment.staging,
        mockData: false,
      );

      expect(find.text('STAGING'), findsOneWidget);
      expect(find.byType(MockDataBanner), findsNothing);
    },
  );

  testWidgets('the environment badge is separate from the Sample data banner', (
    tester,
  ) async {
    // A staging build on fixtures shows both, as distinct widgets.
    await pumpAppInEnvironment(
      tester,
      environment: AppEnvironment.staging,
      mockData: true,
    );

    expect(find.byType(GvEnvironmentBadge), findsOneWidget);
    expect(find.text('STAGING'), findsOneWidget);
    expect(find.byType(MockDataBanner), findsOneWidget);
  });

  testWidgets('the component catalogue stays unavailable in production', (
    tester,
  ) async {
    await pumpStandalone(
      tester,
      const SettingsScreen(environmentOverride: AppEnvironment.production),
    );

    expect(find.text('Component catalogue'), findsNothing);
    expect(find.text('Developer'), findsNothing);
  });
}
