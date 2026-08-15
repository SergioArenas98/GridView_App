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

  /// The local preference store refused an operation, or returned a token that
  /// does not map to any value this build knows.
  ///
  /// Separate from [localDatabaseFailure] because it is a different store with
  /// a different failure mode and a different consequence: preferences degrade
  /// to documented defaults and the shell still renders, where a database fault
  /// costs cached content. Collapsing the two would make both less actionable.
  localPreferenceFailure,
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
  settings,
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

  /// Opening the platform preference store during startup.
  preferenceStoreOpen,

  /// Reading a persisted preference token.
  preferenceRead,

  /// Persisting a user's preference selection.
  preferenceWrite,
}

/// Which preference a diagnostic concerns.
///
/// **This is the redaction boundary for preference keys.** The stored keys are
/// namespaced strings (`gv.preference.theme` and friends); they are not secret,
/// but they are free-form text reaching a report, and the rule here is that no
/// report field may carry anything but a closed enum. Mapping known keys and
/// collapsing everything else to [other] means the attribute is one of a fixed
/// set of values for *any* input, including a key added later and forgotten
/// here.
enum ObservedPreference {
  theme,
  language,
  timeDisplay,

  /// Not a preference this build recognises, or a diagnostic with no key at all
  /// (a whole-store failure concerns no single preference).
  other;

  /// Derives the preference from a stored key, total for every input.
  static ObservedPreference fromKey(String? key) => switch (key) {
    'gv.preference.theme' => theme,
    'gv.preference.language' => language,
    'gv.preference.time_display' => timeDisplay,
    _ => other,
  };
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
    this.preference,
  });

  final ObservedFailureKind kind;
  final ObservedFeature feature;
  final ObservedOperation operation;
  final AppEnvironment environment;

  /// Which preference a preference failure concerns, when one applies.
  ///
  /// Null for every other report. Another enum, so it cannot widen the field's
  /// cardinality or smuggle a key: see [ObservedPreference].
  final ObservedPreference? preference;

  /// The identity used for flood suppression.
  ///
  /// Deliberately excludes the environment (constant within a process), so a
  /// resource that keeps failing the same way collapses to one signature. The
  /// preference is included when present, so a corrupted theme token and a
  /// corrupted language token stay distinguishable instead of suppressing each
  /// other; reports without one keep their previous signature exactly.
  String get signature => <String>[
    kind.name,
    feature.name,
    operation.name,
    if (preference != null) preference!.name,
  ].join('|');

  /// The bounded key/value context attached to the report.
  Map<String, String> toAttributes() => <String, String>{
    'failure': kind.name,
    'feature': feature.name,
    'operation': operation.name,
    'environment': environment.name,
    if (preference != null) 'preference': preference!.name,
  };

  /// The short, low-cardinality reason string a reporter logs alongside the
  /// attributes. Never a message from an exception.
  String get reason => 'gridview.${kind.name}';

  @override
  String toString() => 'ObservedFailure($signature)';
}
