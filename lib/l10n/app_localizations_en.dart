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
  String get settingsSectionDeveloper => 'Developer';

  @override
  String get settingsLanguage => 'Language';

  @override
  String get settingsTheme => 'Theme';

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
  String circuitLayoutImage(String circuit) {
    return 'Track layout of $circuit';
  }

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

  @override
  String get grandPrixNameUnavailable => 'Grand Prix name unavailable';

  @override
  String get homeRefreshAction => 'Refresh Home';

  @override
  String get homeCurrentGrandPrix => 'Current Grand Prix';

  @override
  String get homeLatestGrandPrix => 'Latest Grand Prix';

  @override
  String get homeRaceWeekend => 'Race weekend';

  @override
  String get homeLiveNow => 'Live now';

  @override
  String get homeStartingSoon => 'Starting soon';

  @override
  String homeStartsInMinutes(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Starts in $count minutes',
      one: 'Starts in 1 minute',
    );
    return '$_temp0';
  }

  @override
  String homeStartsInHours(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Starts in $count hours',
      one: 'Starts in 1 hour',
    );
    return '$_temp0';
  }

  @override
  String homeStartsInDays(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Starts in $count days',
      one: 'Starts in 1 day',
    );
    return '$_temp0';
  }

  @override
  String get homeCurrentSession => 'Current session';

  @override
  String get homeNextSession => 'Next session';

  @override
  String get homeSessionUnavailable => 'Session times not available';

  @override
  String get homeSeasonUnavailableTitle => 'Season not available';

  @override
  String get homeSeasonUnavailableMessage =>
      'GridView could not determine the current season. Check your connection and try again.';

  @override
  String get homeCalendarUnavailableTitle => 'Calendar not available';

  @override
  String get homeCalendarUnavailableMessage =>
      'This season has no published events yet. Home will fill in as soon as it does.';

  @override
  String get homeDriversLeaderTitle => 'Drivers\' Championship leader';

  @override
  String get homeTeamsLeaderTitle => 'Teams\' Championship leader';

  @override
  String get homeTiedLeaders => 'Tied leaders';

  @override
  String get homeLeaderUnavailable => 'Leader unavailable';

  @override
  String get homeNoLeaderYet => 'No leader yet';

  @override
  String homePointsValue(String points) {
    return '$points pts';
  }

  @override
  String get homeWinnerLabel => 'Winner';

  @override
  String get homeWinnerUnavailable => 'Winner unavailable';

  @override
  String get homeResultUnavailable => 'Result unavailable';

  @override
  String get homeNoUpcomingEvents => 'No upcoming events';

  @override
  String get homeUpcomingUnavailable => 'Upcoming events unavailable';

  @override
  String get homeViewCalendar => 'View Calendar';

  @override
  String get homeQuickLinks => 'Explore';

  @override
  String get homeOpenDrivers => 'Open Drivers';

  @override
  String get homeOpenTeams => 'Open Teams';

  @override
  String get homeOpenCircuits => 'Open Circuits';

  @override
  String homeOpenDriver(String name) {
    return 'Open Driver $name';
  }

  @override
  String homeOpenTeam(String name) {
    return 'Open Team $name';
  }

  @override
  String get homeSomeInformationUnavailable =>
      'Some information is unavailable';

  @override
  String get homeSomeInformationOutdated => 'Some information may be outdated';

  @override
  String get homeCachedNotice => 'Showing cached data';

  @override
  String get homeUpdateFailed => 'Update failed';

  @override
  String get settingsSectionPreferences => 'Preferences';

  @override
  String get settingsSectionDataApp => 'Data and application';

  @override
  String get settingsSectionPrivacySupport => 'Privacy and support';

  @override
  String get settingsTimeDisplay => 'Time display';

  @override
  String get settingsDataAndUpdates => 'Data and updates';

  @override
  String get settingsFeedback => 'Send feedback';

  @override
  String get settingsLanguageSystem => 'System default';

  @override
  String get settingsLanguageSystemDescription =>
      'Use the device language when GridView supports it, otherwise English.';

  @override
  String get settingsLanguageEnglish => 'English';

  @override
  String get settingsLanguageSpanish => 'Español';

  @override
  String get settingsThemeSystem => 'System';

  @override
  String get settingsThemeSystemDescription =>
      'Follow the device light or dark setting.';

  @override
  String get settingsThemeDark => 'Dark';

  @override
  String get settingsThemeLight => 'Light';

  @override
  String get settingsTimeDevice => 'Device time';

  @override
  String get settingsTimeDeviceDescription =>
      'Show session times in your device\'s time zone.';

  @override
  String get settingsTimeEvent => 'Event time';

  @override
  String get settingsTimeEventDescription =>
      'Show session times in the circuit\'s local time zone.';

  @override
  String get settingsTimeBoth => 'Both';

  @override
  String get settingsTimeBothDescription =>
      'Show the event time and your device time together.';

  @override
  String get settingsDataEnvironment => 'Environment';

  @override
  String get settingsDataSource => 'Data source';

  @override
  String get settingsDataSourceRemote => 'GridView service';

  @override
  String get settingsDataSourceSample => 'Sample data';

  @override
  String get settingsDataSourceUnavailable => 'Not configured';

  @override
  String get settingsDataApiVersion => 'API version';

  @override
  String get settingsDataCurrentSeason => 'Current season';

  @override
  String get settingsDataCurrentSeasonUnresolved => 'Not available yet';

  @override
  String get settingsDataOfflineExplanation =>
      'GridView keeps the season on your device, so it opens and works without a connection. New information is downloaded when the app starts and when you refresh.';

  @override
  String get settingsAboutApplication => 'Application';

  @override
  String get settingsAboutBuild => 'Build';

  @override
  String get settingsAboutUnofficial =>
      'GridView is an independent application. It is not associated with, endorsed by or affiliated with Formula 1, the FIA or any team.';

  @override
  String get settingsPrivacyAndLegal => 'Privacy and legal';

  @override
  String get settingsPrivacyPolicyOpen => 'Read the privacy policy';

  @override
  String get settingsPrivacyPolicyUnavailable =>
      'No privacy policy is configured in this build.';

  @override
  String get settingsPrivacyCrashReporting => 'Crash reporting';

  @override
  String get settingsPrivacyPerformance => 'Performance monitoring';

  @override
  String get settingsPrivacyAdvertising => 'Advertising';

  @override
  String get settingsPrivacyConfigured => 'Configured';

  @override
  String get settingsPrivacySessionReporting => 'App reporting this session';

  @override
  String get settingsPrivacyStarting => 'Starting';

  @override
  String get settingsPrivacySessionActive => 'Active';

  @override
  String get settingsPrivacySessionUnconfirmed => 'Not confirmed';

  @override
  String get settingsPrivacyDiagnosticsNote =>
      'Diagnostic components are included in every version of the app. In production builds, crash and performance diagnostics are configured and can start collecting as soon as the app opens. The line above describes only whether this app\'s own reporting could be confirmed during this session.';

  @override
  String get settingsPrivacyDisabled => 'Disabled';

  @override
  String get settingsAcknowledgementsEmpty => 'No attributions are stored yet.';

  @override
  String get settingsAcknowledgementsData => 'Data';

  @override
  String get settingsAcknowledgementsMedia => 'Images';

  @override
  String get settingsFeedbackUnavailable => 'No contact address is configured.';

  @override
  String get settingsOpenFailed => 'That link could not be opened.';

  @override
  String get settingsSaveFailed =>
      'That setting could not be saved. Please try again.';

  @override
  String get settingsSelected => 'Selected';

  @override
  String get mediaCategoryPortrait => 'Portrait';

  @override
  String get mediaCategoryLogo => 'Logo';

  @override
  String get mediaCategoryCar => 'Car';

  @override
  String get mediaCategoryCircuitLayout => 'Circuit layout';

  @override
  String get mediaCategoryHero => 'Feature image';

  @override
  String get mediaCategoryThumbnail => 'Thumbnail';

  @override
  String get mediaCategoryOther => 'Image';
}
