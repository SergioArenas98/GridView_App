import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/app/environment/app_environment.dart';
import 'package:gridview/core/observability/observability.dart';
import 'package:gridview/core/observability/observability_activation.dart';

import '../support/fake_observability.dart';
import '../support/router_harness.dart';

/// Settings → Privacy must state what it can actually know.
///
/// The screen went through three wrong answers before this one. Hardcoded
/// "disabled" became a lie once an SDK existed. Build *eligibility* claimed
/// diagnostics were running before activation finished. Then the live
/// activation state was shown as if it were the collection state — which is the
/// subtlest error of the three, because "Unavailable" reads as "nothing is
/// being collected", and that is not something this app can promise.
///
/// It cannot promise it because collection outlives the process: a production
/// installation that activated successfully once leaves a persisted platform
/// override behind, so a later launch may already be collecting before Dart
/// runs. A failed activation today therefore says nothing about it.
///
/// So the rows disclose the **build policy**, which is fixed and knowable, and
/// one clearly-scoped line reports whether *this app's own* reporting could be
/// confirmed this session.
Observability _surface(ObservabilityActivation activation) => Observability(
  reporter: RecordingErrorReporter(),
  tracer: RecordingPerformanceTracer(),
  status: ValueNotifier<ObservabilityActivation>(activation),
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

/// The claim that must never appear against crash or performance diagnostics in
/// a production build, whatever this session's activation did.
void _expectsNoCollectionDisabledClaim() {
  expect(find.text('Crash reporting'), findsOneWidget);
  expect(find.text('Performance monitoring'), findsOneWidget);
  expect(
    find.text('Configured'),
    findsNWidgets(2),
    reason: 'the build policy is what the app can state truthfully',
  );
  expect(
    find.text('Disabled'),
    findsOneWidget,
    reason: 'only Advertising is disabled; diagnostics are never claimed off',
  );
}

void main() {
  group('policy disclosure', () {
    testWidgets('dev and staging disclose no diagnostics policy', (
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

        expect(find.text('Crash reporting'), findsOneWidget);
        expect(find.text('Performance monitoring'), findsOneWidget);
        expect(find.text('Advertising'), findsOneWidget);
        // Crash reporting, performance monitoring and advertising.
        expect(
          find.text('Disabled'),
          findsNWidgets(3),
          reason: environment.name,
        );
        expect(find.text('Configured'), findsNothing, reason: environment.name);
        // A session line would be meaningless with no policy to qualify.
        expect(
          find.text('App reporting this session'),
          findsNothing,
          reason: environment.name,
        );
      }
    });

    testWidgets('a production build discloses a configured policy', (
      WidgetTester tester,
    ) async {
      await _pump(
        tester,
        observability: _surface(ObservabilityActivation.active),
      );

      _expectsNoCollectionDisabledClaim();
      expect(find.text('App reporting this session'), findsOneWidget);
    });
  });

  group('this session, in production', () {
    testWidgets('pending says starting and claims nothing else', (
      WidgetTester tester,
    ) async {
      await _pump(
        tester,
        observability: _surface(ObservabilityActivation.pending),
      );

      expect(find.text('Starting'), findsOneWidget);
      _expectsNoCollectionDisabledClaim();
    });

    testWidgets('an active session says active', (WidgetTester tester) async {
      await _pump(
        tester,
        observability: _surface(ObservabilityActivation.active),
      );

      expect(find.text('Active'), findsOneWidget);
      _expectsNoCollectionDisabledClaim();
    });

    testWidgets('a failed activation says not confirmed, never disabled', (
      WidgetTester tester,
    ) async {
      await _pump(
        tester,
        observability: _surface(ObservabilityActivation.unavailable),
      );

      expect(find.text('Not confirmed'), findsOneWidget);
      _expectsNoCollectionDisabledClaim();
    });

    testWidgets(
      'a failed activation reads the same after an earlier successful launch',
      (WidgetTester tester) async {
        // The app has no way to distinguish a first-ever failed activation from
        // one on an installation that succeeded last week and left a persisted
        // collection override enabled. That indistinguishability is exactly why
        // the copy may not assert a collection state: the same words have to be
        // true in both histories, and "Not confirmed" is, while "Disabled"
        // would be false in the second one.
        await _pump(
          tester,
          observability: _surface(ObservabilityActivation.unavailable),
        );

        expect(find.text('Not confirmed'), findsOneWidget);
        _expectsNoCollectionDisabledClaim();
        expect(
          find.textContaining('can start collecting as soon as the app opens'),
          findsOneWidget,
          reason: 'the note warns that collection may precede this session',
        );
      },
    );
  });

  group('live updates', () {
    testWidgets('the session line corrects itself when activation resolves', (
      WidgetTester tester,
    ) async {
      final ValueNotifier<ObservabilityActivation> activation =
          ValueNotifier<ObservabilityActivation>(
            ObservabilityActivation.pending,
          );
      addTearDown(activation.dispose);

      await _pump(
        tester,
        observability: Observability(
          reporter: RecordingErrorReporter(),
          tracer: RecordingPerformanceTracer(),
          status: activation,
        ),
      );
      expect(find.text('Starting'), findsOneWidget);

      // Activation finishes after the first frame — the whole reason this is a
      // listenable rather than a value captured at composition time.
      activation.value = ObservabilityActivation.active;
      await tester.pumpAndSettle();

      expect(find.text('Active'), findsOneWidget);
      expect(find.text('Starting'), findsNothing);
      // The policy rows did not move, because policy does not change at runtime.
      _expectsNoCollectionDisabledClaim();
    });

    testWidgets('resolving to unavailable never flips a row to disabled', (
      WidgetTester tester,
    ) async {
      final ValueNotifier<ObservabilityActivation> activation =
          ValueNotifier<ObservabilityActivation>(
            ObservabilityActivation.pending,
          );
      addTearDown(activation.dispose);

      await _pump(
        tester,
        observability: Observability(
          reporter: RecordingErrorReporter(),
          tracer: RecordingPerformanceTracer(),
          status: activation,
        ),
      );

      activation.value = ObservabilityActivation.unavailable;
      await tester.pumpAndSettle();

      expect(find.text('Not confirmed'), findsOneWidget);
      _expectsNoCollectionDisabledClaim();
    });
  });

  group('disclosure', () {
    testWidgets('the screen says components ship in every build', (
      WidgetTester tester,
    ) async {
      await _pump(tester, observability: const Observability.disabled());

      expect(
        find.textContaining('included in every version of the app'),
        findsOneWidget,
      );
    });

    testWidgets('the note scopes the session line to this app only', (
      WidgetTester tester,
    ) async {
      await _pump(
        tester,
        observability: _surface(ObservabilityActivation.unavailable),
      );

      expect(
        find.textContaining("this app's own reporting"),
        findsOneWidget,
        reason: 'the session line must not be read as a platform statement',
      );
    });
  });
}
