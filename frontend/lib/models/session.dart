import 'package:flutter/material.dart';
import 'package:gridview/l10n/app_localizations.dart';
import 'package:intl/intl.dart';

class Session {
  final int sessionID;
  final String sessionName;
  final String startTime;
  final String endTime;
  late bool isOngoing;
  late bool isCompleted;

  Session({
    required this.sessionID,
    required this.sessionName,
    required this.startTime,
    required this.endTime,
    this.isOngoing = false,
    this.isCompleted = false,
  });

  factory Session.fromJson(Map<String, dynamic> json) {
    return Session(
      sessionID: json['sessionID'],
      sessionName: json['sessionName'],
      startTime: json['startTime'],
      endTime: json['endTime'],
      isOngoing: false,
      isCompleted: false,
    );
  }

  Map<String, dynamic> toJson() {
  return {
    'sessionID': sessionID,
    'sessionName': sessionName,
    'startTime': startTime,
    'endTime': endTime,
    'isOngoing': isOngoing,
    'isCompleted': isCompleted,
  };
}

  // ============ FORMATEO DE FECHA LOCALIZADO ============ //
  // Capitaliza la primera letra de un string
  static String _capitalize(String input) {
    if (input.isEmpty) return input;
    return input[0].toUpperCase() + input.substring(1);
  }

  // Método para formatear fecha completa localizado (ej: "26/5/2025")
  static String formatFullLocalizedDate(String date, BuildContext context) {
    try {
      final locale = Localizations.localeOf(context);
      final parsedDate = DateTime.parse(date).toLocal();
      
      // Usa el formato corto estándar para la localización
      return DateFormat.yMd(locale.toString()).format(parsedDate);
    } catch (e) {
      return date;
    }
  }

  // Método para formatear fecha localizada (ej: "26 de febrero")
  static String formatLocalizedDate(String date, BuildContext context) {
    try {
      DateTime parsedDate = DateTime.parse(date);
      String formatted = DateFormat('d MMMM', Localizations.localeOf(context).toString()).format(parsedDate.toLocal());
      return _capitalize(formatted);
    } catch (e) {
      return date;
    }
  }

  // Método para formatear día de la semana localizado (ej: "miércoles")
  static String formatLocalizedDay(String date, BuildContext context) {
    try {
      DateTime parsedDate = DateTime.parse(date);
      String formatted = DateFormat('EEEE', Localizations.localeOf(context).toString()).format(parsedDate.toLocal());
      return _capitalize(formatted);
    } catch (e) {
      return date;
    }
  }

  // Método para formatear mes y año localizado (ej: "Febrero 2025")
  static String formatLocalizedMonthYear(String date, BuildContext context) {
    try {
      DateTime parsedDate = DateTime.parse(date);
      String formatted = DateFormat('MMMM yyyy', Localizations.localeOf(context).toString())
          .format(parsedDate.toLocal());
      return _capitalize(formatted);
    } catch (e) {
      return date;
    }
  }
  // ============ FORMATEO DE FECHA LOCALIZADO ============ //

  // Método para traducir el nombre de la sesión al idioma local
  static String translateSessionName(String sessionName, BuildContext context) {
    switch (sessionName) {
      case "Practice 1":
        return AppLocalizations.of(context)!.practice1;
      case "Practice 2":
        return AppLocalizations.of(context)!.practice2;
      case "Practice 3":
        return AppLocalizations.of(context)!.practice3;
      case "Sprint Qualifying":
        return AppLocalizations.of(context)!.sprintQualifying;
      case "Qualifying":
        return AppLocalizations.of(context)!.qualifying;
      case "Sprint Race":
        return AppLocalizations.of(context)!.sprintRace;
      case "Race":
        return AppLocalizations.of(context)!.race;
      default:
        return sessionName;
    }
  }


  // Convert UTC time to local time
  static String convertUtcToLocal(String utcTime) {
    try {
      DateTime utcDateTime = DateTime.parse(utcTime);
      DateTime localDateTime = utcDateTime.toLocal();
      return DateFormat('HH:mm').format(localDateTime);
  } catch (e) {
      return utcTime;
    }
  }


  void sessionStatus() {
    // Get current date and time in UTC
    final now = DateTime.now().toUtc();
    // Convert start and end times to DateTime format
    final startDateTime = DateTime.parse(startTime);
    final endDateTime = DateTime.parse(endTime);
    if (now.isAfter(endDateTime)) {
      isCompleted = true;
      isOngoing = false;
    } else if (now.isAfter(startDateTime) && now.isBefore(endDateTime)) {
      isOngoing = true;
      isCompleted = false;
    } else {
      isOngoing = false;
      isCompleted = false;
    }
  }  
}
