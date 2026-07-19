import 'package:flutter/widgets.dart';

import '../../../../app/router/route_names.dart';

/// Presentation-only placeholder models and deterministic mock values used by
/// the Phase 3B screen skeletons.
///
/// These are intentionally NOT domain entities or API DTOs. Screens in this
/// phase are data-independent: they render stable, deterministic chrome so that
/// layout, navigation, accessibility and goldens can be validated without any
/// controller, repository or data source. Real data replaces these in Phase 4.
///
/// Restraint rule (UI/UX §7.2): team colours appear only as thin accents (a
/// line, dot or small highlight), never as full row backgrounds.
@immutable
class PlaceholderConstructor {
  const PlaceholderConstructor({
    required this.id,
    required this.name,
    required this.base,
    required this.powerUnit,
    required this.accent,
  });

  final String id;
  final String name;
  final String base;
  final String powerUnit;
  final Color accent;
}

@immutable
class PlaceholderDriver {
  const PlaceholderDriver({
    required this.id,
    required this.name,
    required this.constructorId,
    required this.team,
    required this.number,
    required this.accent,
  });

  final String id;
  final String name;
  final String constructorId;
  final String team;
  final String number;
  final Color accent;
}

@immutable
class PlaceholderCircuit {
  const PlaceholderCircuit({
    required this.id,
    required this.name,
    required this.country,
    required this.lengthKm,
    required this.laps,
  });

  final String id;
  final String name;
  final String country;
  final String lengthKm;
  final int laps;
}

/// Chronological state of a calendar event.
enum PlaceholderEventState { completed, current, upcoming }

@immutable
class PlaceholderSession {
  const PlaceholderSession({
    required this.name,
    required this.day,
    required this.time,
    this.state = PlaceholderEventState.upcoming,
  });

  final String name;
  final String day;
  final String time;
  final PlaceholderEventState state;
}

@immutable
class PlaceholderEvent {
  const PlaceholderEvent({
    required this.season,
    required this.round,
    required this.name,
    required this.circuitId,
    required this.circuitName,
    required this.dateRange,
    required this.state,
  });

  final int season;
  final int round;
  final String name;
  final String circuitId;
  final String circuitName;
  final String dateRange;
  final PlaceholderEventState state;
}

@immutable
class PlaceholderStanding {
  const PlaceholderStanding({
    required this.position,
    required this.entityId,
    required this.name,
    required this.detail,
    required this.points,
    required this.accent,
    this.isLeader = false,
  });

  final int position;
  final String entityId;
  final String name;
  final String detail;
  final String points;
  final Color accent;
  final bool isLeader;
}

/// Deterministic placeholder catalogue. Values are stable across runs so
/// widget and golden tests are reproducible.
abstract final class Placeholders {
  Placeholders._();

  static const int season = kDefaultSeason;

  // Restrained team accent colours (decorative only).
  static const Color _red = Color(0xFFE8002D);
  static const Color _orange = Color(0xFFFF8000);
  static const Color _teal = Color(0xFF00A19C);
  static const Color _blue = Color(0xFF1E41FF);
  static const Color _green = Color(0xFF229971);

  static const List<PlaceholderConstructor> constructors =
      <PlaceholderConstructor>[
        PlaceholderConstructor(
          id: 'scuderia-rossa',
          name: 'Scuderia Rossa',
          base: 'Maranello, Italy',
          powerUnit: 'Rossa',
          accent: _red,
        ),
        PlaceholderConstructor(
          id: 'papaya-racing',
          name: 'Papaya Racing',
          base: 'Woking, United Kingdom',
          powerUnit: 'Mercury',
          accent: _orange,
        ),
        PlaceholderConstructor(
          id: 'silver-arrow',
          name: 'Silver Arrow',
          base: 'Brackley, United Kingdom',
          powerUnit: 'Mercury',
          accent: _teal,
        ),
        PlaceholderConstructor(
          id: 'oracle-bulls',
          name: 'Oracle Bulls',
          base: 'Milton Keynes, United Kingdom',
          powerUnit: 'Rings',
          accent: _blue,
        ),
        PlaceholderConstructor(
          id: 'emerald-gp',
          name: 'Emerald GP',
          base: 'Enstone, United Kingdom',
          powerUnit: 'Rings',
          accent: _green,
        ),
      ];

  static const List<PlaceholderDriver> drivers = <PlaceholderDriver>[
    PlaceholderDriver(
      id: 'a-driver',
      name: 'Alex Driver',
      constructorId: 'oracle-bulls',
      team: 'Oracle Bulls',
      number: '1',
      accent: _blue,
    ),
    PlaceholderDriver(
      id: 'b-racer',
      name: 'Bruno Racer',
      constructorId: 'scuderia-rossa',
      team: 'Scuderia Rossa',
      number: '16',
      accent: _red,
    ),
    PlaceholderDriver(
      id: 'c-pilot',
      name: 'Carla Pilot',
      constructorId: 'papaya-racing',
      team: 'Papaya Racing',
      number: '4',
      accent: _orange,
    ),
    PlaceholderDriver(
      id: 'd-speed',
      name: 'Diego Speed',
      constructorId: 'silver-arrow',
      team: 'Silver Arrow',
      number: '63',
      accent: _teal,
    ),
    PlaceholderDriver(
      id: 'e-swift',
      name: 'Elena Swift',
      constructorId: 'emerald-gp',
      team: 'Emerald GP',
      number: '10',
      accent: _green,
    ),
    PlaceholderDriver(
      id: 'f-dash',
      name: 'Fen Dash',
      constructorId: 'papaya-racing',
      team: 'Papaya Racing',
      number: '81',
      accent: _orange,
    ),
  ];

  static const List<PlaceholderCircuit> circuits = <PlaceholderCircuit>[
    PlaceholderCircuit(
      id: 'northgate',
      name: 'Northgate Circuit',
      country: 'United Kingdom',
      lengthKm: '5.891',
      laps: 52,
    ),
    PlaceholderCircuit(
      id: 'lakeside',
      name: 'Lakeside Park',
      country: 'Canada',
      lengthKm: '4.361',
      laps: 70,
    ),
    PlaceholderCircuit(
      id: 'monte-alto',
      name: 'Monte Alto Street Circuit',
      country: 'Monaco',
      lengthKm: '3.337',
      laps: 78,
    ),
    PlaceholderCircuit(
      id: 'red-dunes',
      name: 'Red Dunes Raceway',
      country: 'United Arab Emirates',
      lengthKm: '5.281',
      laps: 58,
    ),
    PlaceholderCircuit(
      id: 'greenhill',
      name: 'Greenhill Motor Speedway',
      country: 'Japan',
      lengthKm: '5.807',
      laps: 53,
    ),
  ];

  static const List<PlaceholderEvent> calendar = <PlaceholderEvent>[
    PlaceholderEvent(
      season: season,
      round: 1,
      name: 'Northgate Grand Prix',
      circuitId: 'northgate',
      circuitName: 'Northgate Circuit',
      dateRange: 'Mar 6 – 8',
      state: PlaceholderEventState.completed,
    ),
    PlaceholderEvent(
      season: season,
      round: 2,
      name: 'Lakeside Grand Prix',
      circuitId: 'lakeside',
      circuitName: 'Lakeside Park',
      dateRange: 'Mar 20 – 22',
      state: PlaceholderEventState.completed,
    ),
    PlaceholderEvent(
      season: season,
      round: 3,
      name: 'Monte Alto Grand Prix',
      circuitId: 'monte-alto',
      circuitName: 'Monte Alto Street Circuit',
      dateRange: 'Apr 3 – 5',
      state: PlaceholderEventState.current,
    ),
    PlaceholderEvent(
      season: season,
      round: 4,
      name: 'Red Dunes Grand Prix',
      circuitId: 'red-dunes',
      circuitName: 'Red Dunes Raceway',
      dateRange: 'Apr 17 – 19',
      state: PlaceholderEventState.upcoming,
    ),
    PlaceholderEvent(
      season: season,
      round: 5,
      name: 'Greenhill Grand Prix',
      circuitId: 'greenhill',
      circuitName: 'Greenhill Motor Speedway',
      dateRange: 'May 1 – 3',
      state: PlaceholderEventState.upcoming,
    ),
  ];

  static const List<PlaceholderSession> weekend = <PlaceholderSession>[
    PlaceholderSession(
      name: 'Practice 1',
      day: 'Fri',
      time: '13:30',
      state: PlaceholderEventState.completed,
    ),
    PlaceholderSession(
      name: 'Practice 2',
      day: 'Fri',
      time: '17:00',
      state: PlaceholderEventState.completed,
    ),
    PlaceholderSession(
      name: 'Practice 3',
      day: 'Sat',
      time: '12:30',
      state: PlaceholderEventState.current,
    ),
    PlaceholderSession(name: 'Qualifying', day: 'Sat', time: '16:00'),
    PlaceholderSession(name: 'Race', day: 'Sun', time: '15:00'),
  ];

  static List<PlaceholderStanding> driverStandings() {
    return <PlaceholderStanding>[
      for (int i = 0; i < drivers.length; i++)
        PlaceholderStanding(
          position: i + 1,
          entityId: drivers[i].id,
          name: drivers[i].name,
          detail: drivers[i].team,
          points: '${(drivers.length - i) * 43 + 12}',
          accent: drivers[i].accent,
          isLeader: i == 0,
        ),
    ];
  }

  static List<PlaceholderStanding> constructorStandings() {
    return <PlaceholderStanding>[
      for (int i = 0; i < constructors.length; i++)
        PlaceholderStanding(
          position: i + 1,
          entityId: constructors[i].id,
          name: constructors[i].name,
          detail: constructors[i].powerUnit,
          points: '${(constructors.length - i) * 71 + 20}',
          accent: constructors[i].accent,
          isLeader: i == 0,
        ),
    ];
  }

  /// The next event to highlight on Home (first non-completed, else last).
  static PlaceholderEvent get nextEvent => calendar.firstWhere(
    (PlaceholderEvent e) => e.state != PlaceholderEventState.completed,
    orElse: () => calendar.last,
  );

  /// Lookups by stable id. When an id is valid but not in the placeholder
  /// catalogue, `null` is returned and the screen shows a generic placeholder
  /// identity rather than inventing data or crashing.
  static PlaceholderDriver? driverById(String id) =>
      _firstWhereOrNull(drivers, (PlaceholderDriver d) => d.id == id);

  static PlaceholderConstructor? constructorById(String id) =>
      _firstWhereOrNull(constructors, (PlaceholderConstructor c) => c.id == id);

  static PlaceholderCircuit? circuitById(String id) =>
      _firstWhereOrNull(circuits, (PlaceholderCircuit c) => c.id == id);

  static PlaceholderEvent? eventByRound(int season, int round) =>
      _firstWhereOrNull(
        calendar,
        (PlaceholderEvent e) => e.season == season && e.round == round,
      );

  static PlaceholderStanding? standingForDriver(String id) => _firstWhereOrNull(
    driverStandings(),
    (PlaceholderStanding s) => s.entityId == id,
  );

  static PlaceholderStanding? standingForConstructor(String id) =>
      _firstWhereOrNull(
        constructorStandings(),
        (PlaceholderStanding s) => s.entityId == id,
      );

  /// Drivers racing for a given constructor this season.
  static List<PlaceholderDriver> driversForConstructor(String constructorId) =>
      drivers
          .where((PlaceholderDriver d) => d.constructorId == constructorId)
          .toList();

  /// The calendar event held at a given circuit this season, if any.
  static PlaceholderEvent? eventForCircuit(String circuitId) =>
      _firstWhereOrNull(
        calendar,
        (PlaceholderEvent e) => e.circuitId == circuitId,
      );
}

T? _firstWhereOrNull<T>(List<T> items, bool Function(T) test) {
  for (final T item in items) {
    if (test(item)) return item;
  }
  return null;
}
