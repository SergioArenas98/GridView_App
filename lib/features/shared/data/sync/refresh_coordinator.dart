import '../../domain/refresh_result.dart';

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
    future.whenComplete(() {
      if (identical(_inFlight[key], future)) _inFlight.remove(key);
    }).ignore();
    return future;
  }

  /// Whether a refresh for [key] is currently in flight (for diagnostics/tests).
  bool isInFlight(String key) => _inFlight.containsKey(key);
}
