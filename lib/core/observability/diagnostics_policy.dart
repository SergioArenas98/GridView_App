import '../../app/environment/app_environment.dart';
import 'observability.dart';

/// What this **build** is configured to do about diagnostics.
///
/// Distinct from `ObservabilityActivation`, which describes one process's Dart
/// adapters and changes while the app runs. Policy is a property of the
/// artifact: it is fixed at build time, it is the same on every launch, and it
/// is the only diagnostics fact the app can state with certainty.
///
/// That certainty is why user-facing copy is built from the policy rather than
/// from activation. The app cannot read the platform's live collection state,
/// and it must not guess: a production installation that activated
/// successfully once carries a persisted collection override that outlives the
/// process, so a failed activation today is not evidence that anything is off.
enum DiagnosticsPolicy {
  /// No diagnostics are configured for this build.
  ///
  /// Dev and staging carry their own application IDs, own no Firebase
  /// configuration, and never run the production activation — so there is
  /// nothing to enable and nothing that could have been enabled earlier.
  none,

  /// Crash and performance diagnostics are configured for production builds.
  ///
  /// Collection starts from the manifest default of `false` on a fresh
  /// installation and is turned on by the runtime opt-in once activation
  /// succeeds. The platform persists that opt-in, so later launches may begin
  /// collecting before Dart runs.
  production,
}

/// The diagnostics policy the given build carries.
///
/// Derived from the same eligibility rule the activation path uses, so the
/// disclosure and the behaviour cannot describe different builds.
DiagnosticsPolicy diagnosticsPolicyFor(AppEnvironment environment) =>
    isObservabilityEligible(environment)
    ? DiagnosticsPolicy.production
    : DiagnosticsPolicy.none;
