import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/time/session_time.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../shared/application/providers.dart';
import '../../../shared/domain/entities/session.dart';
import '../../../shared/presentation/domain_status.dart';
import '../../../shared/presentation/widgets/session_list.dart';
import '../../application/home_state.dart';
import '../home_formatting.dart';

/// The current/next session emphasis plus a compact ordered subset of the
/// weekend around it.
///
/// It never duplicates the complete Grand Prix schedule — that stays one
/// interaction away — and it never hardcodes a weekend's session sequence: the
/// window comes from the delivered order, so standard and sprint weekends (and a
/// format this build has never seen) all render through the same path.
///
/// Times use the one event-zone/device-zone policy the Grand Prix screen
/// applies, always with an explicit zone label, and the block additionally
/// states the reader's own device zone so which clock is shown is never
/// ambiguous. A session with no start time simply shows no time: never midnight,
/// never zero.
class HomeSessionBlock extends ConsumerWidget {
  const HomeSessionBlock({
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
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final HomeSessionFocusView? focus = HomeSessionFocusView.of(
      module,
      format,
      l10n,
      now,
    );

    if (focus == null && module.scheduleWindow.isEmpty) {
      return GvContentCard(
        child: Text(
          l10n.homeSessionUnavailable,
          style: context.gvText.bodyM.copyWith(
            color: context.gvColors.textSecondary,
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        if (focus != null) ...<Widget>[
          Semantics(
            button: true,
            label: focus.semanticLabel,
            child: ExcludeSemantics(
              child: GvContentCard(
                key: const ValueKey<String>('home-session-focus'),
                onTap: onOpen,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    Row(
                      children: <Widget>[
                        Expanded(
                          child: Text(
                            focus.label,
                            style: context.gvText.label,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        GvStatusChip(
                          label: focus.statusLabel,
                          tone: focus.tone,
                        ),
                      ],
                    ),
                    const SizedBox(height: GvSpacing.xxs),
                    Text(
                      focus.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: context.gvText.cardTitle,
                    ),
                    if (focus.time case final String time)
                      Padding(
                        padding: const EdgeInsets.only(top: GvSpacing.xxs),
                        child: Text(time, style: context.gvText.bodyM),
                      ),
                    if (focus.relative case final String relative)
                      Padding(
                        padding: const EdgeInsets.only(top: GvSpacing.xxs),
                        child: Text(relative, style: context.gvText.label),
                      ),
                  ],
                ),
              ),
            ),
          ),
          if (module.scheduleWindow.isNotEmpty)
            const SizedBox(height: GvSpacing.sm),
        ],
        if (module.scheduleWindow.isNotEmpty)
          SessionList(
            sessions: module.scheduleWindow,
            eventTimeZone: module.focus.grandPrix.timezone,
          ),
        // Which clock the user is reading, stated explicitly rather than
        // assumed — exactly as the Grand Prix screen states it.
        Padding(
          padding: const EdgeInsets.only(top: GvSpacing.xs),
          child: Text(
            '${l10n.fieldDeviceTimeZone}: '
            '${ref.watch(deviceTimeZoneProvider)}',
            style: context.gvText.caption,
          ),
        ),
      ],
    );
  }
}

/// The focused session reduced to plain, already-formatted strings.
///
/// Built once per build from the domain read model — no repository, DTO or Drift
/// row reaches the widget tree — and assembled so a screen reader hears the
/// session name, its local date and time, its status and its relative state in
/// that order.
class HomeSessionFocusView {
  const HomeSessionFocusView({
    required this.label,
    required this.name,
    required this.statusLabel,
    required this.tone,
    required this.semanticLabel,
    this.time,
    this.relative,
  });

  final String label;
  final String name;
  final String statusLabel;
  final GvStatusTone tone;
  final String semanticLabel;

  /// The explicit localized date/time with its zone label, or `null` when the
  /// session carries no start time.
  final String? time;

  /// The deterministic relative label, when one can be stated truthfully.
  final String? relative;

  static HomeSessionFocusView? of(
    HomeEventModule module,
    HomeFormatter format,
    AppLocalizations l10n,
    DateTime now,
  ) {
    final focus = module.sessionFocus;
    if (focus == null) return null;
    final Session session = focus.session;
    final DisplayedTime? shown = format.time.formatInstant(
      session.startTime,
      eventTimeZone: module.focus.grandPrix.timezone,
    );
    final String name = sessionDisplayName(l10n, session);
    final String status = requiredSessionStatusLabel(l10n, session.status);
    final String? time = shown == null
        ? null
        : '${shown.weekday} ${shown.dayMonth} · ${shown.time} ${shown.zoneLabel}';
    final String? relative = format.relativeStart(focus, now);
    return HomeSessionFocusView(
      label: format.sessionFocusLabel(focus),
      name: name,
      statusLabel: status,
      tone: focus.isLive ? GvStatusTone.live : GvStatusTone.info,
      time: time,
      relative: relative,
      semanticLabel: <String>[
        format.sessionFocusLabel(focus),
        name,
        ?time,
        status,
        ?relative,
      ].join(', '),
    );
  }
}
