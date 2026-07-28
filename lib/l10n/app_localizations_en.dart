// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'GridView';

  @override
  String get navHome => 'Home';

  @override
  String get navCalendar => 'Calendar';

  @override
  String get navStandings => 'Standings';

  @override
  String get navExplore => 'Explore';

  @override
  String seasonLabel(String season) {
    return '$season season';
  }

  @override
  String roundLabel(String round) {
    return 'Round $round';
  }

  @override
  String get seeAll => 'See all';

  @override
  String get settingsOpen => 'Open settings';

  @override
  String get previewDataNotice =>
      'Preview layout. Live data arrives in a later update.';

  @override
  String get eventStateCompleted => 'Completed';

  @override
  String get eventStateCurrent => 'This weekend';

  @override
  String get eventStateUpcoming => 'Upcoming';

  @override
  String get homeNextGrandPrix => 'Next Grand Prix';

  @override
  String get homeSessions => 'Weekend sessions';

  @override
  String get homeLeaders => 'Championship leaders';

  @override
  String get homeLeaderDrivers => 'Drivers\' leader';

  @override
  String get homeLeaderConstructors => 'Constructors\' leader';

  @override
  String get homeLatestResult => 'Latest result';

  @override
  String get homeUpcoming => 'Upcoming events';

  @override
  String get homeOpenGrandPrix => 'View Grand Prix';

  @override
  String get calendarTitle => 'Calendar';

  @override
  String get grandPrixTitle => 'Grand Prix';

  @override
  String get grandPrixCircuit => 'Circuit';

  @override
  String get grandPrixSessions => 'Sessions';

  @override
  String get grandPrixResults => 'Results';

  @override
  String get grandPrixResultsPending =>
      'Results will appear once the session is complete.';

  @override
  String get grandPrixViewCircuit => 'View circuit';

  @override
  String get standingsTitle => 'Standings';

  @override
  String get standingsDrivers => 'Drivers';

  @override
  String get standingsConstructors => 'Constructors';

  @override
  String get standingsChampionshipSelector => 'Championship';

  @override
  String get standingsRefreshAction => 'Refresh standings';

  @override
  String get standingsRefreshingLabel => 'Refreshing…';

  @override
  String get standingsDriversEmptyTitle => 'No drivers\' standings yet';

  @override
  String get standingsDriversEmptyMessage =>
      'The drivers\' championship has no classified entries for this season yet. They will appear here as soon as they do.';

  @override
  String get standingsConstructorsEmptyTitle =>
      'No constructors\' standings yet';

  @override
  String get standingsConstructorsEmptyMessage =>
      'The constructors\' championship has no classified entries for this season yet. They will appear here as soon as they do.';

  @override
  String get standingsDriversErrorTitle =>
      'Can\'t load the drivers\' standings';

  @override
  String get standingsConstructorsErrorTitle =>
      'Can\'t load the constructors\' standings';

  @override
  String get standingsSeasonUnavailableTitle => 'Season unavailable';

  @override
  String get standingsSeasonUnavailableMessage =>
      'GridView could not determine the current season. Check your connection and try again.';

  @override
  String get standingsUnrankedPosition => '—';

  @override
  String get standingsUnrankedSemantics => 'Position unavailable';

  @override
  String standingsPositionSemantics(String position) {
    return 'Position $position';
  }

  @override
  String standingsPointsSemantics(String points) {
    return '$points points';
  }

  @override
  String standingsWinsLabel(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count wins',
      one: '1 win',
    );
    return '$_temp0';
  }

  @override
  String get standingsLeaderSemantics => 'Championship leader';

  @override
  String get standingsTiedLeaderSemantics => 'Tied for the championship lead';

  @override
  String get standingsProvisionalBadge => 'Provisional';

  @override
  String get standingsProvisionalNotice =>
      'These standings are provisional and may still change.';

  @override
  String get standingsNameUnavailable => 'Name unavailable';

  @override
  String get standingsValueUnavailable => 'Not available';

  @override
  String get exploreTitle => 'Explore';

  @override
  String get exploreDrivers => 'Drivers';

  @override
  String get exploreTeams => 'Teams';

  @override
  String get exploreCircuits => 'Circuits';

  @override
  String get exploreDriversDescription => 'Every driver on the current grid';

  @override
  String get exploreTeamsDescription => 'Every constructor this season';

  @override
  String get exploreCircuitsDescription => 'Every circuit on the calendar';

  @override
  String get driverTitle => 'Driver';

  @override
  String get driverCurrentTeam => 'Current team';

  @override
  String get driverSeasonStanding => 'Season standing';

  @override
  String get driverStatistics => 'Statistics';

  @override
  String get constructorTitle => 'Team';

  @override
  String get constructorDrivers => 'Current drivers';

  @override
  String get constructorStanding => 'Constructor standing';

  @override
  String get constructorInformation => 'Team information';

  @override
  String get circuitTitle => 'Circuit';

  @override
  String get circuitInformation => 'Circuit information';

  @override
  String get circuitLayout => 'Layout';

  @override
  String get circuitRelatedGrandPrix => 'This season\'s Grand Prix';

  @override
  String get fieldIdentifier => 'Identifier';

  @override
  String get fieldNumber => 'Number';

  @override
  String get fieldPoints => 'Points';

  @override
  String get fieldPosition => 'Position';

  @override
  String get fieldPowerUnit => 'Power unit';

  @override
  String get fieldBase => 'Base';

  @override
  String get fieldCountry => 'Country';

  @override
  String get fieldLength => 'Length';

  @override
  String get fieldLaps => 'Laps';

  @override
  String get genericEntityName => 'Profile placeholder';

  @override
  String get settingsTitle => 'Settings';

  @override
  String get settingsSectionGeneral => 'General';

  @override
  String get settingsSectionAbout => 'About';

  @override
  String get settingsSectionDeveloper => 'Developer';

  @override
  String get settingsLanguage => 'Language';

  @override
  String get settingsLanguageValue => 'System default';

  @override
  String get settingsTheme => 'Theme';

  @override
  String get settingsThemeValue => 'Dark';

  @override
  String get settingsThemeNote =>
      'Only a dark theme is available in this version.';

  @override
  String get settingsPrivacy => 'Privacy';

  @override
  String get settingsAcknowledgements => 'Acknowledgements';

  @override
  String get settingsAppInformation => 'App information';

  @override
  String get settingsVersion => 'Version';

  @override
  String get settingsComponentCatalogue => 'Component catalogue';

  @override
  String get settingsComponentCatalogueDescription =>
      'Development-only design-system gallery';

  @override
  String get notFoundTitle => 'Screen not found';

  @override
  String get notFoundMessage =>
      'We couldn\'t open this page. It may have moved or never existed.';

  @override
  String get invalidRouteTitle => 'Invalid link';

  @override
  String get invalidRouteMessage =>
      'This link points to something that doesn\'t exist.';

  @override
  String get notFoundGoHome => 'Go to Home';

  @override
  String homeUpdated(String time) {
    return 'Updated $time';
  }

  @override
  String get offlineStaleNotice =>
      'This data may be out of date — showing the last saved version.';

  @override
  String get refreshFailedNotice => 'Couldn\'t refresh — showing saved data.';

  @override
  String get retry => 'Try again';

  @override
  String get homeErrorTitle => 'Can\'t load Home';

  @override
  String get homeMoreComingTitle => 'More coming soon';

  @override
  String get homeMoreComingMessage =>
      'Championship standings and results arrive in a later update.';

  @override
  String get homeNoEventsTitle => 'No races scheduled yet';

  @override
  String get homeNoEventsMessage =>
      'The calendar for this season has not been published. Home will fill in as soon as it is.';

  @override
  String get errorOffline => 'You appear to be offline.';

  @override
  String get errorTimeout => 'The connection timed out.';

  @override
  String get errorServer => 'The service is temporarily unavailable.';

  @override
  String get errorNotFound => 'That data isn\'t available.';

  @override
  String get errorUnsupported => 'Please update GridView to continue.';

  @override
  String get errorGeneric => 'Something went wrong.';

  @override
  String get grandPrixNotFoundTitle => 'Grand Prix not found';

  @override
  String get grandPrixNotFoundMessage =>
      'We couldn\'t find this Grand Prix on the calendar.';

  @override
  String get grandPrixErrorTitle => 'Can\'t load this Grand Prix';

  @override
  String get grandPrixResultsAvailable => 'Results are available.';

  @override
  String get eventStateScheduled => 'Scheduled';

  @override
  String get eventStateLive => 'Live';

  @override
  String get eventStatePostponed => 'Postponed';

  @override
  String get eventStateCancelled => 'Cancelled';

  @override
  String get sessionStateScheduled => 'Scheduled';

  @override
  String get sessionStateCompleted => 'Completed';

  @override
  String get mockDataBanner => 'Sample data — not live results';

  @override
  String lastUpdatedLabel(String time) {
    return 'Updated $time';
  }

  @override
  String get eventStateUnknown => 'Status unknown';

  @override
  String get sessionStateUnknown => 'Status unknown';

  @override
  String get sessionNameUnknown => 'Session';

  @override
  String get weekendFormatStandard => 'Standard weekend';

  @override
  String get weekendFormatSprint => 'Sprint weekend';

  @override
  String get weekendFormatUnknown => 'Format unknown';

  @override
  String get calendarNextLabel => 'Next';

  @override
  String get calendarEmptyTitle => 'No races scheduled yet';

  @override
  String get calendarEmptyMessage =>
      'The calendar for this season has not been published. It will appear here as soon as it is.';

  @override
  String get calendarErrorTitle => 'Can\'t load the calendar';

  @override
  String get calendarSeasonUnavailableTitle => 'Season not available yet';

  @override
  String get calendarSeasonUnavailableMessage =>
      'GridView could not determine the current season. Check your connection and try again.';

  @override
  String get calendarRefreshAction => 'Refresh calendar';

  @override
  String calendarEventSemantics(String name, String round, String status) {
    return '$name, round $round, $status';
  }

  @override
  String get grandPrixNoSessionsTitle => 'Schedule not available';

  @override
  String get grandPrixNoSessionsMessage =>
      'Session times for this weekend have not been published yet.';

  @override
  String get grandPrixSprintResults => 'Sprint results';

  @override
  String get grandPrixRaceResults => 'Race results';

  @override
  String get grandPrixResultsUnavailableTitle => 'Results not available yet';

  @override
  String get grandPrixResultsErrorTitle => 'Can\'t load results';

  @override
  String grandPrixOpenDriver(String name) {
    return 'Open driver $name';
  }

  @override
  String grandPrixOpenConstructor(String name) {
    return 'Open team $name';
  }

  @override
  String get fieldCircuit => 'Circuit';

  @override
  String get fieldLocation => 'Location';

  @override
  String get fieldDates => 'Dates';

  @override
  String get fieldEventTimeZone => 'Event time zone';

  @override
  String get fieldDeviceTimeZone => 'Your time zone';

  @override
  String get driverNameUnavailable => 'Driver name unavailable';

  @override
  String get constructorNameUnavailable => 'Team name unavailable';

  @override
  String get grandPrixOpenConstructorUnnamed => 'Open team';

  @override
  String get resultsFastestLap => 'Fastest lap';

  @override
  String resultLapsBehind(int laps) {
    String _temp0 = intl.Intl.pluralLogic(
      laps,
      locale: localeName,
      other: '+$laps laps',
      one: '+1 lap',
    );
    return '$_temp0';
  }

  @override
  String get resultStatusProvisional => 'Provisional';

  @override
  String get resultStatusFinal => 'Final';

  @override
  String get resultStatusUnavailable => 'Not available';

  @override
  String get resultStatusUnknown => 'Status unknown';

  @override
  String get finishStatusFinished => 'Finished';

  @override
  String get finishStatusLapped => 'Lapped';

  @override
  String get finishStatusDnf => 'DNF';

  @override
  String get finishStatusDns => 'DNS';

  @override
  String get finishStatusDsq => 'DSQ';

  @override
  String get finishStatusDnq => 'DNQ';

  @override
  String get finishStatusUnknown => 'Status unknown';

  @override
  String get exploreCategorySelector => 'Explore category';

  @override
  String get exploreDriversEmptyTitle => 'No drivers yet';

  @override
  String get exploreDriversEmptyMessage =>
      'This season has no drivers listed yet. They will appear here as soon as they do.';

  @override
  String get exploreTeamsEmptyTitle => 'No teams yet';

  @override
  String get exploreTeamsEmptyMessage =>
      'This season has no teams listed yet. They will appear here as soon as they do.';

  @override
  String get exploreCircuitsEmptyTitle => 'No circuits yet';

  @override
  String get exploreCircuitsEmptyMessage =>
      'This season has no circuits listed yet. They will appear here as soon as they do.';

  @override
  String get exploreDriversErrorTitle => 'Can\'t load the drivers';

  @override
  String get exploreTeamsErrorTitle => 'Can\'t load the teams';

  @override
  String get exploreCircuitsErrorTitle => 'Can\'t load the circuits';

  @override
  String get exploreSeasonUnavailableTitle => 'Season unavailable';

  @override
  String get exploreSeasonUnavailableMessage =>
      'GridView could not determine the current season. Check your connection and try again.';

  @override
  String get exploreUpdateFailed => 'Update failed';

  @override
  String get exploreCachedNotice => 'Showing saved data';

  @override
  String exploreOpenDriver(String name) {
    return 'Open driver $name';
  }

  @override
  String exploreOpenTeam(String name) {
    return 'Open team $name';
  }

  @override
  String exploreOpenCircuit(String name) {
    return 'Open circuit $name';
  }

  @override
  String get detailNotFoundTitle => 'Not available';

  @override
  String get detailNotFoundMessage =>
      'This profile is not available. It may have been removed, or the link may be out of date.';

  @override
  String get detailSeasonUnavailableTitle => 'Season unavailable';

  @override
  String get detailSeasonUnavailableMessage =>
      'GridView could not determine which season to show. Check your connection and try again.';

  @override
  String get detailUpdateFailed => 'Update failed';

  @override
  String get detailCachedNotice => 'Details may be outdated';

  @override
  String get detailPartialNotice => 'Some profile information is unavailable';

  @override
  String get detailLoadErrorTitle => 'Can\'t load this profile';

  @override
  String get driverAbout => 'About';

  @override
  String get driverProfileSection => 'Profile';

  @override
  String get driverParticipationSection => 'Season participation';

  @override
  String get driverChampionshipSection => 'Championship';

  @override
  String get driverRaceNumber => 'Race number';

  @override
  String get driverPermanentNumber => 'Permanent number';

  @override
  String get driverRoleRace => 'Race driver';

  @override
  String get driverRoleReserve => 'Reserve driver';

  @override
  String get driverRoleTest => 'Test driver';

  @override
  String get driverRoleUnknown => 'Role unavailable';

  @override
  String driverOpenTeam(String name) {
    return 'Open team $name';
  }

  @override
  String get driverViewStandings => 'View drivers\' standings';

  @override
  String get driverTeamUnavailable => 'Team unavailable';

  @override
  String get driverPortraitPlaceholder => 'Driver portrait unavailable';

  @override
  String get teamLineupSection => 'Drivers';

  @override
  String get teamFactsSection => 'Team details';

  @override
  String get teamChampionshipSection => 'Championship';

  @override
  String get teamAbout => 'About';

  @override
  String get fieldTeamPrincipal => 'Team principal';

  @override
  String get fieldChassis => 'Chassis';

  @override
  String teamOpenDriver(String name) {
    return 'Open driver $name';
  }

  @override
  String get teamViewStandings => 'View constructors\' standings';

  @override
  String get teamLineupUnavailable => 'Line-up unavailable';

  @override
  String get teamLogoPlaceholder => 'Team logo unavailable';

  @override
  String get circuitFactsSection => 'Circuit facts';

  @override
  String get circuitLapRecordSection => 'Lap record';

  @override
  String get fieldCorners => 'Corners';

  @override
  String get fieldDirection => 'Direction';

  @override
  String get fieldFirstGrandPrix => 'First Grand Prix';

  @override
  String get fieldLapRecordTime => 'Time';

  @override
  String get fieldLapRecordDriver => 'Driver';

  @override
  String get fieldLapRecordYear => 'Year';

  @override
  String get circuitDirectionClockwise => 'Clockwise';

  @override
  String get circuitDirectionCounterClockwise => 'Counter-clockwise';

  @override
  String get circuitDirectionUnknown => 'Direction unavailable';

  @override
  String get circuitLapRecordDriverUnavailable => 'Driver unavailable';

  @override
  String get circuitNoRelatedGrandPrix => 'No Grand Prix this season';

  @override
  String circuitOpenGrandPrix(String name) {
    return 'Open $name';
  }

  @override
  String get circuitLayoutPlaceholder => 'Circuit layout unavailable';

  @override
  String lengthKilometers(String value) {
    return '$value km';
  }

  @override
  String get fieldWins => 'Wins';

  @override
  String get fieldPodiums => 'Podiums';

  @override
  String get fieldNationality => 'Nationality';

  @override
  String get fieldDateOfBirth => 'Date of birth';

  @override
  String get fieldPlaceOfBirth => 'Place of birth';

  @override
  String get fieldTeam => 'Team';

  @override
  String get participationFullSeason => 'Full season';

  @override
  String participationFromRound(int round) {
    return 'From round $round';
  }

  @override
  String participationUntilRound(int round) {
    return 'Until round $round';
  }

  @override
  String participationRoundRange(int start, int end) {
    return 'Rounds $start–$end';
  }

  @override
  String get positionUnranked => 'Unranked';

  @override
  String get fieldRole => 'Role';

  @override
  String get fieldParticipation => 'Participation';
}
