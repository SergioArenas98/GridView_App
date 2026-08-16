import 'dart:async';

/// A FIFO lane that runs one reporting operation at a time.
///
/// Crashlytics custom keys are **process-global**: `setCustomKey` mutates a
/// context that the *next* `recordError` reads. A report is therefore not one
/// call but a sequence — set every key, then record — and that sequence has to
/// be atomic with respect to other reports.
///
/// Without this lane, two failures arriving close together (concurrent resource
/// refreshes, or several buffered startup reports replayed at once) each start
/// their own unawaited sequence. Their key writes interleave, and whichever
/// `recordError` runs second is attributed with the *other* failure's feature,
/// operation and environment. The attributes would still be bounded enums — they
/// would simply describe the wrong failure, which is worse than no attributes.
///
/// The lane is fire-and-forget from the application's point of view: [add]
/// returns immediately and no caller ever waits for it. It is also unbreakable
/// by design — every operation is wrapped so that a synchronous throw, a
/// rejected future or a failing backend call is swallowed and the chain
/// continues, because a report queue that stops after its first failure is a
/// queue that goes silent exactly when something is wrong.
class SerialReportQueue {
  /// The tail of the chain. Invariant: this future **never** completes with an
  /// error, because every link swallows its own. That is what keeps a failed
  /// report from poisoning the ones queued behind it.
  Future<void> _tail = Future<void>.value();

  /// Whether anything is still queued or running. Test-facing.
  int get pending => _pending;
  int _pending = 0;

  /// Enqueues [operation] and returns immediately.
  ///
  /// Never throws, and never returns a future the caller could accidentally
  /// await: reporting must not appear on any application code path.
  void add(Future<void> Function() operation) {
    _pending++;
    _tail = _tail.then((_) async {
      try {
        // Invoked inside the async body, so a synchronous throw from
        // `operation` is captured here rather than escaping into the chain.
        await operation();
      } catch (_) {
        // Deliberately swallowed. See the class doc: a reporting failure is
        // not an application fault, and re-reporting it would recurse through
        // the same broken path.
      } finally {
        _pending--;
      }
    });
  }

  /// Completes when everything queued so far has finished. **Tests only.**
  ///
  /// Production never calls this — the whole point of the lane is that nobody
  /// waits for it.
  Future<void> get settled => _tail;
}
