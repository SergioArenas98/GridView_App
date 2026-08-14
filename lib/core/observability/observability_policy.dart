import '../api/errors/api_failure.dart';
import 'observed_failure.dart';

/// Decides which failures are worth reporting.
///
/// A pure, total function of the typed failure category — no I/O, no Firebase,
/// no environment lookup — so the policy is fully testable on its own and the
/// call sites stay free of judgement calls.
///
/// The default is **do not report**. A category earns a place here only by
/// being unexpected in a correct build talking to a correct service, and
/// actionable by a developer reading it.
class ObservabilityPolicy {
  const ObservabilityPolicy._();

  /// Maps a transport/contract failure to a reportable kind, or `null` when the
  /// failure is an ordinary operational state that must never be reported.
  static ObservedFailureKind? classifyApiFailure(ApiFailureKind kind) {
    return switch (kind) {
      // --- Reported: unexpected and actionable ----------------------------
      //
      // The service answered, but with something this client cannot treat as a
      // valid representation. Either the contract drifted or a snapshot is
      // corrupt; both need a human.
      ApiFailureKind.invalidResponse =>
        ObservedFailureKind.invalidRemoteContract,

      // The build cannot speak the service's version. Users are stuck until
      // someone ships or rolls back.
      ApiFailureKind.unsupportedApiVersion =>
        ObservedFailureKind.unsupportedApiVersion,

      // A release that cannot reach its own API, or that asked for fixtures.
      // Impossible in a correctly built production artifact — which is exactly
      // why it is worth a report if it ever appears. Non-production builds hit
      // this routinely while developing, and they run the no-op reporter, so it
      // is filtered by environment rather than by category.
      ApiFailureKind.configuration =>
        ObservedFailureKind.impossibleConfiguration,

      // --- Never reported: ordinary operational states --------------------
      //
      // The user is offline, on a slow link, or the request was superseded.
      // Every one of these is represented in the UI already and says nothing
      // about a defect. Reporting them would bury the signal above.
      ApiFailureKind.networkUnavailable ||
      ApiFailureKind.networkTimeout ||
      ApiFailureKind.cancelled ||
      // The service is briefly unhappy or throttling us. Operational, visible
      // in edge telemetry, and self-correcting.
      ApiFailureKind.rateLimited ||
      ApiFailureKind.serverUnavailable ||
      ApiFailureKind.maintenance ||
      // A resource that is genuinely absent — a season not covered, a detail
      // withdrawn. Normal content state, not a fault.
      ApiFailureKind.notFound ||
      // Reachable from a stale local key (a season the service has since
      // dropped), so it is not reliably a client defect. Deliberately excluded
      // to keep the allowlist narrow; revisit only with evidence.
      ApiFailureKind.invalidRequest ||
      // An unmapped server code. Usually a code this build predates rather
      // than a fault, so it stays out for the same reason.
      ApiFailureKind.unknown => null,
    };
  }
}

/// Suppresses repeated non-fatals so a retrying loop cannot flood reporting.
///
/// Keyed by [ObservedFailure.signature], which is built only from enums, so the
/// map is bounded by the enum product regardless of how many resources fail:
/// there is no unbounded growth to evict and no eviction claim to enforce.
///
/// The first occurrence of a signature is always reported; further occurrences
/// are dropped until [window] has elapsed since the last accepted one.
class NonFatalThrottle {
  NonFatalThrottle({this.window = const Duration(minutes: 5)});

  /// How long a signature stays suppressed after being reported.
  final Duration window;

  final Map<String, DateTime> _lastReported = <String, DateTime>{};

  /// Whether [failure] should be reported at [now].
  bool allow(ObservedFailure failure, DateTime now) {
    final DateTime? last = _lastReported[failure.signature];
    if (last != null && now.difference(last) < window) return false;
    _lastReported[failure.signature] = now;
    return true;
  }

  /// Test seam: forget every suppression.
  void reset() => _lastReported.clear();
}
