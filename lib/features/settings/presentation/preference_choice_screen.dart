import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/preferences/preferences_repository.dart';
import '../../../core/theme/theme.dart';
import '../../../l10n/app_localizations.dart';
import '../../shared/presentation/widgets/screen_scaffold.dart';
import 'widgets/settings_rows.dart';

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

/// A focused selection screen for a single preference.
///
/// One screen serves language, theme and time display, so the three cannot drift
/// apart in behaviour or accessibility. Selecting applies immediately — there is
/// no confirm step — and the screen stays open so a screen-reader user hears the
/// new selected state in place rather than being popped mid-announcement.
///
/// A failed write is surfaced as a localized, non-technical message; the visible
/// value has already been reverted by the repository, so what the user sees
/// always matches what is stored.
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

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);

    return GvScreenScaffold(
      title: title,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          GvLayout.screenPaddingHorizontal,
          GvSpacing.md,
          GvLayout.screenPaddingHorizontal,
          GvSpacing.xxl,
        ),
        children: <Widget>[
          for (final PreferenceChoice<T> choice in choices)
            GvSettingsOption(
              key: ValueKey<Object?>('preference-option-${choice.value}'),
              label: choice.label,
              description: choice.description,
              selected: choice.value == selected,
              selectedStateLabel: l10n.settingsSelected,
              onSelected: () => _select(context, l10n, choice.value),
            ),
        ],
      ),
    );
  }

  Future<void> _select(
    BuildContext context,
    AppLocalizations l10n,
    T value,
  ) async {
    final ScaffoldMessengerState messenger = ScaffoldMessenger.of(context);
    final PreferenceWriteOutcome outcome = await onSelected(value);
    if (outcome != PreferenceWriteOutcome.failed) return;
    // Only a genuine persistence failure is reported. A superseded write means a
    // newer selection won, which is success from the reader's point of view.
    messenger.showSnackBar(SnackBar(content: Text(l10n.settingsSaveFailed)));
  }
}
