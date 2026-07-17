import 'package:gridview/models/category.dart';
import 'package:gridview/models/circuit.dart';
import 'package:gridview/models/session.dart';

class GrandPrix {
  final int grandPrixID;
  final String fullName;
  final String shortName;
  final String eventType;
  final int season;
  final int? number;
  final int? laps;
  final String city;
  final String country;
  final int? gmtOffset;
  late String flagImagePath;
  final Circuit circuit;
  final List<Category> categories;
  final List<Session> sessions;

  // ignore: prefer_final_fields
  static Map<int, int> _seasonGrandPrixCount = {};

  // Set para almacenar los IDs de los eventos ya contados
  static final Set<int> _countedEvents = {};

  GrandPrix({
    required this.grandPrixID,
    required this.fullName,
    required this.shortName,
    required this.eventType,
    required this.season,
    this.number,
    this.laps,
    required this.city,
    required this.country,
    required this.gmtOffset,
    required this.flagImagePath,
    required this.circuit,
    required this.categories,
    required this.sessions,
  }) {

    // Solo contar si el evento es 'Sprint Weekend' o 'Race Weekend'
    if ((eventType == 'Sprint Weekend' || eventType == 'Race Weekend') && !_countedEvents.contains(grandPrixID)) {
      _incrementGrandPrixCount(season);
      _countedEvents.add(grandPrixID);
    }
  }
  
  // Método para incrementar el conteo de grandes premios por temporada
  static void _incrementGrandPrixCount(int season) {
    if (_seasonGrandPrixCount.containsKey(season)) {
      _seasonGrandPrixCount[season] = _seasonGrandPrixCount[season]! + 1;
    } else {
      _seasonGrandPrixCount[season] = 1;
    }
  }

  // Función para obtener el conteo de grandes premios en una temporada
  static int getGrandPrixCountBySeason(int season) {
    return _seasonGrandPrixCount[season] ?? 0;
  }

  factory GrandPrix.fromJson(Map<String, dynamic> json) {
    return GrandPrix(
      grandPrixID: json['grandPrixID'],
      fullName: json['fullName'],
      shortName: json['shortName'],
      eventType: json['eventType'],
      season: json['season'],
      number: json['number'],
      laps: json['laps'],
      city: json['city'],
      country: json['country'],
      gmtOffset: json['gmtOffset'],
      flagImagePath: json['flagImagePath'],
      circuit: Circuit.fromJson(json['circuit']),
      categories: (json['categories'] as List<dynamic>)
          .map((cat) => Category.fromJson(cat))
          .toList(),
      sessions: (json['sessions'] as List<dynamic>)
          .map((sess) => Session.fromJson(sess))
          .toList(),
    );
  }

  // Convertir un objeto GrandPrix a un mapa JSON
  Map<String, dynamic> toJson() {
    return {
      'grandPrixID': grandPrixID,
      'fullName': fullName,
      'shortName': shortName,
      'eventType': eventType,
      'season': season,
      'number': number,
      'laps': laps,
      'city': city,
      'country': country,
      'gmtOffset': gmtOffset,
      'flagImagePath': flagImagePath,
      'circuit': circuit.toJson(),
      'categories': categories.map((category) => category.toJson()).toList(),
      'sessions': sessions.map((session) => session.toJson()).toList(),
    };
  }
}