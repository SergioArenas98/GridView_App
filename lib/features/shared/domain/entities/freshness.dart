/// Snapshot freshness. `generatedAt` and the optional instants are UTC.
class DataFreshness {
  const DataFreshness({
    required this.generatedAt,
    this.sourceUpdatedAt,
    this.staleAfter,
    this.contentVersion,
    this.stale,
  });

  final DateTime generatedAt;
  final DateTime? sourceUpdatedAt;
  final DateTime? staleAfter;
  final String? contentVersion;
  final bool? stale;
}
