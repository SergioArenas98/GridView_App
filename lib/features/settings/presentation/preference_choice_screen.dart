import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/preferences/preferences_repository.dart';
import '../../../l10n/app_localizations.dart';
import 'widgets/settings_app_bar.dart';
import 'widgets/settings_option_list.dart';
import 'widgets/settings_snackbar.dart';

/// One selectable preference value, already reduced to localized copy.
class PreferenceChoice<T> {
  const PreferenceChoice({
    required this.value,
    required this.label,
    this.description,
  });

  final T value;
  final String label;
  final String? description;
}

/// A focused selection screen for a single preference, in Primer V2 (Step
/// 55C.13A; `settings/{language,theme,time}.html`).
///
/// One screen serves language, theme and time display, so the three cannot drift
/// apart in behaviour or accessibility. Selecting applies immediately — there is
/// no confirm step — and the screen stays open so a screen-reader user hears the
/// new selected state in place rather than being popped mid-announcement. A
/// theme or language change re-renders this same route in place.
///
/// A failed write is surfaced as a localized, non-technical message in the
/// Settings Primer snackbar; the visible value has already been reverted by the
/// repository, so what the user sees always matches what is stored. A
/// superseded write (a newer selection won) is silent.
class PreferenceChoiceScreen<T> extends ConsumerWidget {
  const PreferenceChoiceScreen({
    super.key,
    required this.title,
    required this.choices,
    required this.selected,
    required this.onSelected,
  });

  final String title;
  final List<PreferenceChoice<T>> choices;
  final T selected;
  final Future<PreferenceWriteOutcome> Function(T value) onSelected;

  /// The back action's key.
  static const Key backKey = ValueKey<String>('settings-choice-back');

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SettingsPrimerScaffold(
      title: title,
      backKey: backKey,
      body: (BuildContext context, double bottomPadding) =>
          SingleChildScrollView(
            // `.page--choice`: 12px above the options.
            padding: EdgeInsets.only(top: 12, bottom: bottomPadding),
            child: SettingsOptionList(
              options: <SettingsOptionData>[
                for (final PreferenceChoice<T> choice in choices)
                  SettingsOptionData(
                    key: ValueKey<Object?>('preference-option-${choice.value}'),
                    label: choice.label,
                    description: choice.description,
                    selected: choice.value == selected,
                    onSelected: () => _select(context, choice.value),
                  ),
              ],
            ),
          ),
    );
  }

  Future<void> _select(BuildContext context, T value) async {
    // Captured before the write: the messenger and the message stay valid even
    // if a theme or language change rebuilds this screen in the meantime.
    final ScaffoldMessengerState messenger = ScaffoldMessenger.of(context);
    final String failed = AppLocalizations.of(context).settingsSaveFailed;
    final PreferenceWriteOutcome outcome = await onSelected(value);
    if (outcome != PreferenceWriteOutcome.failed) return;
    // Only a genuine persistence failure is reported. A superseded write means a
    // newer selection won, which is success from the reader's point of view.
    showSettingsSnackbar(messenger, failed);
  }
}
