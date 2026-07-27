import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_es.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('es'),
  ];

  /// Application name shown in the app bar and task switcher.
  ///
  /// In en, this message translates to:
  /// **'GridView'**
  String get appTitle;

  /// Bottom navigation label for the Home branch.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get navHome;

  /// Bottom navigation label for the Calendar branch.
  ///
  /// In en, this message translates to:
  /// **'Calendar'**
  String get navCalendar;

  /// Bottom navigation label for the Standings branch.
  ///
  /// In en, this message translates to:
  /// **'Standings'**
  String get navStandings;

  /// Bottom navigation label for the Explore branch.
  ///
  /// In en, this message translates to:
  /// **'Explore'**
  String get navExplore;

  /// Season context header, e.g. '2026 season'.
  ///
  /// In en, this message translates to:
  /// **'{season} season'**
  String seasonLabel(String season);

  /// Grand Prix round label, e.g. 'Round 3'.
  ///
  /// In en, this message translates to:
  /// **'Round {round}'**
  String roundLabel(String round);

  /// Section action that opens the full list.
  ///
  /// In en, this message translates to:
  /// **'See all'**
  String get seeAll;

  /// Accessibility label for the settings action in the app bar.
  ///
  /// In en, this message translates to:
  /// **'Open settings'**
  String get settingsOpen;

  /// Notice that the screen shows placeholder content.
  ///
  /// In en, this message translates to:
  /// **'Preview layout. Live data arrives in a later update.'**
  String get previewDataNotice;

  /// Status for a finished Grand Prix.
  ///
  /// In en, this message translates to:
  /// **'Completed'**
  String get eventStateCompleted;

  /// Status for the current Grand Prix.
  ///
  /// In en, this message translates to:
  /// **'This weekend'**
  String get eventStateCurrent;

  /// Status for a future Grand Prix.
  ///
  /// In en, this message translates to:
  /// **'Upcoming'**
  String get eventStateUpcoming;

  /// Home hero section title.
  ///
  /// In en, this message translates to:
  /// **'Next Grand Prix'**
  String get homeNextGrandPrix;

  /// Home sessions/status block title.
  ///
  /// In en, this message translates to:
  /// **'Weekend sessions'**
  String get homeSessions;

  /// Home championship-leaders section title.
  ///
  /// In en, this message translates to:
  /// **'Championship leaders'**
  String get homeLeaders;

  /// Label for the leading driver summary.
  ///
  /// In en, this message translates to:
  /// **'Drivers\' leader'**
  String get homeLeaderDrivers;

  /// Label for the leading constructor summary.
  ///
  /// In en, this message translates to:
  /// **'Constructors\' leader'**
  String get homeLeaderConstructors;

  /// Home latest-result section title.
  ///
  /// In en, this message translates to:
  /// **'Latest result'**
  String get homeLatestResult;

  /// Home upcoming-events section title.
  ///
  /// In en, this message translates to:
  /// **'Upcoming events'**
  String get homeUpcoming;

  /// Action opening the featured Grand Prix.
  ///
  /// In en, this message translates to:
  /// **'View Grand Prix'**
  String get homeOpenGrandPrix;

  /// Calendar screen title.
  ///
  /// In en, this message translates to:
  /// **'Calendar'**
  String get calendarTitle;

  /// Grand Prix detail screen title.
  ///
  /// In en, this message translates to:
  /// **'Grand Prix'**
  String get grandPrixTitle;

  /// Grand Prix detail circuit section title.
  ///
  /// In en, this message translates to:
  /// **'Circuit'**
  String get grandPrixCircuit;

  /// Grand Prix detail sessions section title.
  ///
  /// In en, this message translates to:
  /// **'Sessions'**
  String get grandPrixSessions;

  /// Grand Prix detail results section title.
  ///
  /// In en, this message translates to:
  /// **'Results'**
  String get grandPrixResults;

  /// Placeholder shown when results are not yet available.
  ///
  /// In en, this message translates to:
  /// **'Results will appear once the session is complete.'**
  String get grandPrixResultsPending;

  /// Navigation to the circuit detail.
  ///
  /// In en, this message translates to:
  /// **'View circuit'**
  String get grandPrixViewCircuit;

  /// Standings screen title.
  ///
  /// In en, this message translates to:
  /// **'Standings'**
  String get standingsTitle;

  /// Drivers standings segment label.
  ///
  /// In en, this message translates to:
  /// **'Drivers'**
  String get standingsDrivers;

  /// Constructors standings segment label.
  ///
  /// In en, this message translates to:
  /// **'Constructors'**
  String get standingsConstructors;

  /// Accessibility label for the drivers/constructors championship selector.
  ///
  /// In en, this message translates to:
  /// **'Championship'**
  String get standingsChampionshipSelector;

  /// Accessibility label for the Standings refresh action.
  ///
  /// In en, this message translates to:
  /// **'Refresh standings'**
  String get standingsRefreshAction;

  /// Compact indication that the selected standings table is being refreshed.
  ///
  /// In en, this message translates to:
  /// **'Refreshing…'**
  String get standingsRefreshingLabel;

  /// Title for a valid but empty drivers' championship table.
  ///
  /// In en, this message translates to:
  /// **'No drivers\' standings yet'**
  String get standingsDriversEmptyTitle;

  /// Message for a valid but empty drivers' championship table.
  ///
  /// In en, this message translates to:
  /// **'The drivers\' championship has no classified entries for this season yet. They will appear here as soon as they do.'**
  String get standingsDriversEmptyMessage;

  /// Title for a valid but empty constructors' championship table.
  ///
  /// In en, this message translates to:
  /// **'No constructors\' standings yet'**
  String get standingsConstructorsEmptyTitle;

  /// Message for a valid but empty constructors' championship table.
  ///
  /// In en, this message translates to:
  /// **'The constructors\' championship has no classified entries for this season yet. They will appear here as soon as they do.'**
  String get standingsConstructorsEmptyMessage;

  /// Title for the drivers' standings first-load error state.
  ///
  /// In en, this message translates to:
  /// **'Can\'t load the drivers\' standings'**
  String get standingsDriversErrorTitle;

  /// Title for the constructors' standings first-load error state.
  ///
  /// In en, this message translates to:
  /// **'Can\'t load the constructors\' standings'**
  String get standingsConstructorsErrorTitle;

  /// Title shown on Standings when no current season could be resolved locally.
  ///
  /// In en, this message translates to:
  /// **'Season unavailable'**
  String get standingsSeasonUnavailableTitle;

  /// Message shown on Standings when no current season could be resolved locally.
  ///
  /// In en, this message translates to:
  /// **'GridView could not determine the current season. Check your connection and try again.'**
  String get standingsSeasonUnavailableMessage;

  /// Displayed instead of a championship position when the standing is unranked. Never a zero.
  ///
  /// In en, this message translates to:
  /// **'—'**
  String get standingsUnrankedPosition;

  /// Accessible meaning of an unranked championship position.
  ///
  /// In en, this message translates to:
  /// **'Position unavailable'**
  String get standingsUnrankedSemantics;

  /// Accessible reading of a championship position.
  ///
  /// In en, this message translates to:
  /// **'Position {position}'**
  String standingsPositionSemantics(String position);

  /// Accessible reading of a championship points total, already locale-formatted.
  ///
  /// In en, this message translates to:
  /// **'{points} points'**
  String standingsPointsSemantics(String points);

  /// Number of wins shown on a standings row. A confirmed zero is shown; an unavailable value is omitted.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 win} other{{count} wins}}'**
  String standingsWinsLabel(int count);

  /// Accessible equivalent of the leader emphasis, for a confirmed position 1.
  ///
  /// In en, this message translates to:
  /// **'Championship leader'**
  String get standingsLeaderSemantics;

  /// Accessible equivalent of the leader emphasis when several rows share a confirmed position 1.
  ///
  /// In en, this message translates to:
  /// **'Tied for the championship lead'**
  String get standingsTiedLeaderSemantics;

  /// Marks an individual standings row the contract reports as provisional.
  ///
  /// In en, this message translates to:
  /// **'Provisional'**
  String get standingsProvisionalBadge;

  /// Section-level notice shown when every row that states it is provisional.
  ///
  /// In en, this message translates to:
  /// **'These standings are provisional and may still change.'**
  String get standingsProvisionalNotice;

  /// Fallback shown when a competitor's name is not stored locally. Never replaces identity with an invented name.
  ///
  /// In en, this message translates to:
  /// **'Name unavailable'**
  String get standingsNameUnavailable;

  /// Accessible label for an optional statistic the contract did not supply.
  ///
  /// In en, this message translates to:
  /// **'Not available'**
  String get standingsValueUnavailable;

  /// Explore screen title.
  ///
  /// In en, this message translates to:
  /// **'Explore'**
  String get exploreTitle;

  /// Explore drivers entry / list title.
  ///
  /// In en, this message translates to:
  /// **'Drivers'**
  String get exploreDrivers;

  /// Explore teams entry / list title.
  ///
  /// In en, this message translates to:
  /// **'Teams'**
  String get exploreTeams;

  /// Explore circuits entry / list title.
  ///
  /// In en, this message translates to:
  /// **'Circuits'**
  String get exploreCircuits;

  /// Explore drivers entry-card description.
  ///
  /// In en, this message translates to:
  /// **'Every driver on the current grid'**
  String get exploreDriversDescription;

  /// Explore teams entry-card description.
  ///
  /// In en, this message translates to:
  /// **'Every constructor this season'**
  String get exploreTeamsDescription;

  /// Explore circuits entry-card description.
  ///
  /// In en, this message translates to:
  /// **'Every circuit on the calendar'**
  String get exploreCircuitsDescription;

  /// Driver detail screen title.
  ///
  /// In en, this message translates to:
  /// **'Driver'**
  String get driverTitle;

  /// Driver detail current-team section.
  ///
  /// In en, this message translates to:
  /// **'Current team'**
  String get driverCurrentTeam;

  /// Driver detail season-standing section.
  ///
  /// In en, this message translates to:
  /// **'Season standing'**
  String get driverSeasonStanding;

  /// Driver detail statistics section.
  ///
  /// In en, this message translates to:
  /// **'Statistics'**
  String get driverStatistics;

  /// Constructor (team) detail screen title.
  ///
  /// In en, this message translates to:
  /// **'Team'**
  String get constructorTitle;

  /// Constructor detail drivers section.
  ///
  /// In en, this message translates to:
  /// **'Current drivers'**
  String get constructorDrivers;

  /// Constructor detail standing section.
  ///
  /// In en, this message translates to:
  /// **'Constructor standing'**
  String get constructorStanding;

  /// Constructor detail information section.
  ///
  /// In en, this message translates to:
  /// **'Team information'**
  String get constructorInformation;

  /// Circuit detail screen title.
  ///
  /// In en, this message translates to:
  /// **'Circuit'**
  String get circuitTitle;

  /// Circuit detail information section.
  ///
  /// In en, this message translates to:
  /// **'Circuit information'**
  String get circuitInformation;

  /// Circuit detail layout section.
  ///
  /// In en, this message translates to:
  /// **'Layout'**
  String get circuitLayout;

  /// Circuit detail related-event section.
  ///
  /// In en, this message translates to:
  /// **'This season\'s Grand Prix'**
  String get circuitRelatedGrandPrix;

  /// Label for the stable technical id shown on detail screens.
  ///
  /// In en, this message translates to:
  /// **'Identifier'**
  String get fieldIdentifier;

  /// Driver car-number field label.
  ///
  /// In en, this message translates to:
  /// **'Number'**
  String get fieldNumber;

  /// Points field label.
  ///
  /// In en, this message translates to:
  /// **'Points'**
  String get fieldPoints;

  /// Championship-position field label.
  ///
  /// In en, this message translates to:
  /// **'Position'**
  String get fieldPosition;

  /// Constructor power-unit field label.
  ///
  /// In en, this message translates to:
  /// **'Power unit'**
  String get fieldPowerUnit;

  /// Constructor base field label.
  ///
  /// In en, this message translates to:
  /// **'Base'**
  String get fieldBase;

  /// Circuit country field label.
  ///
  /// In en, this message translates to:
  /// **'Country'**
  String get fieldCountry;

  /// Circuit length field label.
  ///
  /// In en, this message translates to:
  /// **'Length'**
  String get fieldLength;

  /// Circuit laps field label.
  ///
  /// In en, this message translates to:
  /// **'Laps'**
  String get fieldLaps;

  /// Fallback display name for an entity that is not in the placeholder catalogue.
  ///
  /// In en, this message translates to:
  /// **'Profile placeholder'**
  String get genericEntityName;

  /// Settings screen title.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settingsTitle;

  /// Settings general section header.
  ///
  /// In en, this message translates to:
  /// **'General'**
  String get settingsSectionGeneral;

  /// Settings about section header.
  ///
  /// In en, this message translates to:
  /// **'About'**
  String get settingsSectionAbout;

  /// Settings developer section header (non-production only).
  ///
  /// In en, this message translates to:
  /// **'Developer'**
  String get settingsSectionDeveloper;

  /// Language setting label.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get settingsLanguage;

  /// Current language value.
  ///
  /// In en, this message translates to:
  /// **'System default'**
  String get settingsLanguageValue;

  /// Theme setting label.
  ///
  /// In en, this message translates to:
  /// **'Theme'**
  String get settingsTheme;

  /// Current theme value (dark only in v1).
  ///
  /// In en, this message translates to:
  /// **'Dark'**
  String get settingsThemeValue;

  /// Explains the dark-only theme.
  ///
  /// In en, this message translates to:
  /// **'Only a dark theme is available in this version.'**
  String get settingsThemeNote;

  /// Privacy setting label.
  ///
  /// In en, this message translates to:
  /// **'Privacy'**
  String get settingsPrivacy;

  /// Acknowledgements setting label.
  ///
  /// In en, this message translates to:
  /// **'Acknowledgements'**
  String get settingsAcknowledgements;

  /// App information setting label.
  ///
  /// In en, this message translates to:
  /// **'App information'**
  String get settingsAppInformation;

  /// Version field label.
  ///
  /// In en, this message translates to:
  /// **'Version'**
  String get settingsVersion;

  /// Developer entry to the component catalogue.
  ///
  /// In en, this message translates to:
  /// **'Component catalogue'**
  String get settingsComponentCatalogue;

  /// Component catalogue entry description.
  ///
  /// In en, this message translates to:
  /// **'Development-only design-system gallery'**
  String get settingsComponentCatalogueDescription;

  /// Not-found screen title.
  ///
  /// In en, this message translates to:
  /// **'Screen not found'**
  String get notFoundTitle;

  /// Not-found screen message.
  ///
  /// In en, this message translates to:
  /// **'We couldn\'t open this page. It may have moved or never existed.'**
  String get notFoundMessage;

  /// Invalid-parameter screen title.
  ///
  /// In en, this message translates to:
  /// **'Invalid link'**
  String get invalidRouteTitle;

  /// Invalid-parameter screen message.
  ///
  /// In en, this message translates to:
  /// **'This link points to something that doesn\'t exist.'**
  String get invalidRouteMessage;

  /// Recovery action returning to Home.
  ///
  /// In en, this message translates to:
  /// **'Go to Home'**
  String get notFoundGoHome;

  /// Freshness caption showing when content was last synced.
  ///
  /// In en, this message translates to:
  /// **'Updated {time}'**
  String homeUpdated(String time);

  /// Notice shown when cached content is stale.
  ///
  /// In en, this message translates to:
  /// **'This data may be out of date — showing the last saved version.'**
  String get offlineStaleNotice;

  /// Notice shown when a refresh failed but cached content is visible.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t refresh — showing saved data.'**
  String get refreshFailedNotice;

  /// Retry action for a recoverable error.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get retry;

  /// Title for the Home first-load error state.
  ///
  /// In en, this message translates to:
  /// **'Can\'t load Home'**
  String get homeErrorTitle;

  /// Title for the non-authoritative placeholder section on Home.
  ///
  /// In en, this message translates to:
  /// **'More coming soon'**
  String get homeMoreComingTitle;

  /// Explains the non-authoritative placeholder section on Home.
  ///
  /// In en, this message translates to:
  /// **'Championship standings and results arrive in a later update.'**
  String get homeMoreComingMessage;

  /// Title shown on Home when the current season has no events yet.
  ///
  /// In en, this message translates to:
  /// **'No races scheduled yet'**
  String get homeNoEventsTitle;

  /// Explains the empty Home state for a season with no events.
  ///
  /// In en, this message translates to:
  /// **'The calendar for this season has not been published. Home will fill in as soon as it is.'**
  String get homeNoEventsMessage;

  /// User-facing message for a network-unavailable failure.
  ///
  /// In en, this message translates to:
  /// **'You appear to be offline.'**
  String get errorOffline;

  /// User-facing message for a timeout failure.
  ///
  /// In en, this message translates to:
  /// **'The connection timed out.'**
  String get errorTimeout;

  /// User-facing message for a server-unavailable failure.
  ///
  /// In en, this message translates to:
  /// **'The service is temporarily unavailable.'**
  String get errorServer;

  /// User-facing message for a not-found failure.
  ///
  /// In en, this message translates to:
  /// **'That data isn\'t available.'**
  String get errorNotFound;

  /// User-facing message for an unsupported API/schema version.
  ///
  /// In en, this message translates to:
  /// **'Please update GridView to continue.'**
  String get errorUnsupported;

  /// User-facing message for an unknown or invalid failure.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong.'**
  String get errorGeneric;

  /// Title for the Grand Prix not-found state.
  ///
  /// In en, this message translates to:
  /// **'Grand Prix not found'**
  String get grandPrixNotFoundTitle;

  /// Message for the Grand Prix not-found state.
  ///
  /// In en, this message translates to:
  /// **'We couldn\'t find this Grand Prix on the calendar.'**
  String get grandPrixNotFoundMessage;

  /// Title for the Grand Prix detail error state.
  ///
  /// In en, this message translates to:
  /// **'Can\'t load this Grand Prix'**
  String get grandPrixErrorTitle;

  /// Shown when a Grand Prix has classified results.
  ///
  /// In en, this message translates to:
  /// **'Results are available.'**
  String get grandPrixResultsAvailable;

  /// Status for a scheduled Grand Prix.
  ///
  /// In en, this message translates to:
  /// **'Scheduled'**
  String get eventStateScheduled;

  /// Status for an in-progress Grand Prix or session.
  ///
  /// In en, this message translates to:
  /// **'Live'**
  String get eventStateLive;

  /// Status for a postponed Grand Prix.
  ///
  /// In en, this message translates to:
  /// **'Postponed'**
  String get eventStatePostponed;

  /// Status for a cancelled Grand Prix or session.
  ///
  /// In en, this message translates to:
  /// **'Cancelled'**
  String get eventStateCancelled;

  /// Status for a scheduled session.
  ///
  /// In en, this message translates to:
  /// **'Scheduled'**
  String get sessionStateScheduled;

  /// Status for a completed session.
  ///
  /// In en, this message translates to:
  /// **'Completed'**
  String get sessionStateCompleted;

  /// Banner shown in dev/staging builds that use fixture data.
  ///
  /// In en, this message translates to:
  /// **'Sample data — not live results'**
  String get mockDataBanner;

  /// Caption showing when a resource was last synchronised successfully.
  ///
  /// In en, this message translates to:
  /// **'Updated {time}'**
  String lastUpdatedLabel(String time);

  /// Fallback label for an event status this app version does not recognise.
  ///
  /// In en, this message translates to:
  /// **'Status unknown'**
  String get eventStateUnknown;

  /// Fallback label for a session status this app version does not recognise.
  ///
  /// In en, this message translates to:
  /// **'Status unknown'**
  String get sessionStateUnknown;

  /// Fallback name for a session whose type this app version does not recognise.
  ///
  /// In en, this message translates to:
  /// **'Session'**
  String get sessionNameUnknown;

  /// Label for a standard (non-sprint) Grand Prix weekend.
  ///
  /// In en, this message translates to:
  /// **'Standard weekend'**
  String get weekendFormatStandard;

  /// Label for a sprint Grand Prix weekend.
  ///
  /// In en, this message translates to:
  /// **'Sprint weekend'**
  String get weekendFormatSprint;

  /// Fallback label for a weekend format this app version does not recognise.
  ///
  /// In en, this message translates to:
  /// **'Format unknown'**
  String get weekendFormatUnknown;

  /// Marks the next relevant event in the calendar list.
  ///
  /// In en, this message translates to:
  /// **'Next'**
  String get calendarNextLabel;

  /// Title for a valid but empty season calendar.
  ///
  /// In en, this message translates to:
  /// **'No races scheduled yet'**
  String get calendarEmptyTitle;

  /// Message for a valid but empty season calendar.
  ///
  /// In en, this message translates to:
  /// **'The calendar for this season has not been published. It will appear here as soon as it is.'**
  String get calendarEmptyMessage;

  /// Title for the Calendar first-load error state.
  ///
  /// In en, this message translates to:
  /// **'Can\'t load the calendar'**
  String get calendarErrorTitle;

  /// Title shown when no current season could be resolved locally.
  ///
  /// In en, this message translates to:
  /// **'Season not available yet'**
  String get calendarSeasonUnavailableTitle;

  /// Message shown when no current season could be resolved locally.
  ///
  /// In en, this message translates to:
  /// **'GridView could not determine the current season. Check your connection and try again.'**
  String get calendarSeasonUnavailableMessage;

  /// Accessibility label for the Calendar refresh action.
  ///
  /// In en, this message translates to:
  /// **'Refresh calendar'**
  String get calendarRefreshAction;

  /// Accessibility label for a calendar event card.
  ///
  /// In en, this message translates to:
  /// **'{name}, round {round}, {status}'**
  String calendarEventSemantics(String name, String round, String status);

  /// Title shown when a Grand Prix has no persisted sessions.
  ///
  /// In en, this message translates to:
  /// **'Schedule not available'**
  String get grandPrixNoSessionsTitle;

  /// Message shown when a Grand Prix has no persisted sessions.
  ///
  /// In en, this message translates to:
  /// **'Session times for this weekend have not been published yet.'**
  String get grandPrixNoSessionsMessage;

  /// Section title for a sprint classification.
  ///
  /// In en, this message translates to:
  /// **'Sprint results'**
  String get grandPrixSprintResults;

  /// Section title for a race classification.
  ///
  /// In en, this message translates to:
  /// **'Race results'**
  String get grandPrixRaceResults;

  /// Title shown when an event has no classification yet.
  ///
  /// In en, this message translates to:
  /// **'Results not available yet'**
  String get grandPrixResultsUnavailableTitle;

  /// Title for a recoverable result-section error.
  ///
  /// In en, this message translates to:
  /// **'Can\'t load results'**
  String get grandPrixResultsErrorTitle;

  /// Accessibility label for navigating from a result row to a driver.
  ///
  /// In en, this message translates to:
  /// **'Open driver {name}'**
  String grandPrixOpenDriver(String name);

  /// Accessibility label for navigating from a result row to a constructor.
  ///
  /// In en, this message translates to:
  /// **'Open team {name}'**
  String grandPrixOpenConstructor(String name);

  /// Circuit field label on the Grand Prix detail.
  ///
  /// In en, this message translates to:
  /// **'Circuit'**
  String get fieldCircuit;

  /// Locality/country field label.
  ///
  /// In en, this message translates to:
  /// **'Location'**
  String get fieldLocation;

  /// Weekend date-range field label.
  ///
  /// In en, this message translates to:
  /// **'Dates'**
  String get fieldDates;

  /// Field label for the event's own IANA time zone.
  ///
  /// In en, this message translates to:
  /// **'Event time zone'**
  String get fieldEventTimeZone;

  /// Field label for the device's local time zone.
  ///
  /// In en, this message translates to:
  /// **'Your time zone'**
  String get fieldDeviceTimeZone;

  /// Shown in place of a driver's name when the driver's profile has not synchronised yet. Never a name derived from the stable identifier.
  ///
  /// In en, this message translates to:
  /// **'Driver name unavailable'**
  String get driverNameUnavailable;

  /// Shown in place of a team's name when the constructor's profile has not synchronised yet. Never a name derived from the stable identifier.
  ///
  /// In en, this message translates to:
  /// **'Team name unavailable'**
  String get constructorNameUnavailable;

  /// Accessibility label for navigating from a result row to a constructor whose name is not available yet.
  ///
  /// In en, this message translates to:
  /// **'Open team'**
  String get grandPrixOpenConstructorUnnamed;

  /// Badge/label marking the fastest lap of a session.
  ///
  /// In en, this message translates to:
  /// **'Fastest lap'**
  String get resultsFastestLap;

  /// How many whole laps behind the leader a classified driver finished.
  ///
  /// In en, this message translates to:
  /// **'{laps, plural, =1{+1 lap} other{+{laps} laps}}'**
  String resultLapsBehind(int laps);

  /// A classification that is not yet final.
  ///
  /// In en, this message translates to:
  /// **'Provisional'**
  String get resultStatusProvisional;

  /// A final classification.
  ///
  /// In en, this message translates to:
  /// **'Final'**
  String get resultStatusFinal;

  /// A classification that has not been produced yet.
  ///
  /// In en, this message translates to:
  /// **'Not available'**
  String get resultStatusUnavailable;

  /// Fallback for a result status this app version does not recognise.
  ///
  /// In en, this message translates to:
  /// **'Status unknown'**
  String get resultStatusUnknown;

  /// Driver finished the session.
  ///
  /// In en, this message translates to:
  /// **'Finished'**
  String get finishStatusFinished;

  /// Driver finished one or more laps behind.
  ///
  /// In en, this message translates to:
  /// **'Lapped'**
  String get finishStatusLapped;

  /// Did not finish.
  ///
  /// In en, this message translates to:
  /// **'DNF'**
  String get finishStatusDnf;

  /// Did not start.
  ///
  /// In en, this message translates to:
  /// **'DNS'**
  String get finishStatusDns;

  /// Disqualified.
  ///
  /// In en, this message translates to:
  /// **'DSQ'**
  String get finishStatusDsq;

  /// Did not qualify.
  ///
  /// In en, this message translates to:
  /// **'DNQ'**
  String get finishStatusDnq;

  /// Fallback for a finish status this app version does not recognise.
  ///
  /// In en, this message translates to:
  /// **'Status unknown'**
  String get finishStatusUnknown;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'es'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'es':
      return AppLocalizationsEs();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
