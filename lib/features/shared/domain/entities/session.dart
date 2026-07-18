import 'enums.dart';

/// A scheduled weekend session. `startTime`/`endTime` are UTC instants.
class Session {
  const Session({
    required this.id,
    required this.type,
    this.name,
    this.startTime,
    this.endTime,
    required this.status,
  });

  final String id;
  final SessionType type;
  final String? name;
  final DateTime? startTime;
  final DateTime? endTime;
  final SessionStatus status;
}
