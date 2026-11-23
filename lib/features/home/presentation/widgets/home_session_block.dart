import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/time/session_time.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../shared/application/providers.dart';
import '../../../shared/domain/entities/session.dart';
import '../../../shared/presentation/domain_status.dart';
import '../../application/home_state.dart';
import '../home_formatting.dart';
import '../home_status_kinds.dart';
import 'home_primer_parts.dart';

/// Weekend sessions (`refinement-01` `.sessions`): a full-bleed timing band,
/// no nested card. The focused (current or next) session is the link, with its
/// accent label and chevron; the compact ordered window around it follows in
/// delivered order. Each row: session name opposite the large tabular start
/// time and its zone, the localized date beneath, the status chip opposite the
/// label. The band closes with the reader's own time zone.
///
/// Times use the one application-wide presentation policy (Device / Event /
/// Both). A session with no start time shows no time and no date: never
/// midnight, never zero. Standard, sprint and unrecognised weekends all render
/// through the same delivered-order path.
class HomeSessionBlock extends ConsumerWidget {
  const HomeSessionBlock({
    super.key,
    required this.module,
    required this.format,
    required this.onOpen,
  });

  final HomeEventModule module;
  final HomeFormatter format;
  final VoidCallback onOpen;

  /// The band switches to one column at or below 15em of its content width.
  static const double narrowEm = 15;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final Session? focus = module.sessionFocus?.session;
    final List<Session> window = module.scheduleWindow.isNotEmpty
        ? module.scheduleWindow
        : <Session>[?focus];
    final GvPrimerGradient? lighting = roles.bandLighting;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: lighting == null ? roles.surface.band : null,
        gradient: lighting?.toGradient(),
        border: Border.symmetric(
          horizontal: BorderSide(color: roles.line.subtle),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          GvPrimerLayout.gutter,
          22,
          GvPrimerLayout.gutter,
          18,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            GvPrimerSectionTitle(l10n.homeSessions),
            const SizedBox(height: 14),
            if (window.isEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: HomeReadable(
                  child: Text(
                    l10n.homeSessionUnavailable,
                    style: homeTextStyle(color: roles.text.secondary),
                  ),
                ),
              )
            else
              for (final Session session in window)
                _SessionRow(
                  key: ValueKey<String>('session-${session.id}'),
                  module: module,
                  format: format,
                  session: session,
                  focused: focus != null && session.id == focus.id,
                  onOpen: onOpen,
                ),
            DecoratedBox(
              decoration: BoxDecoration(
                border: Border(top: BorderSide(color: roles.line.subtle)),
              ),
              child: Padding(
                padding: const EdgeInsets.only(top: 12),
                child: HomeReadable(
                  child: Text(
                    '${l10n.fieldDeviceTimeZone}: '
                    '${ref.watch(deviceTimeZoneLabelProvider)}',
                    style: homeTextStyle(
                      size: 13,
                      height: 1.35,
                      color: roles.text.secondary,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SessionRow extends StatelessWidget {
  const _SessionRow({
    super.key,
    required this.module,
    required this.format,
    required this.session,
    required this.focused,
    required this.onOpen,
  });

  final HomeEventModule module;
  final HomeFormatter format;
  final Session session;
  final bool focused;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final HomeSessionView view = HomeSessionView.of(
      session: session,
      module: module,
      format: format,
      l10n: l10n,
      focused: focused,
    );

    final Widget content = LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        final bool narrow =
            constraints.maxWidth <=
            GvPrimerLayout.containerEm(
              MediaQuery.textScalerOf(context),
              HomeSessionBlock.narrowEm,
            );
        return _layout(roles, view, narrow);
      },
    );

    final Widget row = Padding(
      padding: const EdgeInsets.only(top: 4, bottom: 14),
      child: content,
    );
    if (!focused) {
      return Semantics(
        container: true,
        label: view.semanticLabel,
        child: ExcludeSemantics(child: row),
      );
    }
    return GvPrimerFocusTarget(
      key: const ValueKey<String>('home-session-focus'),
      onActivate: onOpen,
      role: GvPrimerTargetRole.link,
      semanticLabel: view.semanticLabel,
      child: ExcludeSemantics(child: row),
    );
  }

  Widget _layout(GvPrimerRoles roles, HomeSessionView view, bool narrow) {
    final Widget? label = view.focusLabel == null
        ? null
        : Row(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Flexible(
                child: Text(
                  view.focusLabel!,
                  style: homeTextStyle(
                    size: 13,
                    weight: 700,
                    height: 1.35,
                    color: roles.text.accent,
                  ),
                ),
              ),
              const SizedBox(width: 2),
              GvPrimerIcon(
                GvPrimerGlyph.chevronRight,
                size: 16,
                strokeWidth: GvPrimerIconStroke.small,
                color: roles.text.accent,
              ),
            ],
          );
    final Widget chip = GvPrimerStatusChip(
      label: view.statusLabel,
      kind: view.statusKind,
    );
    final Widget name = HomeDisplayText(
      view.name,
      size: 24,
      cap: 34,
      weight: 750,
      width: 88,
      height: 1.1,
      color: roles.text.primary,
    );
    final Widget? time = view.time == null
        ? null
        : _Time(view: view, align: narrow ? TextAlign.start : TextAlign.end);
    final List<Widget> lower = <Widget>[
      if (view.date case final String date)
        Padding(
          padding: const EdgeInsets.only(top: 2),
          child: Text(date, style: homeTextStyle(color: roles.text.secondary)),
        ),
      if (view.secondaryTime case final String other)
        Text(other, style: homeTextStyle(color: roles.text.secondary)),
    ];

    if (narrow) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          ?label,
          Padding(padding: const EdgeInsets.only(top: 4), child: chip),
          const SizedBox(height: 4),
          name,
          if (time != null)
            Padding(padding: const EdgeInsets.only(top: 6), child: time),
          ...lower,
        ],
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Row(
          children: <Widget>[
            Expanded(
              child: Align(
                alignment: AlignmentDirectional.centerStart,
                child: label ?? const SizedBox.shrink(),
              ),
            ),
            const SizedBox(width: 16),
            Flexible(child: chip),
          ],
        ),
        const SizedBox(height: 4),
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: <Widget>[
            Expanded(child: name),
            if (time != null) ...<Widget>[
              const SizedBox(width: 16),
              // Loose: the time keeps its natural width, but a long zone label
              // wraps under it instead of clipping or pushing out the name.
              Flexible(
                child: Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: time,
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 4),
        ...lower,
      ],
    );
  }
}

/// The large tabular start time with its zone (`.session__time`).
class _Time extends StatelessWidget {
  const _Time({required this.view, required this.align});

  final HomeSessionView view;

  /// End-aligned opposite the name; start-aligned in the one-column layout.
  final TextAlign align;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final TextScaler scaler = MediaQuery.textScalerOf(context);
    return Text.rich(
      TextSpan(
        children: <InlineSpan>[
          TextSpan(
            text: view.time,
            style: homeDisplayStyle(
              scaler,
              size: 44,
              cap: 60,
              weight: 800,
              width: 118,
              height: 0.9,
              tracking: -0.03,
              tabular: true,
            ).copyWith(color: roles.text.primary),
          ),
          if (view.zone case final String zone)
            TextSpan(
              text: ' $zone',
              style: homeTextStyle(
                size: scaler.scale(15),
                weight: 700,
                height: 1,
                color: roles.text.secondary,
              ),
            ),
        ],
      ),
      textScaler: TextScaler.noScaling,
      textAlign: align,
    );
  }
}

/// One session reduced to plain, already-formatted strings, built from the
/// domain read model per build, assembled so a screen reader hears the label,
/// the session name, its local date and time, then its status.
class HomeSessionView {
  const HomeSessionView({
    required this.name,
    required this.statusLabel,
    required this.statusKind,
    required this.semanticLabel,
    this.focusLabel,
    this.time,
    this.zone,
    this.date,
    this.secondaryTime,
  });

  final String name;
  final String statusLabel;
  final GvPrimerChipKind statusKind;
  final String semanticLabel;

  /// "Next session" / "Current session" on the focused row only.
  final String? focusLabel;

  /// The primary clock time, its zone label and its localized date; all
  /// `null` when the session carries no start time.
  final String? time;
  final String? zone;
  final String? date;

  /// The second clock in Both mode, only when it differs; the day is repeated
  /// only when the conversion lands on a different date.
  final String? secondaryTime;

  static HomeSessionView of({
    required Session session,
    required HomeEventModule module,
    required HomeFormatter format,
    required AppLocalizations l10n,
    required bool focused,
  }) {
    final PresentedTime? shown = format.time.present(
      session.startTime,
      eventTimeZone: module.focus.grandPrix.timezone,
    );
    final String name = sessionDisplayName(l10n, session);
    final String status = requiredSessionStatusLabel(l10n, session.status);
    final String? label = focused && module.sessionFocus != null
        ? format.sessionFocusLabel(module.sessionFocus!)
        : null;
    final String? secondary = switch (shown?.secondary) {
      final DisplayedTime other => <String>[
        if (shown!.crossesDay) '${other.dayLabel} ·',
        other.time,
        other.zoneLabel,
      ].join(' '),
      null => null,
    };
    final String? spokenTime = shown == null
        ? null
        : '${shown.primary.dayLabel} · '
              '${shown.primary.time} ${shown.primary.zoneLabel}';
    return HomeSessionView(
      name: name,
      statusLabel: status,
      statusKind: homeSessionStatusKind(session.status),
      focusLabel: label,
      time: shown?.primary.time,
      zone: shown?.primary.zoneLabel,
      date: shown?.primary.dayLabel,
      secondaryTime: secondary,
      semanticLabel: <String>[
        ?label,
        name,
        ?spokenTime,
        ?secondary,
        status,
      ].join(', '),
    );
  }
}
