import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'error_reporter.dart';
import 'observability.dart';
import 'observability_activation.dart';
import 'performance_tracer.dart';

/// The application's observability surface.
///
/// Defaults to the inert surface. `bootstrap` overrides it with the deferred
/// delegate it also installed the global error handlers against, so the app and
/// the global handlers always share one reporter — a crash cannot reach
/// Crashlytics through one path and a non-fatal be dropped by another.
///
/// Tests override it with fakes; nothing in the widget tree constructs it.
final Provider<Observability> observabilityProvider = Provider<Observability>(
  (Ref ref) => const Observability.disabled(),
);

/// The crash/error reporting boundary for application code.
final Provider<ErrorReporter> errorReporterProvider = Provider<ErrorReporter>(
  (Ref ref) => ref.watch(observabilityProvider).reporter,
);

/// The performance tracing boundary for application code.
final Provider<PerformanceTracer> performanceTracerProvider =
    Provider<PerformanceTracer>(
      (Ref ref) => ref.watch(observabilityProvider).tracer,
    );

/// The live activation state of the observability surface.
///
/// A listenable rather than a snapshot: activation resolves after `runApp`, so
/// a value captured at composition time would leave the Privacy screen showing
/// "pending" forever, or claiming diagnostics were running before they were.
/// Settings → Privacy rebuilds on it.
final Provider<ValueListenable<ObservabilityActivation>>
observabilityActivationProvider =
    Provider<ValueListenable<ObservabilityActivation>>(
      (Ref ref) => ref.watch(observabilityProvider).status,
    );
