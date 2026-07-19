import '../../../../core/widgets/widgets.dart';
import '../../../../l10n/app_localizations.dart';
import '../placeholder/placeholder_content.dart';

/// Maps a placeholder event state onto a design-system status tone. Meaning is
/// always reinforced by the localized label, never carried by colour alone.
GvStatusTone toneForEventState(PlaceholderEventState state) => switch (state) {
  PlaceholderEventState.completed => GvStatusTone.success,
  PlaceholderEventState.current => GvStatusTone.live,
  PlaceholderEventState.upcoming => GvStatusTone.info,
};

/// The localized label for an event state.
String eventStateLabel(AppLocalizations l10n, PlaceholderEventState state) =>
    switch (state) {
      PlaceholderEventState.completed => l10n.eventStateCompleted,
      PlaceholderEventState.current => l10n.eventStateCurrent,
      PlaceholderEventState.upcoming => l10n.eventStateUpcoming,
    };
