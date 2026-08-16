/// The stable, low-frequency operations GridView traces.
///
/// A closed enum rather than free-form strings: a trace name is a dimension in
/// the Firebase console, so an accidental `'load:$driverId'` would both explode
/// cardinality and leak an identifier. Adding a trace is a deliberate edit here.
enum TraceName {
  /// Opening the on-disk application database.
  ///
  /// Once per [GridViewDatabase] instance — in practice once per `ProviderScope`
  /// — because the connection is lazy and the provider is cached. Not "once per
  /// OS process": a second scope, as a test or a future multi-scope shell would
  /// create, opens its own connection and traces its own open.
  databaseOpen('gv_database_open'),

  /// One application synchronization run (startup, foreground or manual).
  /// Bounded by lifecycle transitions, not by scrolling or rendering, and the
  /// coordinator serialises runs so two are never in flight at once.
  syncRun('gv_sync_run');

  const TraceName(this.wireName);

  /// The sanitized name reported to the backend. Firebase limits custom trace
  /// names to 100 characters and rejects some prefixes; these are short,
  /// prefixed and fixed.
  final String wireName;
}

/// How a traced operation finished.
///
/// Two values, both constant strings, so the attribute stays a usable dimension
/// rather than a cardinality problem. There is deliberately **no `cancelled`**:
/// a cancelled synchronization run completes *normally* — the coordinator
/// observes cancellation, stops scheduling and emits `AppSyncCancelled`, then
/// returns — so the trace boundary genuinely cannot distinguish it from a
/// successful run, and inventing the value would misreport it.
enum TraceOutcome {
  success('success'),
  failure('failure');

  const TraceOutcome(this.wireValue);

  final String wireValue;

  /// The attribute key the outcome is recorded under.
  static const String attributeKey = 'outcome';
}

/// The application's performance tracing boundary.
///
/// Application code depends on this interface, never on Firebase. Like
/// `ErrorReporter`, implementations must be total and silent: a tracing failure
/// may never change the traced operation's result, timing semantics or errors.
abstract interface class PerformanceTracer {
  /// Runs [action] inside a trace named [name] and returns its result.
  ///
  /// The trace must be stopped exactly once, in a `finally`, so both success
  /// and failure close it, and the outcome must be recorded before stopping.
  /// The original result or error is always propagated untouched.
  Future<T> trace<T>(TraceName name, Future<T> Function() action);
}

/// The tracer used wherever observability is not activated.
///
/// It still runs the action, so behaviour is identical with and without
/// tracing — the only difference is that nothing is recorded. It allocates
/// nothing and touches no platform channel.
class NoopPerformanceTracer implements PerformanceTracer {
  const NoopPerformanceTracer();

  @override
  Future<T> trace<T>(TraceName name, Future<T> Function() action) => action();
}

/// Wraps a tracer so a tracing fault cannot alter the traced operation.
///
/// If starting a trace throws, the action still runs and its result or error
/// propagates exactly as it would have without tracing.
class GuardedPerformanceTracer implements PerformanceTracer {
  const GuardedPerformanceTracer(this._inner);

  final PerformanceTracer _inner;

  @override
  Future<T> trace<T>(TraceName name, Future<T> Function() action) {
    try {
      return _inner.trace<T>(name, action);
    } catch (_) {
      // The tracer failed before it ever ran the action; run it undecorated.
      return action();
    }
  }
}
