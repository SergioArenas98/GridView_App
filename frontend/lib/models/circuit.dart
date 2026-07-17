class Circuit {
  final int circuitID;
  final String circuitName;
  final String circuitImagePath;
  final String layoutImagePath;
  final int startYear;
  final int laps;
  final String length;
  final String raceDistance;
  final String lapRecord;
  final String driverLapRecord;
  final int yearLapRecord;
  final int yearContract;
  final int turns;
  final int drsZones;

  // Constructor
  Circuit({
    required this.circuitID,
    required this.circuitName,
    required this.circuitImagePath,
    required this.layoutImagePath,
    required this.startYear,
    required this.laps,
    required this.length,
    required this.raceDistance,
    required this.lapRecord,
    required this.driverLapRecord,
    required this.yearLapRecord,
    required this.yearContract,
    required this.turns,
    required this.drsZones,
  });

  // Factory method for creating a Circuit instance from JSON
  factory Circuit.fromJson(Map<String, dynamic> json) {
    return Circuit(
      circuitID: json['circuitID'],
      circuitName: json['circuitName'],
      circuitImagePath: json['circuitImagePath'],
      layoutImagePath: json['layoutImagePath'],
      startYear: json['startYear'],
      laps: json['laps'],
      length: json['length'],
      raceDistance: json['raceDistance'],
      lapRecord: json['lapRecord'],
      driverLapRecord: json['driverLapRecord'],
      yearLapRecord: json['yearLapRecord'],
      yearContract: json['yearContract'],
      turns: json['turns'],
      drsZones: json['drsZones'],
    );
  }

  // Convertir un objeto Circuit a un mapa JSON
  Map<String, dynamic> toJson() {
    return {
      'circuitID': circuitID,
      'circuitName': circuitName,
      'circuitImagePath': circuitImagePath,
      'layoutImagePath': layoutImagePath,
      'startYear': startYear,
      'laps': laps,
      'length': length,
      'raceDistance': raceDistance,
      'lapRecord': lapRecord,
      'driverLapRecord': driverLapRecord,
      'yearLapRecord': yearLapRecord,
      'yearContract': yearContract,
      'turns': turns,
      'drsZones': drsZones,
    };
  }
}
