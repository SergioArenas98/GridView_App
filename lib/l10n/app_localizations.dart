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
