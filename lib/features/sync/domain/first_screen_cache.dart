/// The exact predicate for "the first screen can already render from cache".
///
/// It is deliberately small. The first useful frame needs the season the app is
/// about, and a Home read model for **that** season — nothing more. Requiring
/// the calendar, standings or the explore collections would turn a perfectly
/// renderable returning launch into a forced first-use bootstrap.
///
/// [currentSeason] is the locally stored current season (null when none is
/// stored yet). [homeFeaturedSeason] is the season of the cached Home read
/// model's featured event (null when no Home snapshot is cached). They must
/// agree: a Home snapshot left over from last season cannot render this one.
bool hasUsableFirstScreenCache({
  required int? currentSeason,
  required int? homeFeaturedSeason,
}) => currentSeason != null && homeFeaturedSeason == currentSeason;
