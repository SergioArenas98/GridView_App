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
  String get standingsChampionshipSelector => 'Campeonato';

  @override
  String get standingsRefreshAction => 'Actualizar clasificaciones';

  @override
  String get standingsRefreshingLabel => 'Actualizando…';

  @override
  String get standingsDriversEmptyTitle =>
      'Aún no hay clasificación de pilotos';

  @override
  String get standingsDriversEmptyMessage =>
      'El campeonato de pilotos todavía no tiene entradas clasificadas para esta temporada. Aparecerán aquí en cuanto las haya.';

  @override
  String get standingsConstructorsEmptyTitle =>
      'Aún no hay clasificación de constructores';

  @override
  String get standingsConstructorsEmptyMessage =>
      'El campeonato de constructores todavía no tiene entradas clasificadas para esta temporada. Aparecerán aquí en cuanto las haya.';

  @override
  String get standingsDriversErrorTitle =>
      'No se puede cargar la clasificación de pilotos';

  @override
  String get standingsConstructorsErrorTitle =>
      'No se puede cargar la clasificación de constructores';

  @override
  String get standingsSeasonUnavailableTitle => 'Temporada no disponible';

  @override
  String get standingsSeasonUnavailableMessage =>
      'GridView no ha podido determinar la temporada actual. Comprueba tu conexión e inténtalo de nuevo.';

  @override
  String get standingsUnrankedPosition => '—';

  @override
  String get standingsUnrankedSemantics => 'Posición no disponible';

  @override
  String standingsPositionSemantics(String position) {
    return 'Posición $position';
  }

  @override
  String standingsPointsSemantics(String points) {
    return '$points puntos';
  }

  @override
  String standingsWinsLabel(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count victorias',
      one: '1 victoria',
    );
    return '$_temp0';
  }

  @override
  String get standingsLeaderSemantics => 'Líder del campeonato';

  @override
  String get standingsTiedLeaderSemantics =>
      'Empatado en el liderato del campeonato';

  @override
  String get standingsProvisionalBadge => 'Provisional';

  @override
  String get standingsProvisionalNotice =>
      'Esta clasificación es provisional y todavía puede cambiar.';

  @override
  String get standingsNameUnavailable => 'Nombre no disponible';

  @override
  String get standingsValueUnavailable => 'No disponible';

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
  String get settingsSectionDeveloper => 'Desarrollo';

  @override
  String get settingsLanguage => 'Idioma';

  @override
  String get settingsTheme => 'Tema';

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

  @override
  String homeUpdated(String time) {
    return 'Actualizado $time';
  }

  @override
  String get offlineStaleNotice =>
      'Estos datos pueden estar desactualizados — mostrando la última versión guardada.';

  @override
  String get refreshFailedNotice =>
      'No se pudo actualizar — mostrando datos guardados.';

  @override
  String get retry => 'Reintentar';

  @override
  String get homeErrorTitle => 'No se puede cargar Inicio';

  @override
  String get errorOffline => 'Parece que no tienes conexión.';

  @override
  String get errorTimeout => 'Se agotó el tiempo de conexión.';

  @override
  String get errorServer => 'El servicio no está disponible temporalmente.';

  @override
  String get errorNotFound => 'Esos datos no están disponibles.';

  @override
  String get errorUnsupported => 'Actualiza GridView para continuar.';

  @override
  String get errorGeneric => 'Algo salió mal.';

  @override
  String get grandPrixNotFoundTitle => 'Gran Premio no encontrado';

  @override
  String get grandPrixNotFoundMessage =>
      'No pudimos encontrar este Gran Premio en el calendario.';

  @override
  String get grandPrixErrorTitle => 'No se puede cargar este Gran Premio';

  @override
  String get grandPrixResultsAvailable => 'Los resultados están disponibles.';

  @override
  String get eventStateScheduled => 'Programado';

  @override
  String get eventStateLive => 'En directo';

  @override
  String get eventStatePostponed => 'Aplazado';

  @override
  String get eventStateCancelled => 'Cancelado';

  @override
  String get sessionStateScheduled => 'Programada';

  @override
  String get sessionStateCompleted => 'Finalizada';

  @override
  String get mockDataBanner => 'Datos de muestra — no son resultados reales';

  @override
  String lastUpdatedLabel(String time) {
    return 'Actualizado $time';
  }

  @override
  String get eventStateUnknown => 'Estado desconocido';

  @override
  String get sessionStateUnknown => 'Estado desconocido';

  @override
  String get sessionNameUnknown => 'Sesión';

  @override
  String get weekendFormatStandard => 'Fin de semana estándar';

  @override
  String get weekendFormatSprint => 'Fin de semana al sprint';

  @override
  String get weekendFormatUnknown => 'Formato desconocido';

  @override
  String get calendarNextLabel => 'Siguiente';

  @override
  String get calendarEmptyTitle => 'Todavía no hay carreras programadas';

  @override
  String get calendarEmptyMessage =>
      'El calendario de esta temporada aún no se ha publicado. Aparecerá aquí en cuanto lo esté.';

  @override
  String get calendarErrorTitle => 'No se puede cargar el calendario';

  @override
  String get calendarSeasonUnavailableTitle =>
      'Temporada no disponible todavía';

  @override
  String get calendarSeasonUnavailableMessage =>
      'GridView no ha podido determinar la temporada actual. Comprueba tu conexión e inténtalo de nuevo.';

  @override
  String get calendarRefreshAction => 'Actualizar el calendario';

  @override
  String calendarEventSemantics(String name, String round, String status) {
    return '$name, ronda $round, $status';
  }

  @override
  String get grandPrixNoSessionsTitle => 'Horario no disponible';

  @override
  String get grandPrixNoSessionsMessage =>
      'Los horarios de las sesiones de este fin de semana aún no se han publicado.';

  @override
  String get grandPrixSprintResults => 'Resultados del sprint';

  @override
  String get grandPrixRaceResults => 'Resultados de la carrera';

  @override
  String get grandPrixResultsUnavailableTitle =>
      'Resultados aún no disponibles';

  @override
  String get grandPrixResultsErrorTitle => 'No se pueden cargar los resultados';

  @override
  String grandPrixOpenDriver(String name) {
    return 'Abrir el piloto $name';
  }

  @override
  String grandPrixOpenConstructor(String name) {
    return 'Abrir el equipo $name';
  }

  @override
  String get fieldCircuit => 'Circuito';

  @override
  String get fieldLocation => 'Ubicación';

  @override
  String get fieldDates => 'Fechas';

  @override
  String get fieldEventTimeZone => 'Zona horaria del evento';

  @override
  String get fieldDeviceTimeZone => 'Tu zona horaria';

  @override
  String get driverNameUnavailable => 'Nombre del piloto no disponible';

  @override
  String get constructorNameUnavailable => 'Nombre del equipo no disponible';

  @override
  String get grandPrixOpenConstructorUnnamed => 'Abrir el equipo';

  @override
  String get resultsFastestLap => 'Vuelta rápida';

  @override
  String resultLapsBehind(int laps) {
    String _temp0 = intl.Intl.pluralLogic(
      laps,
      locale: localeName,
      other: '+$laps vueltas',
      one: '+1 vuelta',
    );
    return '$_temp0';
  }

  @override
  String get resultStatusProvisional => 'Provisional';

  @override
  String get resultStatusFinal => 'Definitivo';

  @override
  String get resultStatusUnavailable => 'No disponible';

  @override
  String get resultStatusUnknown => 'Estado desconocido';

  @override
  String get finishStatusFinished => 'Finalizó';

  @override
  String get finishStatusLapped => 'Doblado';

  @override
  String get finishStatusDnf => 'DNF';

  @override
  String get finishStatusDns => 'DNS';

  @override
  String get finishStatusDsq => 'DSQ';

  @override
  String get finishStatusDnq => 'DNQ';

  @override
  String get finishStatusUnknown => 'Estado desconocido';

  @override
  String get exploreCategorySelector => 'Categoría';

  @override
  String get exploreDriversEmptyTitle => 'Todavía no hay pilotos';

  @override
  String get exploreDriversEmptyMessage =>
      'Esta temporada aún no tiene pilotos publicados. Aparecerán aquí en cuanto los haya.';

  @override
  String get exploreTeamsEmptyTitle => 'Todavía no hay equipos';

  @override
  String get exploreTeamsEmptyMessage =>
      'Esta temporada aún no tiene equipos publicados. Aparecerán aquí en cuanto los haya.';

  @override
  String get exploreCircuitsEmptyTitle => 'Todavía no hay circuitos';

  @override
  String get exploreCircuitsEmptyMessage =>
      'Esta temporada aún no tiene circuitos publicados. Aparecerán aquí en cuanto los haya.';

  @override
  String get exploreDriversErrorTitle => 'No se pueden cargar los pilotos';

  @override
  String get exploreTeamsErrorTitle => 'No se pueden cargar los equipos';

  @override
  String get exploreCircuitsErrorTitle => 'No se pueden cargar los circuitos';

  @override
  String get exploreSeasonUnavailableTitle => 'Temporada no disponible';

  @override
  String get exploreSeasonUnavailableMessage =>
      'GridView no ha podido determinar la temporada actual. Comprueba tu conexión e inténtalo de nuevo.';

  @override
  String get exploreUpdateFailed => 'No se pudo actualizar';

  @override
  String get exploreCachedNotice => 'Mostrando datos guardados';

  @override
  String exploreOpenDriver(String name) {
    return 'Abrir el piloto $name';
  }

  @override
  String exploreOpenTeam(String name) {
    return 'Abrir el equipo $name';
  }

  @override
  String exploreOpenCircuit(String name) {
    return 'Abrir el circuito $name';
  }

  @override
  String get detailNotFoundTitle => 'No disponible';

  @override
  String get detailNotFoundMessage =>
      'Este perfil no está disponible. Puede que se haya eliminado o que el enlace esté desactualizado.';

  @override
  String get detailSeasonUnavailableTitle => 'Temporada no disponible';

  @override
  String get detailSeasonUnavailableMessage =>
      'GridView no ha podido determinar qué temporada mostrar. Comprueba tu conexión e inténtalo de nuevo.';

  @override
  String get detailUpdateFailed => 'No se pudo actualizar';

  @override
  String get detailCachedNotice => 'Los detalles pueden estar desactualizados';

  @override
  String get detailPartialNotice =>
      'Parte de la información del perfil no está disponible';

  @override
  String get detailLoadErrorTitle => 'No se puede cargar este perfil';

  @override
  String get driverAbout => 'Biografía';

  @override
  String get driverProfileSection => 'Perfil';

  @override
  String get driverParticipationSection => 'Participación en la temporada';

  @override
  String get driverChampionshipSection => 'Campeonato';

  @override
  String get driverRaceNumber => 'Dorsal de la temporada';

  @override
  String get driverPermanentNumber => 'Dorsal permanente';

  @override
  String get driverRoleRace => 'Piloto titular';

  @override
  String get driverRoleReserve => 'Piloto reserva';

  @override
  String get driverRoleTest => 'Piloto de pruebas';

  @override
  String get driverRoleUnknown => 'Rol no disponible';

  @override
  String driverOpenTeam(String name) {
    return 'Abrir el equipo $name';
  }

  @override
  String get driverViewStandings => 'Ver clasificación de pilotos';

  @override
  String get driverTeamUnavailable => 'Equipo no disponible';

  @override
  String get driverPortraitPlaceholder => 'Retrato del piloto no disponible';

  @override
  String get teamLineupSection => 'Pilotos';

  @override
  String get teamFactsSection => 'Datos del equipo';

  @override
  String get teamChampionshipSection => 'Campeonato';

  @override
  String get teamAbout => 'Historia';

  @override
  String get fieldTeamPrincipal => 'Director de equipo';

  @override
  String get fieldChassis => 'Chasis';

  @override
  String teamOpenDriver(String name) {
    return 'Abrir el piloto $name';
  }

  @override
  String get teamViewStandings => 'Ver clasificación de constructores';

  @override
  String get teamLineupUnavailable => 'Alineación no disponible';

  @override
  String get teamLogoPlaceholder => 'Logotipo del equipo no disponible';

  @override
  String get circuitFactsSection => 'Datos del circuito';

  @override
  String get circuitLapRecordSection => 'Récord de vuelta';

  @override
  String get fieldCorners => 'Curvas';

  @override
  String get fieldDirection => 'Sentido';

  @override
  String get fieldFirstGrandPrix => 'Primer Gran Premio';

  @override
  String get fieldLapRecordTime => 'Tiempo';

  @override
  String get fieldLapRecordDriver => 'Piloto';

  @override
  String get fieldLapRecordYear => 'Año';

  @override
  String get circuitDirectionClockwise => 'Horario';

  @override
  String get circuitDirectionCounterClockwise => 'Antihorario';

  @override
  String get circuitDirectionUnknown => 'Sentido no disponible';

  @override
  String get circuitLapRecordDriverUnavailable => 'Piloto no disponible';

  @override
  String get circuitNoRelatedGrandPrix => 'Sin Gran Premio esta temporada';

  @override
  String circuitOpenGrandPrix(String name) {
    return 'Abrir $name';
  }

  @override
  String get circuitLayoutPlaceholder => 'Trazado del circuito no disponible';

  @override
  String circuitLayoutImage(String circuit) {
    return 'Trazado de $circuit';
  }

  @override
  String lengthKilometers(String value) {
    return '$value km';
  }

  @override
  String get fieldWins => 'Victorias';

  @override
  String get fieldPodiums => 'Podios';

  @override
  String get fieldNationality => 'Nacionalidad';

  @override
  String get fieldDateOfBirth => 'Fecha de nacimiento';

  @override
  String get fieldPlaceOfBirth => 'Lugar de nacimiento';

  @override
  String get fieldTeam => 'Equipo';

  @override
  String get participationFullSeason => 'Temporada completa';

  @override
  String participationFromRound(int round) {
    return 'Desde la ronda $round';
  }

  @override
  String participationUntilRound(int round) {
    return 'Hasta la ronda $round';
  }

  @override
  String participationRoundRange(int start, int end) {
    return 'Rondas $start–$end';
  }

  @override
  String get positionUnranked => 'Sin clasificar';

  @override
  String get fieldRole => 'Rol';

  @override
  String get fieldParticipation => 'Participación';

  @override
  String get grandPrixNameUnavailable => 'Nombre del Gran Premio no disponible';

  @override
  String get homeRefreshAction => 'Actualizar Inicio';

  @override
  String get homeCurrentGrandPrix => 'Gran Premio actual';

  @override
  String get homeLatestGrandPrix => 'Último Gran Premio';

  @override
  String get homeRaceWeekend => 'Fin de semana de carrera';

  @override
  String get homeLiveNow => 'En directo ahora';

  @override
  String get homeStartingSoon => 'Empieza en breve';

  @override
  String homeStartsInMinutes(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Empieza en $count minutos',
      one: 'Empieza en 1 minuto',
    );
    return '$_temp0';
  }

  @override
  String homeStartsInHours(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Empieza en $count horas',
      one: 'Empieza en 1 hora',
    );
    return '$_temp0';
  }

  @override
  String homeStartsInDays(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Empieza en $count días',
      one: 'Empieza en 1 día',
    );
    return '$_temp0';
  }

  @override
  String get homeCurrentSession => 'Sesión actual';

  @override
  String get homeNextSession => 'Próxima sesión';

  @override
  String get homeSessionUnavailable => 'Horarios de sesión no disponibles';

  @override
  String get homeSeasonUnavailableTitle => 'Temporada no disponible';

  @override
  String get homeSeasonUnavailableMessage =>
      'GridView no ha podido determinar la temporada actual. Comprueba tu conexión e inténtalo de nuevo.';

  @override
  String get homeCalendarUnavailableTitle => 'Calendario no disponible';

  @override
  String get homeCalendarUnavailableMessage =>
      'Esta temporada todavía no tiene eventos publicados. La pantalla de inicio se completará en cuanto los haya.';

  @override
  String get homeDriversLeaderTitle => 'Líder del Campeonato de Pilotos';

  @override
  String get homeTeamsLeaderTitle => 'Líder del Campeonato de Constructores';

  @override
  String get homeTiedLeaders => 'Líderes empatados';

  @override
  String get homeLeaderUnavailable => 'Líder no disponible';

  @override
  String get homeNoLeaderYet => 'Aún no hay líder';

  @override
  String homePointsValue(String points) {
    return '$points pts';
  }

  @override
  String get homeWinnerLabel => 'Ganador';

  @override
  String get homeWinnerUnavailable => 'Ganador no disponible';

  @override
  String get homeResultUnavailable => 'Resultado no disponible';

  @override
  String get homeNoUpcomingEvents => 'No hay próximos eventos';

  @override
  String get homeUpcomingUnavailable => 'Próximos eventos no disponibles';

  @override
  String get homeViewCalendar => 'Ver calendario';

  @override
  String get homeQuickLinks => 'Explorar';

  @override
  String get homeOpenDrivers => 'Abrir Pilotos';

  @override
  String get homeOpenTeams => 'Abrir Equipos';

  @override
  String get homeOpenCircuits => 'Abrir Circuitos';

  @override
  String homeOpenDriver(String name) {
    return 'Abrir el piloto $name';
  }

  @override
  String homeOpenTeam(String name) {
    return 'Abrir el equipo $name';
  }

  @override
  String get homeSomeInformationUnavailable =>
      'Parte de la información no está disponible';

  @override
  String get homeSomeInformationOutdated =>
      'Parte de la información puede estar desactualizada';

  @override
  String get homeCachedNotice => 'Mostrando datos guardados';

  @override
  String get homeUpdateFailed => 'No se pudo actualizar';

  @override
  String get settingsSectionPreferences => 'Preferencias';

  @override
  String get settingsSectionDataApp => 'Datos y aplicación';

  @override
  String get settingsSectionPrivacySupport => 'Privacidad y soporte';

  @override
  String get settingsTimeDisplay => 'Horario mostrado';

  @override
  String get settingsDataAndUpdates => 'Datos y actualizaciones';

  @override
  String get settingsFeedback => 'Enviar comentarios';

  @override
  String get settingsLanguageSystem => 'Predeterminado del sistema';

  @override
  String get settingsLanguageSystemDescription =>
      'Usar el idioma del dispositivo cuando GridView lo admita; si no, inglés.';

  @override
  String get settingsLanguageEnglish => 'English';

  @override
  String get settingsLanguageSpanish => 'Español';

  @override
  String get settingsThemeSystem => 'Sistema';

  @override
  String get settingsThemeSystemDescription =>
      'Seguir el ajuste claro u oscuro del dispositivo.';

  @override
  String get settingsThemeDark => 'Oscuro';

  @override
  String get settingsThemeLight => 'Claro';

  @override
  String get settingsTimeDevice => 'Hora del dispositivo';

  @override
  String get settingsTimeDeviceDescription =>
      'Mostrar las horas de las sesiones en la zona horaria de tu dispositivo.';

  @override
  String get settingsTimeEvent => 'Hora del evento';

  @override
  String get settingsTimeEventDescription =>
      'Mostrar las horas de las sesiones en la zona horaria local del circuito.';

  @override
  String get settingsTimeBoth => 'Ambas';

  @override
  String get settingsTimeBothDescription =>
      'Mostrar juntas la hora del evento y la de tu dispositivo.';

  @override
  String get settingsDataEnvironment => 'Entorno';

  @override
  String get settingsDataSource => 'Origen de datos';

  @override
  String get settingsDataSourceRemote => 'Servicio de GridView';

  @override
  String get settingsDataSourceSample => 'Datos de ejemplo';

  @override
  String get settingsDataSourceUnavailable => 'Sin configurar';

  @override
  String get settingsDataApiVersion => 'Versión de la API';

  @override
  String get settingsDataCurrentSeason => 'Temporada actual';

  @override
  String get settingsDataCurrentSeasonUnresolved => 'Todavía no disponible';

  @override
  String get settingsDataOfflineExplanation =>
      'GridView guarda la temporada en tu dispositivo, así que se abre y funciona sin conexión. La información nueva se descarga al abrir la aplicación y al actualizar.';

  @override
  String get settingsAboutApplication => 'Aplicación';

  @override
  String get settingsAboutBuild => 'Compilación';

  @override
  String get settingsAboutUnofficial =>
      'GridView es una aplicación independiente. No está asociada, respaldada ni afiliada a la Fórmula 1, la FIA ni a ningún equipo.';

  @override
  String get settingsPrivacyAndLegal => 'Privacidad y aviso legal';

  @override
  String get settingsPrivacyPolicyOpen => 'Leer la política de privacidad';

  @override
  String get settingsPrivacyPolicyUnavailable =>
      'Esta compilación no tiene configurada una política de privacidad.';

  @override
  String get settingsPrivacyCrashReporting => 'Informes de fallos';

  @override
  String get settingsPrivacyPerformance => 'Supervisión del rendimiento';

  @override
  String get settingsPrivacyAdvertising => 'Publicidad';

  @override
  String get settingsPrivacyEnabled => 'Activado';

  @override
  String get settingsPrivacyDisabled => 'Desactivado';

  @override
  String get settingsAcknowledgementsEmpty =>
      'Todavía no hay atribuciones guardadas.';

  @override
  String get settingsAcknowledgementsData => 'Datos';

  @override
  String get settingsAcknowledgementsMedia => 'Imágenes';

  @override
  String get settingsFeedbackUnavailable =>
      'No hay ninguna dirección de contacto configurada.';

  @override
  String get settingsOpenFailed => 'No se pudo abrir ese enlace.';

  @override
  String get settingsSaveFailed =>
      'No se pudo guardar ese ajuste. Inténtalo de nuevo.';

  @override
  String get settingsSelected => 'Seleccionado';

  @override
  String get mediaCategoryPortrait => 'Retrato';

  @override
  String get mediaCategoryLogo => 'Logotipo';

  @override
  String get mediaCategoryCar => 'Coche';

  @override
  String get mediaCategoryCircuitLayout => 'Trazado del circuito';

  @override
  String get mediaCategoryHero => 'Imagen destacada';

  @override
  String get mediaCategoryThumbnail => 'Miniatura';

  @override
  String get mediaCategoryOther => 'Imagen';
}
