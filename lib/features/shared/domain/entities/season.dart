import 'enums.dart';

/// A championship season. Calendar-only dates are kept as `YYYY-MM-DD` strings
/// (no time, so no time-zone conversion is applied).
class Season {
  const Season({
    required this.year,
    this.label,
    required this.status,
    this.startDate,
    this.endDate,
    this.roundCount,
    this.currentRound,
    required this.isCurrent,
  });

  final int year;
  final String? label;
  final SeasonStatus status;
  final String? startDate;
  final String? endDate;
  final int? roundCount;
  final int? currentRound;
  final bool isCurrent;
}
