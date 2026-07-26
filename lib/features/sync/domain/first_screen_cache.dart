/// The exact predicate for "the first screen can already render from cache".
///
/// It is deliberately small. The first useful frame needs the season the app is
/// about, and a **materialized Home representation for that season** — nothing
/// more. Requiring the calendar, standings or the explore collections would turn
/// a perfectly renderable returning launch into a forced first-use bootstrap.
///
/// [currentSeason] is the locally stored current season (null when none is
/// stored yet). [materializedHomeSeason] is the season recorded by the persisted
/// Home snapshot (null when no Home has been materialized). They must agree: a
/// Home representation belonging only to another season cannot render this one.
///
/// Materialization is read from the stored snapshot, **not** inferred from the
/// presence of a featured Grand Prix. A current season whose Home legitimately
/// has no events is a valid empty state and a usable cache — it must not send
/// the app back through bootstrap on every restart.
bool hasUsableFirstScreenCache({
  required int? currentSeason,
  required int? materializedHomeSeason,
}) => currentSeason != null && materializedHomeSeason == currentSeason;
