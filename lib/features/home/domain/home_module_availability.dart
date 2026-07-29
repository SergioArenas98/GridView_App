/// Whether a Home module's underlying resource can answer at all.
///
/// Availability is deliberately **independent of cardinality**. "How many rows
/// does this module have" and "is this module's information available" are two
/// different questions, and collapsing them makes Home claim that information is
/// missing whenever a complete, valid answer happens to be empty — the season
/// finale with no races left, a championship with no confirmed leader yet.
enum HomeModuleAvailability {
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

  /// Whether the module can answer, empty or not.
  bool get isAvailable => this != HomeModuleAvailability.unavailable;

  /// Whether the module answered with nothing. False when it cannot answer at
  /// all — an unavailable module is not an empty one.
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
/// read yet. Unavailability is a positive finding about stored state, never an
/// assumption made while that state is still loading, so an empty module is
/// reported as a valid empty result until the metadata actually says otherwise.
/// The classification tightens on the next emission; it never flashes a
/// "missing information" claim that the database has not confirmed.
HomeModuleAvailability resolveHomeModuleAvailability({
  required bool materialized,
  required bool materializationKnown,
  required bool isEmpty,
}) {
  if (materializationKnown && !materialized) {
    return HomeModuleAvailability.unavailable;
  }
  return isEmpty
      ? HomeModuleAvailability.availableEmpty
      : HomeModuleAvailability.available;
}
