// ignore_for_file: prefer_initializing_formals
import '../../domain/refresh_result.dart';

/// Notified once per completed refresh, with the canonical key and outcome.
///
/// A plain callback rather than an interface, and deliberately not an
/// observability type: the coordinator stays ignorant of what an observer does
/// with the outcome. The composition root supplies one that applies the
/// reporting policy (`observeRefreshOutcomes`); tests supply a recorder.
typedef RefreshOutcomeObserver =
    void Function(String key, RefreshResult result);

/// Deduplicates concurrent refreshes of the **same** canonical resource key.
///
/// While a refresh for a key is in flight, any further refresh for that same key
/// joins the running one and shares its single [RefreshResult] — so two
/// simultaneous refreshes make one network request. Different keys refresh
/// independently (no global lock). When a refresh finishes — success, failure or
/// cancellation — its slot is released so a later retry starts a fresh request.
///
/// This is a reusable per-resource coordinator, held once per data layer. It
/// makes no policy decisions (when/whether to refresh is the repository's job);
/// it only collapses duplicate in-flight work.
class RefreshCoordinator {
  RefreshCoordinator({RefreshOutcomeObserver? onOutcome})
    : _onOutcome = onOutcome;

  /// Observes each completed refresh. Notified **once per run**, from the slot
  /// that owns the run rather than per caller, so refreshes that were collapsed
  /// into one in-flight future are also reported once.
  final RefreshOutcomeObserver? _onOutcome;

  final Map<String, Future<RefreshResult>> _inFlight =
      <String, Future<RefreshResult>>{};

  /// Runs [action] for [key], or joins the in-flight run for [key] if one
  /// exists. The slot is released once the run completes (however it completes).
  Future<RefreshResult> run(
    String key,
    Future<RefreshResult> Function() action,
  ) {
    final Future<RefreshResult>? existing = _inFlight[key];
    if (existing != null) return existing;

    final Future<RefreshResult> future = action();
    _inFlight[key] = future;
    // Release the slot on completion (success, failure or thrown error) without
    // altering the result the caller receives. The cleanup branch is a separate
    // listener whose error is `.ignore()`d — the caller's own `await` observes
    // the real error. Guard against clobbering a newer run for the same key.
    future
        .then<void>((RefreshResult result) {
          if (identical(_inFlight[key], future)) _inFlight.remove(key);
          _notify(key, result);
        })
        .catchError((Object _) {
          // A thrown run still has to release its slot. The caller's own
          // `await` observes the real error; this branch must not.
          if (identical(_inFlight[key], future)) _inFlight.remove(key);
        })
        .ignore();
    return future;
  }

  /// Runs the observer without letting it affect the refresh in any way.
  void _notify(String key, RefreshResult result) {
    final RefreshOutcomeObserver? observe = _onOutcome;
    if (observe == null) return;
    try {
      observe(key, result);
    } catch (_) {
      // Observation is never allowed to change an outcome; see the class doc.
    }
  }

  /// Whether a refresh for [key] is currently in flight (for diagnostics/tests).
  bool isInFlight(String key) => _inFlight.containsKey(key);
}
