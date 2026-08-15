import 'package:flutter/foundation.dart';

/// The state of **this process's Dart reporter and tracer** — and nothing else.
///
/// Deliberately not called a "status", because it is not a statement about
/// whether the native SDKs are collecting, and it cannot be one. Native
/// collection has its own lifetime, which outlives any single process:
///
/// * every flavor's manifest declares crash and performance collection `false`,
///   so an installation that has never activated starts with collection off;
/// * a successful production activation calls the runtime opt-in, and the
///   platform SDKs **persist** that choice at a higher priority than the
///   manifest default;
/// * a later production launch therefore begins with native collection already
///   enabled, from process start, before any Dart code runs.
///
/// So [unavailable] means "this process could not confirm its Dart adapters".
/// It does **not** mean collection is off, and nothing may present it that way.
/// Anything user-facing states the build's policy instead — see
/// `DiagnosticsPolicy` — because the policy is knowable and the live native
/// state is not.
///
/// Dev and staging are unaffected by all of this: they carry different
/// application IDs, own no Firebase configuration, and never run the production
/// activation, so no override can ever be persisted for them.
enum ObservabilityActivation {
  /// This build's policy configures no diagnostics, so no adapter is ever
  /// activated and the runtime opt-in is never called.
  notConfigured,

  /// Eligible, and activation is in flight. No Dart adapter is attached yet.
  pending,

  /// The Dart reporter and tracer are attached to the platform SDK.
  ///
  /// A statement about this process's adapters, not proof that any payload
  /// reached Firebase — delivery cannot be observed from inside the app.
  active,

  /// Eligible, but activation did not succeed **in this process**.
  ///
  /// This process's adapters report nothing and the app is unaffected. It says
  /// nothing about a collection override persisted by an earlier launch.
  unavailable,
}

/// A [ValueListenable] whose value never changes.
///
/// Lets the inert surface stay `const` while still exposing the same listenable
/// shape as a live one, so consumers never branch on which they were handed.
class StaticObservabilityActivation
    implements ValueListenable<ObservabilityActivation> {
  const StaticObservabilityActivation(this.value);

  @override
  final ObservabilityActivation value;

  @override
  void addListener(VoidCallback listener) {}

  @override
  void removeListener(VoidCallback listener) {}
}
