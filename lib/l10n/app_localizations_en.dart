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
}
