// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Spanish Castilian (`es`).
class AppLocalizationsEs extends AppLocalizations {
  AppLocalizationsEs([String locale = 'es']) : super(locale);

  @override
  String get appTitle => 'GridView';

  @override
  String get navHome => 'Inicio';

  @override
  String get navCalendar => 'Calendario';

  @override
  String get navStandings => 'Clasificaciones';

  @override
  String get navExplore => 'Explorar';

  @override
  String seasonLabel(String season) {
    return 'Temporada $season';
  }

  @override
  String roundLabel(String round) {
    return 'Ronda $round';
  }

  @override
  String get seeAll => 'Ver todo';

  @override
  String get settingsOpen => 'Abrir ajustes';

  @override
  String get previewDataNotice =>
      'Diseño de vista previa. Los datos reales llegarán en una próxima actualización.';

  @override
  String get eventStateCompleted => 'Finalizado';

  @override
  String get eventStateCurrent => 'Este fin de semana';

  @override
  String get eventStateUpcoming => 'Próximo';

  @override
  String get homeNextGrandPrix => 'Próximo Gran Premio';

  @override
  String get homeSessions => 'Sesiones del fin de semana';

  @override
  String get homeLeaders => 'Líderes del campeonato';

  @override
  String get homeLeaderDrivers => 'Líder de pilotos';

  @override
  String get homeLeaderConstructors => 'Líder de constructores';

  @override
  String get homeLatestResult => 'Último resultado';

  @override
  String get homeUpcoming => 'Próximos eventos';

  @override
  String get homeOpenGrandPrix => 'Ver Gran Premio';

  @override
  String get calendarTitle => 'Calendario';

  @override
  String get grandPrixTitle => 'Gran Premio';

  @override
  String get grandPrixCircuit => 'Circuito';

  @override
  String get grandPrixSessions => 'Sesiones';

  @override
  String get grandPrixResults => 'Resultados';

  @override
  String get grandPrixResultsPending =>
      'Los resultados aparecerán cuando finalice la sesión.';

  @override
  String get grandPrixViewCircuit => 'Ver circuito';

  @override
  String get standingsTitle => 'Clasificaciones';

  @override
  String get standingsDrivers => 'Pilotos';

  @override
  String get standingsConstructors => 'Constructores';

  @override
  String get exploreTitle => 'Explorar';

  @override
  String get exploreDrivers => 'Pilotos';

  @override
  String get exploreTeams => 'Equipos';

  @override
  String get exploreCircuits => 'Circuitos';

  @override
  String get exploreDriversDescription =>
      'Todos los pilotos de la parrilla actual';

  @override
  String get exploreTeamsDescription =>
      'Todos los constructores de esta temporada';

  @override
  String get exploreCircuitsDescription => 'Todos los circuitos del calendario';

  @override
  String get driverTitle => 'Piloto';

  @override
  String get driverCurrentTeam => 'Equipo actual';

  @override
  String get driverSeasonStanding => 'Clasificación de la temporada';

  @override
  String get driverStatistics => 'Estadísticas';

  @override
  String get constructorTitle => 'Equipo';

  @override
  String get constructorDrivers => 'Pilotos actuales';

  @override
  String get constructorStanding => 'Clasificación de constructores';

  @override
  String get constructorInformation => 'Información del equipo';

  @override
  String get circuitTitle => 'Circuito';

  @override
  String get circuitInformation => 'Información del circuito';

  @override
  String get circuitLayout => 'Trazado';

  @override
  String get circuitRelatedGrandPrix => 'El Gran Premio de esta temporada';

  @override
  String get fieldIdentifier => 'Identificador';

  @override
  String get fieldNumber => 'Número';

  @override
  String get fieldPoints => 'Puntos';

  @override
  String get fieldPosition => 'Posición';

  @override
  String get fieldPowerUnit => 'Unidad de potencia';

  @override
  String get fieldBase => 'Sede';

  @override
  String get fieldCountry => 'País';

  @override
  String get fieldLength => 'Longitud';

  @override
  String get fieldLaps => 'Vueltas';

  @override
  String get genericEntityName => 'Perfil de marcador de posición';

  @override
  String get settingsTitle => 'Ajustes';

  @override
  String get settingsSectionGeneral => 'General';

  @override
  String get settingsSectionAbout => 'Acerca de';

  @override
  String get settingsSectionDeveloper => 'Desarrollo';

  @override
  String get settingsLanguage => 'Idioma';

  @override
  String get settingsLanguageValue => 'Predeterminado del sistema';

  @override
  String get settingsTheme => 'Tema';

  @override
  String get settingsThemeValue => 'Oscuro';

  @override
  String get settingsThemeNote =>
      'En esta versión solo está disponible el tema oscuro.';

  @override
  String get settingsPrivacy => 'Privacidad';

  @override
  String get settingsAcknowledgements => 'Agradecimientos';

  @override
  String get settingsAppInformation => 'Información de la aplicación';

  @override
  String get settingsVersion => 'Versión';

  @override
  String get settingsComponentCatalogue => 'Catálogo de componentes';

  @override
  String get settingsComponentCatalogueDescription =>
      'Galería del sistema de diseño solo para desarrollo';

  @override
  String get notFoundTitle => 'Pantalla no encontrada';

  @override
  String get notFoundMessage =>
      'No pudimos abrir esta página. Puede que se haya movido o que nunca existiera.';

  @override
  String get invalidRouteTitle => 'Enlace no válido';

  @override
  String get invalidRouteMessage => 'Este enlace apunta a algo que no existe.';

  @override
  String get notFoundGoHome => 'Ir a Inicio';
}
