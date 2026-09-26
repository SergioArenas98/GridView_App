/// The single relevance rule for one driver's participation spans in a season.
///
/// A driver may hold several spans (a mid-season move or a return is a new
/// span). The **current** span is the open one (`endRound == null`), otherwise
/// the one with the latest effective start, where a null `startRound` is the
/// season start. It is the same rule the edge API applies to
/// `DriverDetail.seasonEntry`, so the driver card, driver detail and the
/// published detail can never disagree about which span is current.
///
/// Ordering never depends on the order the rows were stored or read in. Two
/// open spans, or two spans sharing a start, cannot be persisted: the local
/// write rejects overlapping spans before anything is stored.
library;

/// [spans] in relevance order: the open span first, then by latest effective
/// start. The first element is the current span. Returns a new list.
List<T> sortBySpanRelevance<T>(
  Iterable<T> spans, {
  required int? Function(T span) startRound,
  required int? Function(T span) endRound,
}) {
  final List<T> sorted = List<T>.of(spans);
  sorted.sort((T a, T b) {
    final bool aOpen = endRound(a) == null;
    final bool bOpen = endRound(b) == null;
    if (aOpen != bOpen) return aOpen ? -1 : 1;
    return _compareStarts(startRound(b), startRound(a));
  });
  return sorted;
}

/// Chronological comparison of two starts, a null start being the season
/// start and therefore earlier than every numbered round.
int _compareStarts(int? a, int? b) {
  if (a == b) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  return a.compareTo(b);
}
