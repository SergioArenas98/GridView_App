import 'package:flutter/material.dart';

import '../../../../core/theme/theme.dart';
import '../../../calendar/presentation/widgets/calendar_event_card.dart';
import '../../../shared/domain/entities/calendar_entry.dart';
import '../../application/home_state.dart';

/// The compact upcoming-events module.
///
/// It renders the **same** card the Calendar screen uses, so Home can never
/// disagree with the Calendar about an event's name, status, circuit or dates,
/// and every accessibility and large-text behaviour proven there applies here
/// unchanged.
///
/// A **vertical** list, deliberately: a horizontal carousel would clip names and
/// dates at large text scales and would add a second scroll axis to a screen
/// that must have exactly one. The set is already bounded and already ordered by
/// the composition, so nothing is sorted or sliced during a build, and each row
/// routes by the exact season and round it displays.
class HomeUpcomingList extends StatelessWidget {
  const HomeUpcomingList({
    super.key,
    required this.module,
    required this.onOpen,
  });

  final HomeUpcomingModule module;
  final void Function(CalendarEntry entry) onOpen;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        for (int i = 0; i < module.events.length; i++) ...<Widget>[
          if (i > 0) const SizedBox(height: GvSpacing.xxs),
          CalendarEventCard(
            key: ValueKey<String>(
              'home-upcoming-${module.events[i].season}-'
              '${module.events[i].round}',
            ),
            entry: module.events[i],
            onTap: () => onOpen(module.events[i]),
          ),
        ],
      ],
    );
  }
}
