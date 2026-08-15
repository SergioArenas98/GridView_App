import 'package:flutter/foundation.dart';

import '../../app/environment/app_environment.dart';
import 'error_reporter.dart';
import 'observability_activation.dart';
import 'performance_tracer.dart';

/// The application's observability surface: one reporter, one tracer and the
/// live status of the two.
///
/// Bundled so the composition root wires a single object and every consumer
/// receives a consistent set, rather than a build that reports crashes to
/// Firebase while tracing into a no-op.
class Observability {
  const Observability({
    required this.reporter,
    required this.tracer,
    required this.status,
  });

  /// The inert surface: correct for development, staging and tests.
  const Observability.disabled()
    : reporter = const NoopErrorReporter(),
      tracer = const NoopPerformanceTracer(),
      status = const StaticObservabilityActivation(
        ObservabilityActivation.notConfigured,
      );

  final ErrorReporter reporter;
  final PerformanceTracer tracer;

  /// The live activation state.
  ///
  /// Deliberately a [ValueListenable] rather than a captured boolean: the
  /// status changes *after* `runApp`, when activation resolves, and a screen
  /// that read a snapshot at composition time would keep showing "pending"
  /// forever — or worse, claim diagnostics were running before they were.
  final ValueListenable<ObservabilityActivation> status;
}

/// Whether an environment is allowed to activate the Dart observability
/// adapters.
///
/// **Production only, and deliberately so.** The only Firebase configuration
/// this repository owns is `android/app/src/production/google-services.json`,
/// registered for the production application id `com.sejuma.gridview`. Dev and
/// staging builds carry the `.dev` / `.staging` application-id suffixes, so that
/// configuration does not describe them, and no dev/staging Firebase project
/// exists. Their absence is an **external blocker**, not a licence to point
/// non-production builds at the production project.
///
/// This gate governs the **Dart adapters only**. It cannot govern the native
/// SDK: Android instantiates `FirebaseInitProvider` and the Firebase component
/// registrars — which are packaged in every flavor — during application
/// startup, before any Dart code runs. The native collection boundary is the
/// `firebase_crashlytics_collection_enabled` / `firebase_performance_collection_enabled`
/// manifest policy, which is `false` for every flavor; the eligible production
/// build turns collection on at runtime once this gate has been evaluated.
///
/// Flavor and `APP_ENV` can no longer disagree: the Android build fails unless
/// they match (`android/app/build.gradle`, `validate<Variant>Environment`).
bool isObservabilityEligible(AppEnvironment environment) =>
    environment.isProduction;
