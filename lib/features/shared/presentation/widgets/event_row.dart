import 'package:flutter/material.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../l10n/app_localizations.dart';
import '../placeholder/placeholder_content.dart';
import 'event_status.dart';

/// A calendar/event row composed from design-system components. Shows the round,
/// name, circuit and a status chip; the next relevant event can be [emphasized]
/// with a restrained accent bar (never a full coloured background).
class EventRow extends StatelessWidget {
  const EventRow({
    super.key,
    required this.event,
    this.emphasized = false,
    this.onTap,
  });

  final PlaceholderEvent event;
  final bool emphasized;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return GvContentCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(
        horizontal: GvSpacing.md,
        vertical: GvSpacing.sm,
      ),
      child: Row(
        children: <Widget>[
          if (emphasized) ...<Widget>[
            Container(
              width: 4,
              height: 36,
              decoration: BoxDecoration(
                color: context.gvColors.accentPrimary,
                borderRadius: GvRadii.pillAll,
              ),
            ),
            const SizedBox(width: GvSpacing.sm),
          ],
          SizedBox(
            width: 32,
            child: Text(
              '${event.round}',
              textAlign: TextAlign.center,
              style: context.gvText.statValue.copyWith(fontSize: 18),
            ),
          ),
          const SizedBox(width: GvSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Text(
                  event.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: context.gvText.cardTitle.copyWith(fontSize: 16),
                ),
                Text(
                  '${event.circuitName} · ${event.dateRange}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: context.gvText.label,
                ),
                const SizedBox(height: GvSpacing.xs),
                // The status chip lives in the column (bounded width) so it
                // ellipsizes rather than overflowing at large text scales.
                Align(
                  alignment: Alignment.centerLeft,
                  child: GvStatusChip(
                    label: eventStateLabel(l10n, event.state),
                    tone: toneForEventState(event.state),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
