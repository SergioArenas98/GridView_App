import 'package:flutter/material.dart';

import '../../../app/router/entity_navigation.dart';
import '../../../app/router/route_paths.dart';
import '../../../core/theme/tokens/tokens.dart';
import '../../../core/widgets/widgets.dart';
import '../../../l10n/app_localizations.dart';
import '../../shared/presentation/placeholder/placeholder_content.dart';
import '../../shared/presentation/widgets/event_status.dart';
import '../../shared/presentation/widgets/screen_scaffold.dart';
import '../../shared/presentation/widgets/screen_sections.dart';

/// Grand Prix detail skeleton (App Flow §7.3): hero/header, circuit summary,
/// ordered sessions, result-availability section, and navigation placeholders to
/// circuit, driver and constructor detail. [season] and [round] are already
/// validated by the router.
class GrandPrixDetailScreen extends StatelessWidget {
  const GrandPrixDetailScreen({
    super.key,
    required this.season,
    required this.round,
  });

  final int season;
  final int round;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final PlaceholderEvent? event = Placeholders.eventByRound(season, round);
    final String name = event?.name ?? l10n.roundLabel('$round');
    final PlaceholderCircuit circuit = event == null
        ? Placeholders.circuits.first
        : Placeholders.circuitById(event.circuitId) ??
              Placeholders.circuits.first;
    final List<PlaceholderStanding> results = Placeholders.driverStandings()
        .take(3)
        .toList();

    return GvScreenScaffold(
      title: l10n.grandPrixTitle,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          GvLayout.screenPaddingHorizontal,
          GvSpacing.md,
          GvLayout.screenPaddingHorizontal,
          GvSpacing.xxl,
        ),
        children: <Widget>[
          // Hero / header.
          GvHeroCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.end,
              children: <Widget>[
                if (event != null)
                  GvStatusChip(
                    label: eventStateLabel(l10n, event.state),
                    tone: toneForEventState(event.state),
                  ),
                const SizedBox(height: GvSpacing.sm),
                Text(name, style: GvTypography.pageTitle),
                const SizedBox(height: GvSpacing.xxs),
                Text(
                  '${l10n.roundLabel('$round')} · ${l10n.seasonLabel('$season')}',
                  style: GvTypography.bodyM,
                ),
              ],
            ),
          ),
          const SizedBox(height: GvSpacing.xl),

          // Circuit summary + navigation placeholder to circuit detail.
          GvScreenSection(
            title: l10n.grandPrixCircuit,
            child: GvContentCard(
              onTap: () => context.openEntity(RoutePaths.circuit(circuit.id)),
              child: Row(
                children: <Widget>[
                  const SizedBox(
                    width: 56,
                    child: GvImagePlaceholder(
                      aspectRatio: 16 / 9,
                      icon: Icons.route_outlined,
                    ),
                  ),
                  const SizedBox(width: GvSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(circuit.name, style: GvTypography.cardTitle),
                        Text(circuit.country, style: GvTypography.label),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right, color: GvColors.textMuted),
                ],
              ),
            ),
          ),
          const SizedBox(height: GvSpacing.xl),

          // Ordered sessions.
          GvScreenSection(
            title: l10n.grandPrixSessions,
            child: Column(
              children: <Widget>[
                for (final PlaceholderSession s in Placeholders.weekend)
                  GvSessionRow(
                    key: ValueKey<String>('gp-session-${s.name}'),
                    name: s.name,
                    time: '${s.day} ${s.time}',
                    statusLabel: eventStateLabel(l10n, s.state),
                  ),
              ],
            ),
          ),
          const SizedBox(height: GvSpacing.xl),

          // Result availability + navigation placeholders to driver/constructor.
          GvScreenSection(
            title: l10n.grandPrixResults,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Padding(
                  padding: const EdgeInsets.only(bottom: GvSpacing.sm),
                  child: Text(
                    l10n.grandPrixResultsPending,
                    style: GvTypography.bodyM,
                  ),
                ),
                for (final PlaceholderStanding r in results)
                  GvResultRow(
                    key: ValueKey<String>('gp-result-${r.entityId}'),
                    position: '${r.position}',
                    driverName: r.name,
                    team: r.detail,
                    accentColor: r.accent,
                    onTap: () =>
                        context.openEntity(RoutePaths.driver(r.entityId)),
                  ),
                const SizedBox(height: GvSpacing.sm),
                GvSecondaryButton(
                  label: Placeholders.constructorStandings().first.name,
                  icon: Icons.groups_outlined,
                  onPressed: () => context.openEntity(
                    RoutePaths.constructor(
                      Placeholders.constructorStandings().first.entityId,
                    ),
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
