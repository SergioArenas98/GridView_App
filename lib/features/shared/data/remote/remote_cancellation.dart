import 'dart:async';

/// A cooperative cancellation handle for an in-flight remote read.
///
/// It is deliberately transport-neutral: it exposes only [isCancelled] and a
/// [whenCancelled] future so the remote data layer can bridge it to whatever
/// the underlying client uses (a Dio `CancelToken`, an early return, …) without
/// ever leaking that transport type to repositories or the UI. A repository or
/// the refresh coordinator creates one, passes it into a [GridViewApi] call and
/// calls [cancel] to abort the request; cancelling releases the caller's
/// in-flight slot so a later retry can proceed.
class RemoteCancellation {
  RemoteCancellation();

  final Completer<void> _completer = Completer<void>();
  bool _cancelled = false;

  /// Whether cancellation has been requested.
  bool get isCancelled => _cancelled;

  /// Completes once (and only once) when [cancel] is first called.
  Future<void> get whenCancelled => _completer.future;

  /// Requests cancellation. Idempotent.
  void cancel() {
    if (_cancelled) return;
    _cancelled = true;
    if (!_completer.isCompleted) _completer.complete();
  }
}
