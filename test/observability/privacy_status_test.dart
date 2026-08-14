import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/app/environment/app_environment.dart';
import 'package:gridview/core/observability/observability.dart';
import 'package:gridview/core/observability/observability_status.dart';

import '../support/fake_observability.dart';
import '../support/router_harness.dart';

/// Settings → Privacy must state what the build is actually doing.
///
/// Two things were wrong before this pass. The rows were hardcoded to
/// "disabled", which became a lie the moment an SDK existed; then they were
/// derived from build *eligibility*, which claimed diagnostics were running
/// before activation had finished and even when it had failed. The screen now
/// reads the live status, and it discloses that the diagnostic components ship
/// in every build regardless.
Observability _surface(ObservabilityStatus status) => Observability(
  reporter: RecordingErrorReporter(),
  tracer: RecordingPerformanceTracer(),
  status: ValueNotifier<ObservabilityStatus>(status),
);

Future<void> _pump(
  WidgetTester tester, {
  required Observability observability,
  AppEnvironment environment = AppEnvironment.production,
}) => pumpApp(
  tester,
  initialLocation: '/settings/privacy',
  environment: environment,
  observability: observability,
);

void main() {
  testWidgets('a policy-disabled build says disabled', (
    WidgetTester tester,
  ) async {
    await _pump(tester, observability: const Observability.disabled());

    expect(find.text('Crash reporting'), findsOneWidget);
    expect(find.text('Performance monitoring'), findsOneWidget);
    expect(find.text('Advertising'), findsOneWidget);
    expect(find.text('Disabled'), findsNWidgets(3));
    expect(find.text('Enabled'), findsNothing);
  });

  testWidgets('a pending build says starting, never enabled', (
    WidgetTester tester,
  ) async {
    await _pump(tester, observability: _surface(ObservabilityStatus.pending));

    expect(find.text('Starting'), findsNWidgets(2));
    expect(
      find.text('Enabled'),
      findsNothing,
      reason: 'eligibility is not a running service',
    );
  });

  testWidgets('an activated build says enabled', (WidgetTester tester) async {
    await _pump(tester, observability: _surface(ObservabilityStatus.activated));

    expect(find.text('Enabled'), findsNWidgets(2));
    // Advertising is still off: no ads SDK exists and none was added.
    expect(find.text('Disabled'), findsOneWidget);
  });

  testWidgets('a failed activation says unavailable, not enabled', (
    WidgetTester tester,
  ) async {
    await _pump(
      tester,
      observability: _surface(ObservabilityStatus.unavailable),
    );

    expect(find.text('Unavailable'), findsNWidgets(2));
    expect(find.text('Enabled'), findsNothing);
  });

  testWidgets('the status corrects itself when activation resolves', (
    WidgetTester tester,
  ) async {
    final ValueNotifier<ObservabilityStatus> status =
        ValueNotifier<ObservabilityStatus>(ObservabilityStatus.pending);
    addTearDown(status.dispose);

    await _pump(
      tester,
      observability: Observability(
        reporter: RecordingErrorReporter(),
        tracer: RecordingPerformanceTracer(),
        status: status,
      ),
    );
    expect(find.text('Starting'), findsNWidgets(2));

    // Activation finishes after the first frame — the whole reason the status
    // is a listenable rather than a value captured at composition time.
    status.value = ObservabilityStatus.activated;
    await tester.pumpAndSettle();

    expect(find.text('Enabled'), findsNWidgets(2));
    expect(find.text('Starting'), findsNothing);
  });

  testWidgets('the screen discloses that components ship in every build', (
    WidgetTester tester,
  ) async {
    await _pump(tester, observability: const Observability.disabled());

    expect(
      find.textContaining('included in every version of the app'),
      findsOneWidget,
    );
  });

  testWidgets('a non-production build never claims collection', (
    WidgetTester tester,
  ) async {
    for (final AppEnvironment environment in <AppEnvironment>[
      AppEnvironment.development,
      AppEnvironment.staging,
    ]) {
      await _pump(
        tester,
        observability: const Observability.disabled(),
        environment: environment,
      );
      expect(find.text('Enabled'), findsNothing, reason: environment.name);
      expect(find.text('Starting'), findsNothing, reason: environment.name);
    }
  });
}
