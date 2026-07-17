import 'package:gridview/models/team.dart';

class Driver {
  final int driverID;
  final String driverName;
  final String driverSurname;
  final String driverFullName;
  final String nameAbbreviation;
  final String country;
  final int? carNumber;
  final String teamColor;
  final String teamLogo;
  final String dateOfBirth;
  final String role;
  final String worldChampionships;
  final String flagImagePath;
  final int? teamID;
  final String driverImg;
  final String placeOfBirth;
  final String? podiums;
  final String? points;
  final String? grandsPrix;
  final String? highestRaceFinish;
  final String? highestGridPosition;
  final int? standingPosition;
  final double? standingPoints;
  Team? team;

  Driver({
    required this.driverID,
    required this.driverName,
    required this.driverSurname,
    required this.driverFullName,
    required this.nameAbbreviation,
    required this.country,
    this.carNumber,
    required this.teamColor,
    required this.teamLogo,
    required this.dateOfBirth,
    required this.role,
    required this.worldChampionships,
    required this.flagImagePath,
    required this.teamID,
    required this.driverImg,
    required this.placeOfBirth,
    required this.podiums,
    required this.points,
    required this.grandsPrix,
    required this.highestRaceFinish,
    required this.highestGridPosition,
    this.standingPosition,
    this.standingPoints,
  });

  // Convertir de JSON a un objeto Driver
  factory Driver.fromJson(Map<String, dynamic> json) {
    return Driver(
      driverID: json['driverID'] ?? 0,
      driverName: json['driverName'] ?? '',
      driverSurname: json['driverSurname'] ?? '',
      driverFullName: json['driverFullName'] ?? '',
      nameAbbreviation: json['nameAbbreviation'] ?? '',
      country: json['country'] ?? '',
      carNumber: json['carNumber'] ?? 0,
      teamColor: json['teamColor'] ?? '',
      teamLogo: json['teamLogo'] ?? '',
      dateOfBirth: json['dateOfBirth'] ?? '',
      role: json['role'] ?? '',
      worldChampionships: json['worldChampionships'] ?? '',
      flagImagePath: json['flagImagePath'] ?? '',
      teamID: json['teamID'] ?? 0,
      driverImg: json['driverImg'] ?? '',
      placeOfBirth: json['placeOfBirth'] ?? '',
      podiums: json['podiums'] ?? '',
      points: json['points'] ?? '',
      grandsPrix: json['grandsPrix'] ?? '',
      highestRaceFinish: json['highestRaceFinish'] ?? '',
      highestGridPosition: json['highestGridPosition'] ?? '',
      standingPosition: json['standingPosition'] ?? 0,
      standingPoints: json['standingPoints'] ?? 0.0,
    );
  }

  // Convertir un objeto Driver a un mapa JSON
  Map<String, dynamic> toJson() {
    return {
      'driverID': driverID,
      'driverName': driverName,
      'driverSurname': driverSurname,
      'driverFullName': driverFullName,
      'nameAbbreviation': nameAbbreviation,
      'country': country,
      'carNumber': carNumber,
      'teamColor': teamColor,
      'teamLogo': teamLogo,
      'dateOfBirth': dateOfBirth,
      'role': role,
      'worldChampionships': worldChampionships,
      'flagImagePath': flagImagePath,
      'teamID': teamID,
      'driverImg': driverImg,
      'placeOfBirth': placeOfBirth,
      'podiums': podiums,
      'points': points,
      'grandsPrix': grandsPrix,
      'highestRaceFinish': highestRaceFinish,
      'highestGridPosition': highestGridPosition,
      'standingPosition': standingPosition,
      'standingPoints': standingPoints,
    };
  }
}