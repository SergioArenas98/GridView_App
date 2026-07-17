import 'package:gridview/models/driver.dart';

class Team {
  final int teamID;
  final String teamShortName;
  final String teamFullName;
  final String teamBase;
  final String country;
  final String teamChief;
  final String technicalChief;
  final String chassis;
  final String powerUnit;
  final String? teamEntry;
  final String color;
  final String worldChampionships;
  final String highestRaceFinish;
  final String polePositions;
  final String fastestLaps;
  final String carImg;
  final String mainLogoImg;
  final String logoImg;
  final String flagImg;
  final int? standingPosition;
  final double standingPoints;
  final List<Driver> drivers;

  Team({
    required this.teamID,
    required this.teamShortName,
    required this.teamFullName,
    required this.teamBase,
    required this.country,
    required this.teamChief,
    required this.technicalChief,
    required this.chassis,
    required this.powerUnit,
     this.teamEntry,
    required this.color,
    required this.worldChampionships,
    required this.highestRaceFinish,
    required this.polePositions,
    required this.fastestLaps,
    required this.carImg,
    required this.drivers,
    required this.mainLogoImg,
    required this.logoImg,
    required this.flagImg,
    this.standingPosition,
    required this.standingPoints,
  });

  // Convertir de JSON a un objeto Team
  factory Team.fromJson(Map<String, dynamic> json) {
    return Team(
      teamID: int.tryParse(json['teamID'].toString()) ?? 0,
      teamShortName: json['teamShortName'] ?? null,
      teamFullName: json['teamFullName'] ?? null,
      teamBase: json['teamBase'] ?? null,
      country: json['country'] ?? null,
      teamChief: json['teamChief'] ?? null,
      technicalChief: json['technicalChief'] ?? null,
      chassis: json['chassis'] ?? null,
      powerUnit: json['powerUnit'] ?? null,
      color: json['color'] ?? null,
      teamEntry: json['teamEntry'] ?? null,
      worldChampionships: json['worldChampionships'] ?? null,
      highestRaceFinish: json['highestRaceFinish'] ?? null,
      polePositions: json['polePositions'] ?? null,
      fastestLaps: json['fastestLaps'] ?? null,
      carImg: json['carImg'] ?? null,
      mainLogoImg: json['mainLogoImg'] ?? null,
      logoImg: json['logoImg'] ?? null,
      flagImg: json['flagImg'] ?? null,
      drivers: (json['drivers'] as List?)?.map((driverJson) => Driver.fromJson(driverJson)).toList() ?? [],
      standingPosition: int.tryParse(json['standingPosition'].toString()) ?? 0,
      standingPoints: double.tryParse(json['standingPoints'].toString()) ?? 0.0,
    );
  }

  // Convertir un objeto Team a un mapa JSON
  Map<String, dynamic> toJson() {
    return {
      'teamID': teamID,
      'teamShortName': teamShortName,
      'teamFullName': teamFullName,
      'teamBase': teamBase,
      'country': country,
      'teamChief': teamChief,
      'technicalChief': technicalChief,
      'chassis': chassis,
      'powerUnit': powerUnit,
      'teamEntry': teamEntry,
      'color': color,
      'worldChampionships': worldChampionships,
      'highestRaceFinish': highestRaceFinish,
      'polePositions': polePositions,
      'fastestLaps': fastestLaps,
      'carImg': carImg,
      'mainLogoImg': mainLogoImg,
      'logoImg': logoImg,
      'flagImg': flagImg,
      'standingPosition': standingPosition,
      'standingPoints': standingPoints,
      'drivers': drivers.map((driver) => driver.toJson()).toList(),
    };
  }
}