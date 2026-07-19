import 'package:flutter/material.dart';

import '../../../app/router/entity_navigation.dart';
import '../../../app/router/route_paths.dart';
import '../../../core/theme/tokens/tokens.dart';
import '../../../l10n/app_localizations.dart';
import '../../shared/presentation/placeholder/placeholder_content.dart';
import '../../shared/presentation/widgets/event_row.dart';
import '../../shared/presentation/widgets/screen_scaffold.dart';

/// Calendar screen skeleton: a chronological event list with completed / current
/// / upcoming visual states and next-event emphasis (App Flow §7).
class CalendarScreen extends StatelessWidget {
  const CalendarScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final int nextRound = Placeholders.nextEvent.round;

    return GvScreenScaffold(
      title: l10n.calendarTitle,
      showSettingsAction: true,
      body: ListView.separated(
        padding: const EdgeInsets.fromLTRB(
          GvLayout.screenPaddingHorizontal,
          GvSpacing.md,
          GvLayout.screenPaddingHorizontal,
          GvSpacing.xxl,
        ),
        itemCount: Placeholders.calendar.length + 1,
        separatorBuilder: (_, _) => const SizedBox(height: GvSpacing.sm),
        itemBuilder: (BuildContext context, int index) {
          if (index == 0) {
            return Padding(
              padding: const EdgeInsets.only(bottom: GvSpacing.xs),
              child: Text(
                l10n.seasonLabel('${Placeholders.season}'),
                style: GvTypography.sectionTitle,
              ),
            );
          }
          final PlaceholderEvent event = Placeholders.calendar[index - 1];
          return EventRow(
            key: ValueKey<String>('calendar-event-${event.round}'),
            event: event,
            emphasized: event.round == nextRound,
            onTap: () => context.openEntity(
              RoutePaths.grandPrix(season: event.season, round: event.round),
            ),
          );
        },
      ),
    );
  }
}
