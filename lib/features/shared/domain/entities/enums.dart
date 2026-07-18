// Pure domain enums. Each value carries its wire token (the JSON string used by
// the API) and a static `fromWire` that maps an unrecognised value to `unknown`.
// No JSON, Dio or Flutter imports — this file is safe for the domain layer.

enum SeasonStatus {
  upcoming('upcoming'),
  active('active'),
  completed('completed'),
  unknown('unknown');

  const SeasonStatus(this.wire);
  final String wire;

  static SeasonStatus fromWire(String? wire) =>
      values.firstWhere((v) => v.wire == wire, orElse: () => unknown);
}

enum WeekendFormat {
  standard('standard'),
  sprint('sprint'),
  unknown('unknown');

  const WeekendFormat(this.wire);
  final String wire;

  static WeekendFormat fromWire(String? wire) =>
      values.firstWhere((v) => v.wire == wire, orElse: () => unknown);
}

enum EventStatus {
  scheduled('scheduled'),
  upcoming('upcoming'),
  inProgress('in_progress'),
  completed('completed'),
  postponed('postponed'),
  cancelled('cancelled'),
  unknown('unknown');

  const EventStatus(this.wire);
  final String wire;

  static EventStatus fromWire(String? wire) =>
      values.firstWhere((v) => v.wire == wire, orElse: () => unknown);
}

enum SessionType {
  practice1('practice_1'),
  practice2('practice_2'),
  practice3('practice_3'),
  sprintQualifying('sprint_qualifying'),
  sprint('sprint'),
  qualifying('qualifying'),
  race('race'),
  unknown('unknown');

  const SessionType(this.wire);
  final String wire;

  static SessionType fromWire(String? wire) =>
      values.firstWhere((v) => v.wire == wire, orElse: () => unknown);
}

enum SessionStatus {
  scheduled('scheduled'),
  live('live'),
  completed('completed'),
  cancelled('cancelled'),
  postponed('postponed'),
  unknown('unknown');

  const SessionStatus(this.wire);
  final String wire;

  static SessionStatus fromWire(String? wire) =>
      values.firstWhere((v) => v.wire == wire, orElse: () => unknown);
}

enum DriverRole {
  race('race'),
  reserve('reserve'),
  test('test'),
  unknown('unknown');

  const DriverRole(this.wire);
  final String wire;

  static DriverRole fromWire(String? wire) =>
      values.firstWhere((v) => v.wire == wire, orElse: () => unknown);
}

enum ResultStatus {
  provisional('provisional'),
  finalResult('final'),
  unavailable('unavailable'),
  unknown('unknown');

  const ResultStatus(this.wire);
  final String wire;

  static ResultStatus fromWire(String? wire) =>
      values.firstWhere((v) => v.wire == wire, orElse: () => unknown);
}

enum FinishStatus {
  finished('finished'),
  lapped('lapped'),
  dnf('dnf'),
  dns('dns'),
  dsq('dsq'),
  dnq('dnq'),
  unknown('unknown');

  const FinishStatus(this.wire);
  final String wire;

  static FinishStatus fromWire(String? wire) =>
      values.firstWhere((v) => v.wire == wire, orElse: () => unknown);
}

enum CircuitDirection {
  clockwise('clockwise'),
  counterClockwise('counter_clockwise'),
  unknown('unknown');

  const CircuitDirection(this.wire);
  final String wire;

  static CircuitDirection fromWire(String? wire) =>
      values.firstWhere((v) => v.wire == wire, orElse: () => unknown);
}

enum MediaEntityType {
  driver('driver'),
  constructor('constructor'),
  circuit('circuit'),
  grandPrix('grand_prix'),
  placeholder('placeholder'),
  unknown('unknown');

  const MediaEntityType(this.wire);
  final String wire;

  static MediaEntityType fromWire(String? wire) =>
      values.firstWhere((v) => v.wire == wire, orElse: () => unknown);
}

enum MediaCategory {
  portrait('portrait'),
  logo('logo'),
  car('car'),
  circuitLayout('circuit_layout'),
  hero('hero'),
  thumbnail('thumbnail'),
  unknown('unknown');

  const MediaCategory(this.wire);
  final String wire;

  static MediaCategory fromWire(String? wire) =>
      values.firstWhere((v) => v.wire == wire, orElse: () => unknown);
}

enum MediaFormat {
  webp('webp'),
  avif('avif'),
  png('png'),
  jpeg('jpeg'),
  unknown('unknown');

  const MediaFormat(this.wire);
  final String wire;

  static MediaFormat fromWire(String? wire) =>
      values.firstWhere((v) => v.wire == wire, orElse: () => unknown);
}
