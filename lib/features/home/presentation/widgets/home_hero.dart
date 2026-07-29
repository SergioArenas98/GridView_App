import 'package:flutter/material.dart';

import '../../../../core/theme/tokens/tokens.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../shared/domain/entities/enums.dart';
import '../../../shared/domain/entities/grand_prix.dart';
import '../../../shared/presentation/domain_status.dart';
import '../../application/home_state.dart';
import '../../domain/home_temporal_state.dart';
import '../home_formatting.dart';

/// The relevant Grand Prix hero.
///
/// It stays useful when the image, the circuit, the location, the exact timing
/// or the sessions are missing: every line is built only from values that
/// actually exist, and the event name, status and primary action are always
/// present. No remote image is requested — Phase 7D uses a layout-reserving
/// placeholder only — and the placeholder never grows large enough to push the
/// timing below the fold on a narrow phone.
class HomeHero extends StatelessWidget {
  const HomeHero({
    super.key,
    required this.module,
    required this.format,
    required this.now,
    required this.onOpen,
  });

  final HomeEventModule module;
  final HomeFormatter format;
  final DateTime now;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final GrandPrix event = module.focus.grandPrix;
    final String statusLabel = requiredEventStatusLabel(l10n, event.status);
    final String? dateRange = format.dateRange(event.startDate, event.endDate);
    final String? location = _location();
    final String? relative = format.relativeStart(module.sessionFocus, now);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Semantics(
          container: true,
          child: GvHeroCard(
            background: const ExcludeSemantics(
              child: GvImagePlaceholder(
                aspectRatio: 16 / 9,
                icon: Icons.flag_outlined,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.end,
              children: <Widget>[
                Wrap(
                  spacing: GvSpacing.xs,
                  runSpacing: GvSpacing.xxs,
                  children: <Widget>[
                    if (module.phase == HomeTemporalPhase.raceWeekend)
                      GvStatusChip(
                        label: l10n.homeRaceWeekend,
                        tone: GvStatusTone.live,
                      ),
                    GvStatusChip(
                      label: statusLabel,
                      tone: toneForEventStatus(event.status),
                    ),
                    if (event.format == WeekendFormat.sprint)
                      GvStatusChip(
                        label: weekendFormatLabel(l10n, WeekendFormat.sprint),
                      ),
                  ],
                ),
                const SizedBox(height: GvSpacing.sm),
                // The event name is the screen's primary heading.
                Semantics(
                  header: true,
                  child: Text(
                    event.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: GvTypography.pageTitle,
                  ),
                ),
                const SizedBox(height: GvSpacing.xxs),
                Text(
                  l10n.roundLabel('${event.round}'),
                  style: GvTypography.label,
                ),
                if (_subtitle(location, dateRange) case final String subtitle)
                  Padding(
                    padding: const EdgeInsets.only(top: GvSpacing.xxs),
                    child: Text(
                      subtitle,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: GvTypography.bodyM,
                    ),
                  ),
                if (relative != null)
                  Padding(
                    padding: const EdgeInsets.only(top: GvSpacing.xs),
                    child: Text(relative, style: GvTypography.label),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: GvSpacing.sm),
        GvPrimaryButton(
          key: const ValueKey<String>('home-hero-open'),
          label: l10n.homeOpenGrandPrix,
          icon: Icons.arrow_forward,
          onPressed: onOpen,
        ),
      ],
    );
  }

  /// The circuit / location / dates line, assembled only from present values.
  String? _subtitle(String? location, String? dateRange) {
    final List<String> parts = <String>[
      ?module.focus.circuit?.name,
      ?location,
      ?dateRange,
    ];
    return parts.isEmpty ? null : parts.join(' · ');
  }

  String? _location() {
    final List<String> parts = <String>[
      ?module.focus.circuit?.locality,
      ?module.focus.circuit?.country,
    ];
    return parts.isEmpty ? null : parts.join(', ');
  }
}
