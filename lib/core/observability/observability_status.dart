import 'package:flutter/foundation.dart';

/// What the observability surface is actually doing right now.
///
/// Eligibility is **not** a status. A build can be eligible and still be
/// transmitting nothing — because activation has not finished, or because it
/// failed — so a single boolean derived from `APP_ENV` cannot honestly drive a
/// user-visible statement about diagnostics.
enum ObservabilityStatus {
  /// This build's policy forbids diagnostic transmission. The Firebase SDK
  /// components are still packaged (they ship in every flavor), but the native
  /// collection flags are off and no Dart adapter will ever be activated.
  disabledByPolicy,

  /// The build is eligible and activation is in flight. Nothing is being
  /// transmitted yet.
  pending,

  /// The Dart reporter and tracer are attached to the platform SDK.
  ///
  /// This is a statement about **this process's Dart adapters**, not proof that
  /// any payload reached Firebase. Delivery cannot be observed from inside the
  /// app.
  activated,

  /// The build is eligible but activation did not succeed — no configuration,
  /// no platform support, or an SDK error. The app is unaffected and nothing is
  /// transmitted.
  unavailable,
}

/// A [ValueListenable] whose value never changes.
///
/// Lets the inert surface stay `const` while still exposing the same listenable
/// shape as a live one, so consumers never branch on which they were handed.
class StaticObservabilityStatus
    implements ValueListenable<ObservabilityStatus> {
  const StaticObservabilityStatus(this.value);

  @override
  final ObservabilityStatus value;

  @override
  void addListener(VoidCallback listener) {}

  @override
  void removeListener(VoidCallback listener) {}
}
