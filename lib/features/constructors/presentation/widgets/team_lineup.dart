import 'package:flutter/widgets.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';

/// One line-up row's presentation data: a participation span, already
/// formatted. Every optional part is omitted when absent, never invented.
@immutable
class TeamLineupEntry {
  const TeamLineupEntry({
    required this.entryId,
    required this.name,
    required this.linkLabel,
    required this.role,
    required this.onOpen,
    this.number,
    this.code,
    this.span,
  });

  /// The participation entry: unique within the line-up, so it keys the row.
  final String entryId;
  final String name;

  /// "Open driver {name}": the row's accessible name.
  final String linkLabel;
  final String role;
  final VoidCallback onOpen;

  /// The formatted race number, or `null`.
  final String? number;
  final String? code;

  /// The observed participation span ("Until round 6"), or `null` when no
  /// boundary was observed: such a row never claims a period.
  final String? span;

  bool get hasFigure => number != null || code != null;
}

/// The visually hidden terms of a line-up row, read before their values
/// (`driverRaceNumber`, `fieldParticipation`, `fieldRole`).
@immutable
class TeamLineupTerms {
  const TeamLineupTerms({
    required this.raceNumber,
    required this.participation,
    required this.role,
  });

  final String raceNumber;
  final String participation;
  final String role;
}

/// The Team Detail line-up (`td.css` `.lu`, T10–T14): one row per
/// participation span, exactly in the order supplied (the read model's
/// roster order), so a returning driver keeps one row per span.
///
/// When no row has a number or a code the list is plain (`.lu--plain`): no
/// figure column and no seam. The seam carries the team colour when one is
/// supplied, with the XT-3 contextual boundary against the page; without a
/// colour it is a `line.strong` hairline. At or below 20em (320dp at 200%)
/// each row narrows: number and code share the first line with the
/// chevron, the driver and the facts take the full width below, and the
/// seam is dropped.
class TeamLineup extends StatelessWidget {
  const TeamLineup({
    super.key,
    required this.entries,
    required this.terms,
    this.teamColor,
  });

  final List<TeamLineupEntry> entries;
  final TeamLineupTerms terms;
  final Color? teamColor;

  /// Narrow at or below this container width in `em` (`@container lu
  /// (max-width: 20em)`).
  static const double narrowEm = 20;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (BuildContext context, BoxConstraints constraints) {
      final bool narrow =
          constraints.maxWidth <=
          GvPrimerLayout.containerEm(
            MediaQuery.textScalerOf(context),
            narrowEm,
          );
      final bool plain = !entries.any((TeamLineupEntry e) => e.hasFigure);
      return Column(
        key: const ValueKey<String>('team-lineup'),
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          for (final (int i, TeamLineupEntry e) in entries.indexed)
            TeamLineupRow(
              key: ValueKey<String>('team-lineup-${e.entryId}'),
              entry: e,
              terms: terms,
              teamColor: teamColor,
              figureColumn: !plain,
              narrow: narrow,
              dividerAbove: i > 0,
            ),
        ],
      );
    },
  );
}

/// One line-up row (`.lu__row`): the figure column (number over code,
/// right-aligned, 3.5em), the 2px seam, the driver and the facts, the 16px
/// chevron; at least 72px tall, 14px padding on the gutter, 14px column gap.
///
/// The whole row is the link to the driver, announced as
/// [TeamLineupEntry.linkLabel]; the visible name is hidden inside it, and
/// the number ("Race number 7"), the code, the span ("Participation, Until
/// round 6") and the role ("Role, Race driver") follow as their own nodes,
/// each exactly once (TD difference 7, XS-04 pending). Ring 3px inside,
/// pressed `state.pressed.row`, hover `state.hover`.
class TeamLineupRow extends StatelessWidget {
  const TeamLineupRow({
    super.key,
    required this.entry,
    required this.terms,
    this.teamColor,
    this.figureColumn = true,
    this.narrow = false,
    this.dividerAbove = false,
  });

  final TeamLineupEntry entry;
  final TeamLineupTerms terms;
  final Color? teamColor;

  /// Whether the list has a figure column and a seam (not `.lu--plain`).
  final bool figureColumn;

  /// The narrow layout (`@container lu (max-width: 20em)`).
  final bool narrow;
  final bool dividerAbove;

  /// Minimum row height (`.lu__row { min-height: 72px }`).
  static const double minHeight = 72;

  /// Column gap (`column-gap: 14px`).
  static const double columnGap = 14;

  /// The figure column in `em` of the 15px body text (`3.5em`).
  static const double figureEm = 3.5;

  /// The seam's height bounds (`min-height: 36px; max-height: 56px`).
  static const double seamMin = 36;
  static const double seamMax = 56;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final TextScaler scaler = MediaQuery.textScalerOf(context);
    final _RowText text = _RowText(roles, scaler);
    final Widget body = _body(text);
    final Widget? figure = figureColumn && entry.hasFigure
        ? _Figure(entry: entry, terms: terms, text: text, narrow: narrow)
        : null;
    const Widget chevron = GvPrimerRowChevron(size: 16);
    // `margin-right: -4px`: the chevron's box reaches 4px into the gutter.
    final Widget go = Transform.translate(
      offset: const Offset(4, 0),
      child: chevron,
    );

    final Widget content = !figureColumn
        ? _plain(body, go)
        : narrow
        ? Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Row(
                children: <Widget>[
                  Expanded(child: figure ?? const SizedBox.shrink()),
                  const SizedBox(width: columnGap),
                  go,
                ],
              ),
              const SizedBox(height: 6),
              body,
            ],
          )
        : _wide(scaler, figure, body, go);

    final Widget row = Stack(
      children: <Widget>[
        Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: GvPrimerLayout.gutter,
            vertical: 14,
          ),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: minHeight - 28),
            child: Center(widthFactor: 1, child: content),
          ),
        ),
        if (dividerAbove)
          const GvPrimerRowDivider(
            start: GvPrimerLayout.gutter,
            end: GvPrimerLayout.gutter,
          ),
      ],
    );
    return GvPrimerFocusTarget(
      onActivate: entry.onOpen,
      role: GvPrimerTargetRole.link,
      semanticLabel: entry.linkLabel,
      geometry: GvPrimerFocusGeometry.row,
      pressedColor: roles.state.pressedRow,
      hoverColor: roles.state.hover,
      child: row,
    );
  }

  /// `"body go"` (`.lu--plain`, both widths): no figure column, no seam.
  static Widget _plain(Widget body, Widget go) => Row(
    children: <Widget>[
      Expanded(child: body),
      const SizedBox(width: columnGap),
      go,
    ],
  );

  /// `"car seam body go"`: figure column, seam, body and chevron centred on
  /// the row. The seam column reserves the seam's 36px minimum; the seam
  /// itself is laid over it the full height of the row, capped at 56px from
  /// the top (CSS `align-self: stretch` with `max-height`).
  Widget _wide(TextScaler scaler, Widget? figure, Widget body, Widget go) {
    final double figureWidth = GvPrimerLayout.containerEm(scaler, figureEm);
    final double seamWidth = GvPrimerTeamMark.thicknessOf(
      GvPrimerTeamShape.seam,
    );
    return Stack(
      children: <Widget>[
        Row(
          children: <Widget>[
            SizedBox(
              width: figureWidth,
              child: Align(
                alignment: Alignment.centerRight,
                heightFactor: 1,
                child: figure ?? const SizedBox.shrink(),
              ),
            ),
            const SizedBox(width: columnGap),
            SizedBox(width: seamWidth, height: seamMin),
            const SizedBox(width: columnGap),
            Expanded(child: body),
            const SizedBox(width: columnGap),
            go,
          ],
        ),
        Positioned(
          left: figureWidth + columnGap,
          top: 0,
          bottom: 0,
          width: seamWidth,
          child: _Seam(color: teamColor),
        ),
      ],
    );
  }

  Widget _body(_RowText text) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    mainAxisSize: MainAxisSize.min,
    children: <Widget>[
      // Inside the link the name is part of its label (`aria-hidden`).
      ExcludeSemantics(
        child: Text(
          entry.name,
          key: const ValueKey<String>('team-lineup-name'),
          textScaler: TextScaler.noScaling,
          style: text.name,
        ),
      ),
      const SizedBox(height: 4),
      Wrap(
        spacing: 14,
        runSpacing: 2,
        crossAxisAlignment: WrapCrossAlignment.end,
        children: <Widget>[
          if (entry.span case final String span)
            _fact(
              terms.participation,
              span,
              text.span,
              const ValueKey<String>('team-lineup-span'),
            ),
          _fact(terms.role, entry.role, text.fact, null),
        ],
      ),
    ],
  );

  /// One fact read as one unit with its hidden term ("Role, Race driver").
  static Widget _fact(String term, String value, TextStyle style, Key? key) =>
      MergeSemantics(
        child: Semantics(
          label: term,
          child: Text(value, key: key, style: style),
        ),
      );
}

/// The seam (`.lu__seam`): 2px, both edges at 12°, the row's height
/// between 36 and 56px (from the top when capped). The team colour with the
/// XT-3 boundary against the page, else a `line.strong` hairline.
class _Seam extends StatelessWidget {
  const _Seam({this.color});

  final Color? color;

  @override
  Widget build(BuildContext context) {
    final double width = GvPrimerTeamMark.thicknessOf(GvPrimerTeamShape.seam);
    final Widget shape = color == null
        ? DecoratedBox(
            decoration: ShapeDecoration(
              color: GvPrimerSurface.of(context).roles.line.strong,
              shape: const GvLiveryCut(),
            ),
          )
        : GvPrimerTeamMark(shape: GvPrimerTeamShape.seam, color: color!);
    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxHeight: TeamLineupRow.seamMax),
        child: SizedBox(
          key: const ValueKey<String>('team-lineup-seam'),
          width: width,
          height: double.infinity,
          child: ExcludeSemantics(child: shape),
        ),
      ),
    );
  }
}

/// `.lu__car`: the race number over the code, right-aligned (wide), or on
/// one baseline, left-aligned, 10px apart (narrow).
class _Figure extends StatelessWidget {
  const _Figure({
    required this.entry,
    required this.terms,
    required this.text,
    required this.narrow,
  });

  final TeamLineupEntry entry;
  final TeamLineupTerms terms;
  final _RowText text;
  final bool narrow;

  @override
  Widget build(BuildContext context) {
    final Widget? number = entry.number == null
        ? null
        : Semantics(
            container: true,
            label: '${terms.raceNumber} ${entry.number}',
            child: ExcludeSemantics(
              child: Text(
                entry.number!,
                key: const ValueKey<String>('team-lineup-number'),
                textScaler: TextScaler.noScaling,
                // A figure is never split: wider than the 3.5em column it
                // overflows towards the start, as the CSS flex item does.
                softWrap: false,
                overflow: TextOverflow.visible,
                textAlign: narrow ? TextAlign.start : TextAlign.end,
                style: text.number,
              ),
            ),
          );
    final Widget? code = entry.code == null
        ? null
        : Semantics(
            container: true,
            child: Text(
              entry.code!,
              key: const ValueKey<String>('team-lineup-code'),
              textScaler: TextScaler.noScaling,
              style: text.code,
            ),
          );
    if (narrow) {
      return Wrap(
        spacing: 10,
        crossAxisAlignment: WrapCrossAlignment.end,
        children: <Widget>[?number, ?code],
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        ?number,
        if (number != null && code != null) const SizedBox(height: 6),
        if (code != null)
          // `margin-right: -0.12em`: the trailing tracking hangs outside.
          Transform.translate(
            offset: Offset(0.12 * text.codeSize, 0),
            child: code,
          ),
      ],
    );
  }
}

/// The row's text styles.
class _RowText {
  _RowText(this.roles, this.scaler);

  final GvPrimerRoles roles;
  final TextScaler scaler;

  /// `.lu__num`: `min(1.75rem, 32px)`, 850, `wdth` 125, −0.04em, line
  /// height 0.9, tabular.
  TextStyle get number {
    final double size = GvPrimerTypography.cappedSize(scaler, 28, 32);
    return GvPrimerTypography.archivo(
      size: size,
      weight: 850,
      width: 125,
      height: 0.9,
      tabularFigures: true,
    ).copyWith(letterSpacing: -0.04 * size, color: roles.text.primary);
  }

  /// The code's rendered size (13px, scaled).
  double get codeSize => scaler.scale(13);

  /// `.lu__code`: 13px, 800, `wdth` 112, 0.12em tracking, line height 1,
  /// secondary.
  /// Render with [TextScaler.noScaling]: the size is already scaled.
  TextStyle get code => GvPrimerTypography.archivo(
    size: codeSize,
    weight: 800,
    width: 112,
    height: 1,
  ).copyWith(letterSpacing: 0.12 * codeSize, color: roles.text.secondary);

  /// `.lu__name`: `min(1.1875rem, 30px)`, 800, `wdth` 84, line height 1.15.
  TextStyle get name => GvPrimerTypography.archivo(
    size: GvPrimerTypography.cappedSize(scaler, 19, 30),
    weight: 800,
    width: 84,
    height: 1.15,
  ).copyWith(color: roles.text.primary);

  /// `.lu__facts`: 14px, line height 1.35, secondary.
  TextStyle get fact => GvPrimerTypography.archivo(
    size: 14,
    weight: 400,
    height: 1.35,
  ).copyWith(color: roles.text.secondary);

  /// `.lu__span`: the observed boundary in `text.accent` (Ember on Dark,
  /// Red Oxide on Light), weight 700, tabular.
  TextStyle get span => GvPrimerTypography.archivo(
    size: 14,
    weight: 700,
    height: 1.35,
    tabularFigures: true,
  ).copyWith(color: roles.text.accent);
}
