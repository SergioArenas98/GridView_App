import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_ca.dart';
import 'app_localizations_de.dart';
import 'app_localizations_en.dart';
import 'app_localizations_es.dart';
import 'app_localizations_fr.dart';
import 'app_localizations_it.dart';
import 'app_localizations_pt.dart';

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
  AppLocalizations(String locale) : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const LocalizationsDelegate<AppLocalizations> delegate = _AppLocalizationsDelegate();

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
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates = <LocalizationsDelegate<dynamic>>[
    delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('ca'),
    Locale('de'),
    Locale('en'),
    Locale('es'),
    Locale('fr'),
    Locale('it'),
    Locale('pt')
  ];

  /// No description provided for @upcoming.
  ///
  /// In en, this message translates to:
  /// **'Upcoming'**
  String get upcoming;

  /// No description provided for @seeDetails.
  ///
  /// In en, this message translates to:
  /// **'See details'**
  String get seeDetails;

  /// No description provided for @calendar.
  ///
  /// In en, this message translates to:
  /// **'Calendar'**
  String get calendar;

  /// No description provided for @settings.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settings;

  /// No description provided for @theme.
  ///
  /// In en, this message translates to:
  /// **'Theme'**
  String get theme;

  /// No description provided for @privacyPolicies.
  ///
  /// In en, this message translates to:
  /// **'Privacy Policies'**
  String get privacyPolicies;

  /// No description provided for @season.
  ///
  /// In en, this message translates to:
  /// **'Season'**
  String get season;

  /// No description provided for @standings.
  ///
  /// In en, this message translates to:
  /// **'Standings'**
  String get standings;

  /// No description provided for @teams.
  ///
  /// In en, this message translates to:
  /// **'Teams'**
  String get teams;

  /// No description provided for @drivers.
  ///
  /// In en, this message translates to:
  /// **'Drivers'**
  String get drivers;

  /// No description provided for @starting.
  ///
  /// In en, this message translates to:
  /// **'Starting'**
  String get starting;

  /// No description provided for @reserve.
  ///
  /// In en, this message translates to:
  /// **'Reserve'**
  String get reserve;

  /// No description provided for @nationality.
  ///
  /// In en, this message translates to:
  /// **'Nationality'**
  String get nationality;

  /// No description provided for @dateOfBirth.
  ///
  /// In en, this message translates to:
  /// **'Date of Birth'**
  String get dateOfBirth;

  /// No description provided for @placeOfBirth.
  ///
  /// In en, this message translates to:
  /// **'Place of Birth'**
  String get placeOfBirth;

  /// No description provided for @worldChampionships.
  ///
  /// In en, this message translates to:
  /// **'World Championships'**
  String get worldChampionships;

  /// No description provided for @totalPoints.
  ///
  /// In en, this message translates to:
  /// **'Total Points'**
  String get totalPoints;

  /// No description provided for @totalPodiums.
  ///
  /// In en, this message translates to:
  /// **'Total Podiums'**
  String get totalPodiums;

  /// No description provided for @totalGrandPrix.
  ///
  /// In en, this message translates to:
  /// **'Total Grand Prix'**
  String get totalGrandPrix;

  /// No description provided for @highestRaceFinish.
  ///
  /// In en, this message translates to:
  /// **'Highest Race Finish'**
  String get highestRaceFinish;

  /// No description provided for @highestGridPosition.
  ///
  /// In en, this message translates to:
  /// **'Highest Grid Position'**
  String get highestGridPosition;

  /// No description provided for @country.
  ///
  /// In en, this message translates to:
  /// **'Country'**
  String get country;

  /// No description provided for @base.
  ///
  /// In en, this message translates to:
  /// **'Base'**
  String get base;

  /// No description provided for @teamPrincipal.
  ///
  /// In en, this message translates to:
  /// **'Team Principal'**
  String get teamPrincipal;

  /// No description provided for @technicalChief.
  ///
  /// In en, this message translates to:
  /// **'Technical Chief'**
  String get technicalChief;

  /// No description provided for @chassis.
  ///
  /// In en, this message translates to:
  /// **'Chassis'**
  String get chassis;

  /// No description provided for @powerUnit.
  ///
  /// In en, this message translates to:
  /// **'Power Unit'**
  String get powerUnit;

  /// No description provided for @firstEntry.
  ///
  /// In en, this message translates to:
  /// **'First Entry'**
  String get firstEntry;

  /// No description provided for @polePositions.
  ///
  /// In en, this message translates to:
  /// **'Pole Positions'**
  String get polePositions;

  /// No description provided for @fastestLaps.
  ///
  /// In en, this message translates to:
  /// **'Fastest Laps'**
  String get fastestLaps;

  /// No description provided for @startingDrivers.
  ///
  /// In en, this message translates to:
  /// **'Starting Drivers'**
  String get startingDrivers;

  /// No description provided for @reserveDrivers.
  ///
  /// In en, this message translates to:
  /// **'Reserve Drivers'**
  String get reserveDrivers;

  /// No description provided for @race.
  ///
  /// In en, this message translates to:
  /// **'Race'**
  String get race;

  /// No description provided for @thursday.
  ///
  /// In en, this message translates to:
  /// **'Thursday'**
  String get thursday;

  /// No description provided for @friday.
  ///
  /// In en, this message translates to:
  /// **'Friday'**
  String get friday;

  /// No description provided for @saturday.
  ///
  /// In en, this message translates to:
  /// **'Saturday'**
  String get saturday;

  /// No description provided for @sunday.
  ///
  /// In en, this message translates to:
  /// **'Sunday'**
  String get sunday;

  /// No description provided for @monday.
  ///
  /// In en, this message translates to:
  /// **'Monday'**
  String get monday;

  /// No description provided for @firstGP.
  ///
  /// In en, this message translates to:
  /// **'First GP'**
  String get firstGP;

  /// No description provided for @circuitLength.
  ///
  /// In en, this message translates to:
  /// **'Circuit Length'**
  String get circuitLength;

  /// No description provided for @laps.
  ///
  /// In en, this message translates to:
  /// **'Laps'**
  String get laps;

  /// No description provided for @raceDistance.
  ///
  /// In en, this message translates to:
  /// **'Race Distance'**
  String get raceDistance;

  /// No description provided for @lapRecord.
  ///
  /// In en, this message translates to:
  /// **'Fastest Lap'**
  String get lapRecord;

  /// No description provided for @turns.
  ///
  /// In en, this message translates to:
  /// **'Turns'**
  String get turns;

  /// No description provided for @drsZones.
  ///
  /// In en, this message translates to:
  /// **'DRS Zones'**
  String get drsZones;

  /// No description provided for @contractExpiry.
  ///
  /// In en, this message translates to:
  /// **'Contract Expiry'**
  String get contractExpiry;

  /// No description provided for @language.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get language;

  /// No description provided for @search.
  ///
  /// In en, this message translates to:
  /// **'Search'**
  String get search;

  /// No description provided for @donate.
  ///
  /// In en, this message translates to:
  /// **'Contribute with a donation!'**
  String get donate;

  /// No description provided for @raceWeekend.
  ///
  /// In en, this message translates to:
  /// **'Race Weekend'**
  String get raceWeekend;

  /// No description provided for @sprintWeekend.
  ///
  /// In en, this message translates to:
  /// **'Sprint Weekend'**
  String get sprintWeekend;

  /// No description provided for @practice1.
  ///
  /// In en, this message translates to:
  /// **'Free Practice 1'**
  String get practice1;

  /// No description provided for @practice2.
  ///
  /// In en, this message translates to:
  /// **'Free Practice 2'**
  String get practice2;

  /// No description provided for @practice3.
  ///
  /// In en, this message translates to:
  /// **'Free Practice 3'**
  String get practice3;

  /// No description provided for @qualifying.
  ///
  /// In en, this message translates to:
  /// **'Qualifying'**
  String get qualifying;

  /// No description provided for @sprintQualifying.
  ///
  /// In en, this message translates to:
  /// **'Sprint Qualifying'**
  String get sprintQualifying;

  /// No description provided for @sprintRace.
  ///
  /// In en, this message translates to:
  /// **'Sprint Race'**
  String get sprintRace;

  /// No description provided for @finished.
  ///
  /// In en, this message translates to:
  /// **'Finished'**
  String get finished;

  /// No description provided for @inProgress.
  ///
  /// In en, this message translates to:
  /// **'In Progress'**
  String get inProgress;

  /// No description provided for @notStarted.
  ///
  /// In en, this message translates to:
  /// **'Not Started'**
  String get notStarted;

  /// No description provided for @noDataAvailable.
  ///
  /// In en, this message translates to:
  /// **'No data available'**
  String get noDataAvailable;

  /// No description provided for @noResultsFound.
  ///
  /// In en, this message translates to:
  /// **'No results found'**
  String get noResultsFound;

  /// No description provided for @driversTeams.
  ///
  /// In en, this message translates to:
  /// **'Drivers / Teams'**
  String get driversTeams;

  /// No description provided for @home.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get home;

  /// No description provided for @close.
  ///
  /// In en, this message translates to:
  /// **'Close'**
  String get close;

  /// No description provided for @latestDevelopments.
  ///
  /// In en, this message translates to:
  /// **'Latest Developments'**
  String get latestDevelopments;

  /// No description provided for @sendFeedback.
  ///
  /// In en, this message translates to:
  /// **'Send Feedback'**
  String get sendFeedback;

  /// No description provided for @feedbackHint.
  ///
  /// In en, this message translates to:
  /// **'Please write your feedback, bug reports or suggestions:'**
  String get feedbackHint;

  /// No description provided for @writeYourFeedback.
  ///
  /// In en, this message translates to:
  /// **'Write your feedback here...'**
  String get writeYourFeedback;

  /// No description provided for @feedbackEmpty.
  ///
  /// In en, this message translates to:
  /// **'Please write something before sending'**
  String get feedbackEmpty;

  /// No description provided for @emailError.
  ///
  /// In en, this message translates to:
  /// **'Could not open email app'**
  String get emailError;

  /// No description provided for @cancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancel;

  /// No description provided for @send.
  ///
  /// In en, this message translates to:
  /// **'Send'**
  String get send;

  /// No description provided for @couldNotOpenLink.
  ///
  /// In en, this message translates to:
  /// **'Could not open link'**
  String get couldNotOpenLink;

  /// No description provided for @errorOccurred.
  ///
  /// In en, this message translates to:
  /// **'An error occurred'**
  String get errorOccurred;
}

class _AppLocalizationsDelegate extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) => <String>['ca', 'de', 'en', 'es', 'fr', 'it', 'pt'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {


  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'ca': return AppLocalizationsCa();
    case 'de': return AppLocalizationsDe();
    case 'en': return AppLocalizationsEn();
    case 'es': return AppLocalizationsEs();
    case 'fr': return AppLocalizationsFr();
    case 'it': return AppLocalizationsIt();
    case 'pt': return AppLocalizationsPt();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.'
  );
}
