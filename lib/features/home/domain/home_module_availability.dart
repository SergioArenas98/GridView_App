/// Whether a Home module's underlying resource can answer at all.
///
/// Availability is deliberately **independent of cardinality**. "How many rows
/// does this module have" and "is this module's information available" are two
/// different questions, and collapsing them makes Home claim that information is
/// missing whenever a complete, valid answer happens to be empty — the season
/// finale with no races left, a championship with no confirmed leader yet.
enum HomeModuleAvailability {
  /// The persisted materialization metadata has not been read yet, so nothing
  /// is known about this module's resource.
  ///
  /// Deliberately **neutral**: it claims neither missing information nor a
  /// valid empty result. It never makes Home partial, never renders empty or
  /// unavailable copy, never publishes freshness or an update time, and never
  /// triggers a request — it is a fact about a local read still in flight.
  /// Content the module already holds stays visible throughout.
  resolving,

  /// The module's resource has no materialized local representation for the
  /// displayed season, so no reliable answer can be calculated. This is the only
  /// value that makes Home partial.
  unavailable,

  /// The resource is materialized and its complete, valid answer is empty. A
  /// real result, not missing information: it is never partial, and it is never
  /// a loading state.
  availableEmpty,

  /// The resource is materialized and has content.
  available;

  /// Whether the materialization read is still in flight. Nothing about the
  /// resource may be asserted while this is true.
  bool get isResolving => this == HomeModuleAvailability.resolving;

  /// Whether the resource is known to have no local representation. The only
  /// value that makes Home partial — an unresolved read never does.
  bool get isUnavailable => this == HomeModuleAvailability.unavailable;

  /// Whether the module answered with nothing. False both when it cannot answer
  /// at all and while it has not answered yet: an unavailable module is not an
  /// empty one, and neither is an unresolved one.
  bool get isEmptyResult => this == HomeModuleAvailability.availableEmpty;
}

/// Classifies one Home module from its resource's **materialization** and,
/// only then, from what it contains.
///
/// [materialized] must come from the approved shared collection rule
/// (`hasMaterializedCollection`: the resource's own successful record, or an
/// accepted bootstrap for this exact season) — never from a row count, so a
/// materialized-but-empty module and one that has never synchronised stay
/// distinguishable in both directions.
///
/// [materializationKnown] is false while the persisted metadata has not been
/// read yet, which yields [HomeModuleAvailability.resolving]. Every resolved
/// value is a positive finding about stored state: `availableEmpty` asserts
/// that the resource *is* materialized and its evaluated answer is empty, and
/// `unavailable` asserts that it is *not* materialized. Neither may be claimed
/// before the read completes, and neither is ever inferred from [isEmpty] while
/// it is in flight — the row count only distinguishes an empty answer from a
/// populated one once materialization is known.
HomeModuleAvailability resolveHomeModuleAvailability({
  required bool materialized,
  required bool materializationKnown,
  required bool isEmpty,
}) {
  if (!materializationKnown) return HomeModuleAvailability.resolving;
  if (!materialized) return HomeModuleAvailability.unavailable;
  return isEmpty
      ? HomeModuleAvailability.availableEmpty
      : HomeModuleAvailability.available;
}
