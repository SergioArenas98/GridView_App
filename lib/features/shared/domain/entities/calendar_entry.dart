import 'circuit.dart';
import 'grand_prix.dart';

/// One event of a season calendar as read from the local database.
///
/// A domain-only read model (no Drift rows, no DTOs) composed from the persisted
/// Grand Prix summary and its host circuit summary. The calendar payload itself
/// carries only `circuitId`/`circuitName`; locality and country arrive with the
/// season circuits collection, so both stay optional and are simply absent until
/// that resource has been synchronised.
class CalendarEntry {
  const CalendarEntry({required this.grandPrix, this.circuit});

  final GrandPrix grandPrix;

  /// The host circuit summary, when the circuit row is present locally.
  final Circuit? circuit;

  String get id => grandPrix.id;
  int get season => grandPrix.season;
  int get round => grandPrix.round;

  /// The circuit's display name, or `null` when only the identifier is known.
  /// Never a humanised identifier — a missing name stays missing.
  String? get circuitName => circuit?.name;

  String? get locality => circuit?.locality;
  String? get country => circuit?.country;

  /// Whether the event's own detail (its ordered sessions) is already cached.
  bool get hasLocalSessions => grandPrix.sessions.isNotEmpty;
}
