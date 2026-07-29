import '../../../core/preferences/preference_values.dart';
import '../../../l10n/app_localizations.dart';

/// The localized display copy for every preference value.
///
/// One place decides how a preference reads, so the summary on the Settings root
/// and the option on its selection screen can never disagree — and no screen
/// ever falls back to printing a wire token such as `both` as if it were copy.
abstract final class PreferenceLabels {
  static String language(AppLocalizations l10n, AppLanguagePreference value) =>
      switch (value) {
        AppLanguagePreference.system => l10n.settingsLanguageSystem,
        // The two real languages are shown in their own language, which is what
        // makes the list usable to a reader who cannot read the current one.
        AppLanguagePreference.english => l10n.settingsLanguageEnglish,
        AppLanguagePreference.spanish => l10n.settingsLanguageSpanish,
      };

  static String? languageDescription(
    AppLocalizations l10n,
    AppLanguagePreference value,
  ) => switch (value) {
    AppLanguagePreference.system => l10n.settingsLanguageSystemDescription,
    _ => null,
  };

  static String theme(AppLocalizations l10n, AppThemePreference value) =>
      switch (value) {
        AppThemePreference.system => l10n.settingsThemeSystem,
        AppThemePreference.dark => l10n.settingsThemeDark,
        AppThemePreference.light => l10n.settingsThemeLight,
      };

  static String? themeDescription(
    AppLocalizations l10n,
    AppThemePreference value,
  ) => switch (value) {
    AppThemePreference.system => l10n.settingsThemeSystemDescription,
    _ => null,
  };

  static String timeDisplay(
    AppLocalizations l10n,
    TimeDisplayPreference value,
  ) => switch (value) {
    TimeDisplayPreference.device => l10n.settingsTimeDevice,
    TimeDisplayPreference.event => l10n.settingsTimeEvent,
    TimeDisplayPreference.both => l10n.settingsTimeBoth,
  };

  static String timeDisplayDescription(
    AppLocalizations l10n,
    TimeDisplayPreference value,
  ) => switch (value) {
    TimeDisplayPreference.device => l10n.settingsTimeDeviceDescription,
    TimeDisplayPreference.event => l10n.settingsTimeEventDescription,
    TimeDisplayPreference.both => l10n.settingsTimeBothDescription,
  };
}
