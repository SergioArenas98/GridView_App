import '../../app/environment/app_environment.dart';

/// The narrow set of failures GridView reports as non-fatals.
///
/// Every member is an *unexpected, actionable* fault: something that should not
/// happen in a correct build talking to a correct service. Ordinary operational
/// states — offline, timeout, cancellation, conditional-cache revalidation,
/// server unavailability, missing media, empty data, stale-but-usable data —
/// are deliberately absent and are never reported. See
/// [ObservabilityPolicy] for the mapping and `docs/technical/GridView_Observability.md`
/// for the rationale.
enum ObservedFailureKind {
  /// The local database refused an operation that should have succeeded.
  ///
  /// Paired with [ObservedOperation.snapshotApply] this *is* the "snapshot
  /// could not be materialized" case: the transport succeeded and the write
  /// did not. There is deliberately no separate `syncMaterializationFailure`
  /// member — the operation already says where it happened, and a second name
  /// for the same event would only invent precision the report does not have.
  ///
  /// This covers genuine storage faults only. A payload that *would have*
  /// violated an invariant is a remote-contract problem, not a local one; see
  /// [invalidRemoteContract]. There is deliberately no
  /// `persistenceInvariantViolation` member: the three typed validation
  /// exceptions are raised by the DAOs while rejecting a **remote payload**, so
  /// classifying them as a local invariant failure both mislabelled them and
  /// produced a second report for a fault already reported at the refresh
  /// boundary. If a genuinely local invariant failure ever becomes reachable,
  /// it earns its own member then — not speculatively now.
  localDatabaseFailure,

  /// The service returned a payload this client cannot interpret as valid.
  ///
  /// Includes payloads rejected by DAO validation while applying a snapshot:
  /// the data that failed the invariant came from the service, so this is the
  /// single classification and the refresh boundary is the single reporter.
  invalidRemoteContract,

  /// The service speaks an API version this build does not implement.
  unsupportedApiVersion,

  /// A configuration state that cannot occur in a correctly built release
  /// (a production build with no base URL, or one that requested fixtures).
  impossibleConfiguration,
}

/// The feature area a reported failure belongs to.
///
/// A closed enum on purpose: it is the only "which part of the app" signal
/// attached to a report, so its cardinality is fixed at compile time no matter
/// what the caller passes in.
enum ObservedFeature {
  bootstrap,
  season,
  home,
  calendar,
  standings,
  results,
  grandPrix,
  drivers,
  constructors,
  circuits,
  content,
  other;

  /// Derives the feature from a canonical resource key.
  ///
  /// **This is the redaction boundary for resource keys.** Keys embed stable
  /// identifiers — `driver:max-verstappen:2026`, `grand-prix:2026:13` — so the
  /// key itself must never reach a report. Only the leading segment is
  /// inspected, and anything unrecognised collapses to [other], so the result
  /// is one of a fixed set of values for *any* input.
  static ObservedFeature fromResourceKey(String key) {
    final int separator = key.indexOf(':');
    final String head = separator < 0 ? key : key.substring(0, separator);
    return switch (head) {
      'bootstrap' => bootstrap,
      'season' => season,
      'home' => home,
      'calendar' => calendar,
      'standings' => standings,
      'grand-prix-results' => results,
      'grand-prix' => grandPrix,
      'drivers' || 'driver' => drivers,
      'constructors' || 'constructor' => constructors,
      'circuits' || 'circuit' => circuits,
      'content' => content,
      _ => other,
    };
  }
}

/// The operation that was running when a failure was observed.
enum ObservedOperation {
  /// The conditional refresh pipeline for one resource.
  resourceRefresh,

  /// Applying a fetched snapshot to local storage.
  snapshotApply,

  /// Opening the on-disk application database.
  databaseOpen,
}

/// A non-fatal report: a closed, fully enumerated description of *what class of
/// thing* went wrong and *where*.
///
/// Every field is an enum. That is the point, and it is a structural guarantee
/// rather than a convention: there is no field capable of carrying an entity id,
/// slug, URL, query string, response body, token, KV key or stack trace, so no
/// call site can leak one even by accident, and the attribute cardinality is
/// bounded by the product of the enums.
class ObservedFailure {
  const ObservedFailure({
    required this.kind,
    required this.feature,
    required this.operation,
    required this.environment,
  });

  final ObservedFailureKind kind;
  final ObservedFeature feature;
  final ObservedOperation operation;
  final AppEnvironment environment;

  /// The identity used for flood suppression.
  ///
  /// Deliberately excludes the environment (constant within a process), so a
  /// resource that keeps failing the same way collapses to one signature.
  String get signature => '${kind.name}|${feature.name}|${operation.name}';

  /// The bounded key/value context attached to the report.
  Map<String, String> toAttributes() => <String, String>{
    'failure': kind.name,
    'feature': feature.name,
    'operation': operation.name,
    'environment': environment.name,
  };

  /// The short, low-cardinality reason string a reporter logs alongside the
  /// attributes. Never a message from an exception.
  String get reason => 'gridview.${kind.name}';

  @override
  String toString() => 'ObservedFailure($signature)';
}
