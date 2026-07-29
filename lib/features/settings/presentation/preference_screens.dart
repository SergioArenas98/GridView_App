import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/preferences/preference_values.dart';
import '../../../core/preferences/preferences_providers.dart';
import '../../../l10n/app_localizations.dart';
import '../domain/preference_labels.dart';
import 'preference_choice_screen.dart';

/// Language selection.
class LanguageSettingsScreen extends ConsumerWidget {
  const LanguageSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return PreferenceChoiceScreen<AppLanguagePreference>(
      title: l10n.settingsLanguage,
      selected: ref.watch(
        appPreferencesProvider.select((AppPreferences p) => p.language),
      ),
      choices: <PreferenceChoice<AppLanguagePreference>>[
        for (final AppLanguagePreference value in AppLanguagePreference.values)
          PreferenceChoice<AppLanguagePreference>(
            value: value,
            label: PreferenceLabels.language(l10n, value),
            description: PreferenceLabels.languageDescription(l10n, value),
          ),
      ],
      onSelected: ref.read(appPreferencesProvider.notifier).setLanguage,
    );
  }
}

/// Theme selection.
class ThemeSettingsScreen extends ConsumerWidget {
  const ThemeSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return PreferenceChoiceScreen<AppThemePreference>(
      title: l10n.settingsTheme,
      selected: ref.watch(
        appPreferencesProvider.select((AppPreferences p) => p.theme),
      ),
      choices: <PreferenceChoice<AppThemePreference>>[
        for (final AppThemePreference value in AppThemePreference.values)
          PreferenceChoice<AppThemePreference>(
            value: value,
            label: PreferenceLabels.theme(l10n, value),
            description: PreferenceLabels.themeDescription(l10n, value),
          ),
      ],
      onSelected: ref.read(appPreferencesProvider.notifier).setTheme,
    );
  }
}

/// Session-time display selection.
class TimeDisplaySettingsScreen extends ConsumerWidget {
  const TimeDisplaySettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return PreferenceChoiceScreen<TimeDisplayPreference>(
      title: l10n.settingsTimeDisplay,
      selected: ref.watch(timeDisplayPreferenceProvider),
      choices: <PreferenceChoice<TimeDisplayPreference>>[
        for (final TimeDisplayPreference value in TimeDisplayPreference.values)
          PreferenceChoice<TimeDisplayPreference>(
            value: value,
            label: PreferenceLabels.timeDisplay(l10n, value),
            description: PreferenceLabels.timeDisplayDescription(l10n, value),
          ),
      ],
      onSelected: ref.read(appPreferencesProvider.notifier).setTimeDisplay,
    );
  }
}
