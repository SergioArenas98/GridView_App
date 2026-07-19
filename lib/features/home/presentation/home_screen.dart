import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/entity_navigation.dart';
import '../../../app/router/route_paths.dart';
import '../../../core/theme/tokens/tokens.dart';
import '../../../core/widgets/widgets.dart';
import '../../../l10n/app_localizations.dart';
import '../../shared/presentation/placeholder/placeholder_content.dart';
import '../../shared/presentation/widgets/event_row.dart';
import '../../shared/presentation/widgets/event_status.dart';
import '../../shared/presentation/widgets/screen_scaffold.dart';
import '../../shared/presentation/widgets/screen_sections.dart';

/// Home screen skeleton. Uses a vertical information hierarchy (App Flow §6.2):
/// season context, next-Grand-Prix hero, session status, championship leaders,
/// latest result and upcoming events. No main horizontal carousel.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final PlaceholderEvent next = Placeholders.nextEvent;
    final List<PlaceholderStanding> drivers = Placeholders.driverStandings();
    final List<PlaceholderStanding> constructors =
        Placeholders.constructorStandings();

    return GvScreenScaffold(
      title: l10n.appTitle,
      showSettingsAction: true,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          GvLayout.screenPaddingHorizontal,
          GvSpacing.md,
          GvLayout.screenPaddingHorizontal,
          GvSpacing.xxl,
        ),
        children: <Widget>[
          // Season context / header.
          Text(
            l10n.seasonLabel('${Placeholders.season}'),
            style: GvTypography.displayL,
          ),
          const SizedBox(height: GvSpacing.xs),
          Text(l10n.previewDataNotice, style: GvTypography.caption),
          const SizedBox(height: GvSpacing.xl),

          // Next Grand Prix hero.
          GvScreenSection(
            title: l10n.homeNextGrandPrix,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                GvHeroCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: <Widget>[
                      GvStatusChip(
                        label: eventStateLabel(l10n, next.state),
                        tone: toneForEventState(next.state),
                      ),
                      const SizedBox(height: GvSpacing.sm),
                      Text(next.name, style: GvTypography.pageTitle),
                      const SizedBox(height: GvSpacing.xxs),
                      Text(
                        '${next.circuitName} · ${next.dateRange}',
                        style: GvTypography.bodyM,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: GvSpacing.sm),
                GvPrimaryButton(
                  label: l10n.homeOpenGrandPrix,
                  icon: Icons.arrow_forward,
                  onPressed: () => context.openEntity(
                    RoutePaths.grandPrix(
                      season: next.season,
                      round: next.round,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: GvSpacing.xl),

          // Session / status block.
          GvScreenSection(
            title: l10n.homeSessions,
            child: Column(
              children: <Widget>[
                for (final PlaceholderSession s in Placeholders.weekend)
                  GvSessionRow(
                    key: ValueKey<String>('home-session-${s.name}'),
                    name: s.name,
                    time: '${s.day} ${s.time}',
                    statusLabel: eventStateLabel(l10n, s.state),
                  ),
              ],
            ),
          ),
          const SizedBox(height: GvSpacing.xl),

          // Championship leader summaries.
          GvScreenSection(
            title: l10n.homeLeaders,
            child: Column(
              children: <Widget>[
                GvStandingsRow(
                  position: '${drivers.first.position}',
                  name: drivers.first.name,
                  team: l10n.homeLeaderDrivers,
                  points: drivers.first.points,
                  isLeader: true,
                  accentColor: drivers.first.accent,
                  onTap: () => context.openEntity(
                    RoutePaths.driver(drivers.first.entityId),
                  ),
                ),
                GvStandingsRow(
                  position: '${constructors.first.position}',
                  name: constructors.first.name,
                  team: l10n.homeLeaderConstructors,
                  points: constructors.first.points,
                  isLeader: true,
                  accentColor: constructors.first.accent,
                  onTap: () => context.openEntity(
                    RoutePaths.constructor(constructors.first.entityId),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: GvSpacing.xl),

          // Latest-result placeholder.
          GvScreenSection(
            title: l10n.homeLatestResult,
            child: Column(
              children: <Widget>[
                for (final PlaceholderStanding r in drivers.take(3))
                  GvResultRow(
                    key: ValueKey<String>('home-result-${r.entityId}'),
                    position: '${r.position}',
                    driverName: r.name,
                    team: r.detail,
                    timeOrGap: r.position == 1 ? '—' : '+${r.position * 3}.2s',
                    accentColor: r.accent,
                    onTap: () =>
                        context.openEntity(RoutePaths.driver(r.entityId)),
                  ),
              ],
            ),
          ),
          const SizedBox(height: GvSpacing.xl),

          // Upcoming events.
          GvScreenSection(
            title: l10n.homeUpcoming,
            actionLabel: l10n.seeAll,
            onAction: () => context.go(RoutePaths.calendar),
            child: Column(
              children: <Widget>[
                for (final PlaceholderEvent e in Placeholders.calendar.where(
                  (PlaceholderEvent e) =>
                      e.state != PlaceholderEventState.completed,
                ))
                  Padding(
                    key: ValueKey<String>('home-upcoming-${e.round}'),
                    padding: const EdgeInsets.only(bottom: GvSpacing.sm),
                    child: EventRow(
                      event: e,
                      emphasized: e.state == PlaceholderEventState.current,
                      onTap: () => context.openEntity(
                        RoutePaths.grandPrix(season: e.season, round: e.round),
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
