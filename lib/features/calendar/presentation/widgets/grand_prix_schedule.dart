import 'package:flutter/material.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';

/// One labelled time-zone fact under the Sessions title (GP12, GP13).
@immutable
class GrandPrixZoneFact {
  const GrandPrixZoneFact(this.label, this.value);

  final String label;
  final String value;
}

/// One session, already presented by the caller (S01–S05). Every word is
/// final display text; a session without a start time has no [time].
@immutable
class GrandPrixScheduleSession {
  const GrandPrixScheduleSession({
    required this.id,
    required this.name,
    required this.status,
    this.statusKind,
    this.time,
    this.zone,
    this.secondaryTime,
  }) : assert((time == null) == (zone == null), 'A time needs its zone');

  /// The session's stable id, for its key only. Never displayed.
  final String id;
  final String name;

  /// The localized status word.
  final String status;

  /// The chip for [status], or `null` for the plain secondary word
  /// (Scheduled, Completed).
  final GvPrimerChipKind? statusKind;

  /// The primary clock ("10:30") and its zone label ("UTC").
  final String? time;
  final String? zone;

  /// The second clock in Both mode, only when it differs: "10:30 UTC", or
  /// with its own day first when it falls on another date ("Sun Jul 26 23:00
  /// UTC").
  final String? secondaryTime;
}

/// A run of consecutive sessions sharing one primary day label.
@immutable
class GrandPrixScheduleDay {
  const GrandPrixScheduleDay({required this.label, required this.sessions});

  /// The primary clock's day ("Fri Jul 24"), or `null` for sessions with no
  /// start time, which get no day header.
  final String? label;
  final List<GrandPrixScheduleSession> sessions;
}

/// Groups [items] into runs of consecutive items with the same [dayOf]
/// (run-length grouping, DD G-4): delivered order is never changed, nothing
/// is sorted or merged across runs, so a day that reappears later starts a
/// new run.
List<(String?, List<T>)> runsByDay<T>(
  List<T> items,
  String? Function(T item) dayOf,
) {
  final List<(String?, List<T>)> runs = <(String?, List<T>)>[];
  for (final T item in items) {
    final String? day = dayOf(item);
    if (runs.isNotEmpty && runs.last.$1 == day) {
      runs.last.$2.add(item);
    } else {
      runs.add((day, <T>[item]));
    }
  }
  return runs;
}

/// The Sessions section (`gpd.css` `.sec` with `.zones` and `.sched`,
/// GP12–GP15, S01–S05; Step 55C.12): the section title, the time-zone
/// facts, then the weekend as a timetable: a day header with a trailing
/// hairline for each run of consecutive same-day sessions, and one row per
/// session with the time first in a fixed `7.5rem` column.
///
/// Below `22em` (330px at 100% text; 320dp, or large text) the time moves
/// above the name. With no sessions the zones stay and the controlled empty
/// state follows (G-2).
///
/// Reading order (PD-06 / XS-03, prototype): each row is read as one node,
/// time (with any second clock), then the name, then the status. A session
/// without a start time reads name, status.
class GrandPrixSchedule extends StatelessWidget {
  const GrandPrixSchedule({
    super.key,
    required this.title,
    required this.zones,
    required this.days,
    required this.emptyTitle,
    required this.emptyMessage,
  });

  final String title;
  final List<GrandPrixZoneFact> zones;
  final List<GrandPrixScheduleDay> days;
  final String emptyTitle;
  final String emptyMessage;

  /// The narrow layout applies at or below this width in `em`.
  static const double narrowEm = 22;

  /// Whether a schedule [width] wide is narrow under [scaler]
  /// (`@container sched (max-width: 22em)`).
  static bool isNarrow(double width, TextScaler scaler) =>
      width <= GvPrimerLayout.containerEm(scaler, narrowEm);

  /// The time column (`--time-col: 7.5rem`) under [scaler].
  static double timeColumn(TextScaler scaler) =>
      7.5 * GvPrimerLayout.rootFontSize * GvPrimerLayout.remScale(scaler);

  /// Gap between the time column and the name (`.sess` `column-gap`).
  static const double columnGap = 14;

  @override
  Widget build(BuildContext context) {
    return Column(
      key: const ValueKey<String>('gp-schedule'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: GvPrimerLayout.gutter,
          ),
          child: GvPrimerSectionTitle(title),
        ),
        _Zones(zones: zones),
        if (days.isEmpty)
          GvPrimerEmptyState(
            key: const ValueKey<String>('gp-schedule-empty'),
            glyph: GvPrimerGlyph.clock,
            title: emptyTitle,
            message: emptyMessage,
            padding: GvPrimerEmptyState.inlinePadding,
            announceTitle: true,
          )
        else
          LayoutBuilder(
            builder: (BuildContext context, BoxConstraints constraints) {
              final bool narrow = isNarrow(
                constraints.maxWidth,
                MediaQuery.textScalerOf(context),
              );
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  for (final GrandPrixScheduleDay day in days) ...<Widget>[
                    if (day.label case final String label) _DayLabel(label),
                    for (int i = 0; i < day.sessions.length; i++)
                      _SessionRow(
                        key: ValueKey<String>('session-${day.sessions[i].id}'),
                        session: day.sessions[i],
                        narrow: narrow,
                        dividerAbove: i > 0,
                      ),
                  ],
                ],
              );
            },
          ),
      ],
    );
  }
}

/// `.zones`: 6px below the title, 4px above the schedule; each fact a label
/// and a weight-650 value, wrapping as a unit, 20px apart (4px between
/// lines).
class _Zones extends StatelessWidget {
  const _Zones({required this.zones});

  final List<GrandPrixZoneFact> zones;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final TextStyle base = GvPrimerTypography.archivo(
      size: 13,
      weight: 400,
      height: 1.35,
    );
    return Padding(
      key: const ValueKey<String>('gp-zones'),
      padding: const EdgeInsets.fromLTRB(GvPrimerLayout.gutter, 6, 16, 4),
      child: Wrap(
        spacing: 20,
        runSpacing: 4,
        children: <Widget>[
          for (final GrandPrixZoneFact zone in zones)
            MergeSemantics(
              child: Wrap(
                spacing: 6,
                children: <Widget>[
                  Text(
                    zone.label,
                    style: base.copyWith(color: roles.text.secondary),
                  ),
                  Text(
                    zone.value,
                    style: GvPrimerTypography.archivo(
                      size: 13,
                      weight: 650,
                      height: 1.35,
                    ).copyWith(color: roles.text.primary),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// `.day__label`: 16px above, 2px below, on the gutter; 14px weight 700
/// secondary, then a `line.subtle` hairline filling the rest, 12px after
/// the word. A header.
class _DayLabel extends StatelessWidget {
  const _DayLabel(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    return Padding(
      padding: const EdgeInsets.fromLTRB(GvPrimerLayout.gutter, 16, 16, 2),
      child: LayoutBuilder(
        builder: (BuildContext context, BoxConstraints constraints) => Row(
          children: <Widget>[
            // The word takes its own width (wrapping only if it must); the
            // hairline fills the rest of the line.
            ConstrainedBox(
              constraints: BoxConstraints(
                maxWidth: (constraints.maxWidth - 12).clamp(0, double.infinity),
              ),
              child: Semantics(
                header: true,
                child: Text(
                  label,
                  style: GvPrimerTypography.archivo(
                    size: 14,
                    weight: 700,
                    height: 1.3,
                  ).copyWith(color: roles.text.secondary),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(child: Container(height: 1, color: roles.line.subtle)),
          ],
        ),
      ),
    );
  }
}

/// `.sess`: 10px padding on the gutter, at least 56px; the time column and
/// the name baseline-aligned (wide) or stacked 4px apart (narrow); a
/// `line.subtle` hairline above every row of a day but the first, starting
/// at the name column (wide) or the gutter (narrow). One semantics node.
class _SessionRow extends StatelessWidget {
  const _SessionRow({
    super.key,
    required this.session,
    required this.narrow,
    required this.dividerAbove,
  });

  final GrandPrixScheduleSession session;
  final bool narrow;
  final bool dividerAbove;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final TextScaler scaler = MediaQuery.textScalerOf(context);
    final double timeColumn = GrandPrixSchedule.timeColumn(scaler);
    final Widget time = _time(roles, scaler);
    final Widget who = _who(roles);
    final Widget body = narrow
        ? Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[time, const SizedBox(height: 4), who],
          )
        : Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: <Widget>[
              SizedBox(width: timeColumn, child: time),
              const SizedBox(width: GrandPrixSchedule.columnGap),
              Expanded(child: who),
            ],
          );
    return MergeSemantics(
      child: Stack(
        children: <Widget>[
          ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 56),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: GvPrimerLayout.gutter,
                vertical: 10,
              ),
              child: body,
            ),
          ),
          if (dividerAbove)
            Positioned(
              top: 0,
              left: narrow
                  ? GvPrimerLayout.gutter
                  : GvPrimerLayout.gutter +
                        timeColumn +
                        GrandPrixSchedule.columnGap,
              right: GvPrimerLayout.gutter,
              height: 1,
              child: ColoredBox(color: roles.line.subtle),
            ),
        ],
      ),
    );
  }

  /// `.sess__time`: the 22px tabular clock (capped 28) and its 13px zone on
  /// one unbreakable line, then the second clock in 13px secondary. Empty
  /// for a session without a start time: no time is invented.
  Widget _time(GvPrimerRoles roles, TextScaler scaler) {
    final String? hm = session.time;
    if (hm == null) {
      // The prototype's empty cell: no height, no text.
      return const SizedBox.shrink(key: ValueKey<String>('session-time-none'));
    }
    final double size = GvPrimerTypography.cappedSize(scaler, 22, 28);
    final TextStyle secondary = GvPrimerTypography.archivo(
      size: 13,
      weight: 400,
      height: 1.3,
    ).copyWith(color: roles.text.secondary);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Text.rich(
          TextSpan(
            children: <InlineSpan>[
              TextSpan(
                text: hm,
                style:
                    GvPrimerTypography.archivo(
                      size: size,
                      weight: 800,
                      width: 112,
                      height: 1.1,
                      tabularFigures: true,
                    ).copyWith(
                      letterSpacing: -0.02 * size,
                      color: roles.text.primary,
                    ),
              ),
              TextSpan(
                text: ' ',
                style: GvPrimerTypography.body.copyWith(
                  fontSize: scaler.scale(GvPrimerLayout.bodyFontSize),
                ),
              ),
              TextSpan(
                text: session.zone,
                style: GvPrimerTypography.archivo(
                  size: scaler.scale(13),
                  weight: 700,
                ).copyWith(color: roles.text.secondary),
              ),
            ],
          ),
          key: const ValueKey<String>('session-time'),
          textScaler: TextScaler.noScaling,
          softWrap: false,
        ),
        if (session.secondaryTime case final String second) ...<Widget>[
          const SizedBox(height: 2),
          Text(
            second,
            key: const ValueKey<String>('session-time-secondary'),
            style: secondary,
          ),
        ],
      ],
    );
  }

  /// `.sess__who`: the 17px name (weight 750, `wdth` 86) and, 2px below,
  /// the status word in 13px secondary or its small chip.
  Widget _who(GvPrimerRoles roles) {
    final GvPrimerChipKind? kind = session.statusKind;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Text(
          session.name,
          key: const ValueKey<String>('session-name'),
          style: GvPrimerTypography.archivo(
            size: 17,
            weight: 750,
            width: 86,
            height: 1.25,
          ).copyWith(color: roles.text.primary),
        ),
        const SizedBox(height: 2),
        if (kind == null)
          Text(
            session.status,
            key: const ValueKey<String>('session-status'),
            style: GvPrimerTypography.archivo(
              size: 13,
              weight: 400,
              height: 1.3,
            ).copyWith(color: roles.text.secondary),
          )
        else
          GvPrimerStatusChip(
            key: const ValueKey<String>('session-status'),
            label: session.status,
            kind: kind,
            size: GvPrimerChipSize.small,
          ),
      ],
    );
  }
}
