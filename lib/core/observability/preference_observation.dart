import '../../app/environment/app_environment.dart';
import '../preferences/preferences_repository.dart';
import 'observed_failure.dart';

/// Maps a preference diagnostic onto the reporting contract.
///
/// The preference layer raises [PreferenceDiagnostic] for three faults that are
/// invisible to the user by design — the store would not open, a stored token no
/// longer maps to a value, a write failed and the visible value was reverted.
/// Each is exactly what a non-fatal is for: unexpected, actionable, and already
/// handled gracefully.
///
/// **Everything crossing this boundary is an enum.** The diagnostic carries a
/// raw key and nothing else that could leak, and even that key is collapsed
/// through [ObservedPreference.fromKey] rather than forwarded. The stored value
/// is never present in the diagnostic to begin with, so no call site here can
/// echo a corrupted token, an exception message or a stack trace into a report.
ObservedFailure observedPreferenceFailure(
  PreferenceDiagnostic diagnostic,
  AppEnvironment environment,
) => ObservedFailure(
  kind: ObservedFailureKind.localPreferenceFailure,
  feature: ObservedFeature.settings,
  operation: switch (diagnostic.kind) {
    // The whole store, not one preference: the key is absent here.
    PreferenceDiagnosticKind.storeUnavailable =>
      ObservedOperation.preferenceStoreOpen,
    PreferenceDiagnosticKind.corruptedValue => ObservedOperation.preferenceRead,
    PreferenceDiagnosticKind.writeFailure => ObservedOperation.preferenceWrite,
  },
  environment: environment,
  preference: ObservedPreference.fromKey(diagnostic.key),
);
