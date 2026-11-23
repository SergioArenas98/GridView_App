import 'package:flutter/material.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';

/// One labelled value of an Explore row's data line ("Position" / "2").
@immutable
class ExploreDatum {
  const ExploreDatum(this.label, this.value);

  final String label;
  final String value;

  @override
  bool operator ==(Object other) =>
      other is ExploreDatum && other.label == label && other.value == value;

  @override
  int get hashCode => Object.hash(label, value);

  @override
  String toString() => 'ExploreDatum($label, $value)';
}

/// Which identity figure a row carries on its right-hand rail.
enum ExploreFigureKind {
  /// The driver's race number with the short code under it (`.ent__fig`,
  /// 28px capped 32, `wdth` 118). At large text it leads the row, inline.
  driver,

  /// The circuit's length with its unit (`.ent--circuit .ent__fig-num`, 24px
  /// capped 30, `wdth` 106). At large text it follows the details, inline.
  circuit,
}

/// The Explore entity row (EX-02 Alternative B,
/// `explore/comparison-missing-media/cue.html`; Light: LT-1 B Motorsport;
/// tick: XT-3).
///
/// A reference-library line: identity (name, secondary lines, the team's
/// line-up codes, the labelled data line), then an optional identity figure
/// on a right-hand rail, then the row chevron (EX-02 element 2, PD-17). The
/// whole row is one link whose accessible name is [semanticLabel]; every
/// visible text is hidden from semantics so nothing is read twice.
///
/// - **No media column** ([media] `null`, the approved Alternative B): a 16px
///   accent lane after the gutter holds the decorative team-colour tick, and
///   every name starts on the same line whether or not a colour exists.
/// - **Media column** ([media] non-null): the collection has at least one
///   media reference, so every row reserves the same slot before anything
///   loads and no load, failure or absence moves the text. The per-list
///   media rule is still **Pending decision** (PD-16 / EXP-04); this keeps
///   the existing Flutter slot (see `explore_cards.dart`).
///
/// At or below `20em` (300px at 100% text) the row stacks: a driver's number
/// and code lead the row on one line, a circuit's length follows its
/// details, the chevron sits at the top. Nothing is truncated: names wrap.
class ExploreEntityRow extends StatelessWidget {
  const ExploreEntityRow({
    super.key,
    required this.name,
    required this.semanticLabel,
    required this.onOpen,
    this.subLines = const <String>[],
    this.codes,
    this.data = const <ExploreDatum>[],
    this.figure,
    this.figureCaption,
    this.figureKind = ExploreFigureKind.driver,
    this.accent,
    this.media,
    this.dividerAbove = false,
  });

  final String name;

  /// Secondary lines under the name (`.ent__sub`), each its own line.
  final List<String> subLines;

  /// The team's line-up codes as one tracked line (`.ent__codes`).
  final String? codes;

  /// The labelled data line (`.ent__data`); empty for none.
  final List<ExploreDatum> data;

  /// The identity figure ("44", "5.793"), or `null` for none.
  final String? figure;

  /// The caption under (or, at large text, after) the figure ("HAM", "km").
  final String? figureCaption;
  final ExploreFigureKind figureKind;

  /// The supplied team colour, drawn as the 12° tick; `null` draws none.
  final Color? accent;

  /// The list's image slot for this row, or `null` when the list has no
  /// media column.
  final Widget? media;

  final String semanticLabel;

  /// Opens the entity; `null` disables the row.
  final VoidCallback? onOpen;

  /// Draws the hairline above the row (every row but the first).
  final bool dividerAbove;

  /// The accent lane between the gutter and the text (no media column).
  static const double lane = 16;

  /// The existing Flutter row image slot (media column only).
  static const double mediaSlot = 40;
  static const double mediaGap = 14;

  /// Gap between the identity, the figure and the chevron.
  static const double columnGap = 16;

  /// The team tick: 3px (XT-3), 40px long, 18px from the row top.
  static const double tickTop = 18;
  static const double tickLength = 40;

  /// The narrow layout applies at or below this container width in `em`.
  static const double narrowEm = 20;

  /// Where the text column (and the hairline) starts.
  double get textStart => media == null
      ? GvPrimerLayout.gutter + lane
      : GvPrimerLayout.gutter + mediaSlot + mediaGap;

  /// Where the tick starts: in the lane, or in the gutter beside the slot.
  double get tickStart => media == null ? GvPrimerLayout.gutter : 6;

  static final String _noBreakSpace = String.fromCharCode(0x00A0);

  /// [text] with its spaces made unbreakable (a date, a datum value).
  static String keepTogether(String text) =>
      text.replaceAll(' ', _noBreakSpace);

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        final TextScaler scaler = MediaQuery.textScalerOf(context);
        final bool narrow =
            constraints.maxWidth <=
            GvPrimerLayout.containerEm(scaler, narrowEm);
        final Color? colour = accent;
        return Stack(
          children: <Widget>[
            GvPrimerFocusTarget(
              onActivate: onOpen,
              role: GvPrimerTargetRole.link,
              semanticLabel: semanticLabel,
              geometry: GvPrimerFocusGeometry.row,
              pressedColor: roles.state.pressedRow,
              hoverColor: roles.state.hover,
              child: Padding(
                // `.ent__link`: 14px top, 15px bottom; the chevron's
                // `margin-right: -4px` on the gutter.
                padding: EdgeInsets.fromLTRB(
                  media == null ? textStart : GvPrimerLayout.gutter,
                  14,
                  GvPrimerLayout.gutter - 4,
                  15,
                ),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(minHeight: 76 - 14 - 15),
                  child: ExcludeSemantics(
                    child: _content(context, roles, scaler, narrow),
                  ),
                ),
              ),
            ),
            if (dividerAbove)
              GvPrimerRowDivider(start: textStart, end: GvPrimerLayout.gutter),
            if (colour != null)
              Positioned(
                left: tickStart,
                top: tickTop,
                width: GvPrimerTeamMark.thicknessOf(GvPrimerTeamShape.tick),
                height: tickLength,
                child: IgnorePointer(
                  child: GvPrimerTeamMark(
                    key: const ValueKey<String>('explore-tick'),
                    shape: GvPrimerTeamShape.tick,
                    color: colour,
                    length: tickLength,
                  ),
                ),
              ),
          ],
        );
      },
    );
  }

  Widget _content(
    BuildContext context,
    GvPrimerRoles roles,
    TextScaler scaler,
    bool narrow,
  ) {
    final Widget body = _body(roles, narrow);
    final Widget? fig = _figure(roles, scaler, narrow);
    const Widget chevron = GvPrimerRowChevron(size: 16);

    final Widget text;
    final Widget row;
    if (!narrow) {
      text = Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Expanded(child: body),
          if (fig != null) ...<Widget>[const SizedBox(width: columnGap), fig],
        ],
      );
      // Grid `align-items: start` with the chevron `align-self: center`: the
      // identity and figure sit at the top of the 76px row, the chevron in
      // its vertical centre.
      row = Stack(
        children: <Widget>[
          Padding(
            padding: const EdgeInsetsDirectional.only(end: columnGap + 16),
            child: text,
          ),
          const PositionedDirectional(
            top: 0,
            bottom: 0,
            end: 0,
            child: Center(child: chevron),
          ),
        ],
      );
    } else {
      final bool figureFirst = figureKind == ExploreFigureKind.driver;
      text = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          if (fig != null && figureFirst) ...<Widget>[
            fig,
            const SizedBox(height: 4),
          ],
          body,
          if (fig != null && !figureFirst) ...<Widget>[
            const SizedBox(height: 8),
            fig,
          ],
        ],
      );
      row = Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Expanded(child: text),
          const SizedBox(width: columnGap),
          // `.ent__go { align-self: start; margin-top: 4px }`.
          const Padding(padding: EdgeInsets.only(top: 4), child: chevron),
        ],
      );
    }
    final Widget? slot = media;
    if (slot == null) return row;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        SizedBox(width: mediaSlot, height: mediaSlot, child: slot),
        const SizedBox(width: mediaGap),
        Expanded(child: row),
      ],
    );
  }

  Widget _body(GvPrimerRoles roles, bool narrow) {
    final TextStyle nameStyle = GvPrimerTypography.archivo(
      size: 17,
      weight: 750,
      // Alternative A/B relax the name to `wdth` 94 without the slot; the
      // narrow container keeps the baseline's 86.
      width: narrow || media != null ? 86 : 94,
      height: 1.2,
    ).copyWith(letterSpacing: -0.005 * 17, color: roles.text.primary);
    final TextStyle subStyle = GvPrimerTypography.archivo(
      size: 14,
      weight: 400,
      height: 1.35,
    ).copyWith(color: roles.text.secondary);
    final String? lineup = codes;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          name,
          key: const ValueKey<String>('explore-row-name'),
          style: nameStyle,
        ),
        for (final String line in subLines)
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text(line, style: subStyle),
          ),
        if (lineup != null)
          Padding(
            padding: const EdgeInsets.only(top: 3),
            child: Text(
              lineup,
              key: const ValueKey<String>('explore-row-codes'),
              style: GvPrimerTypography.archivo(
                size: 13,
                weight: 700,
                height: 1.35,
              ).copyWith(letterSpacing: 0.06 * 13, color: roles.text.primary),
            ),
          ),
        if (data.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Wrap(
              key: const ValueKey<String>('explore-row-data'),
              spacing: 14,
              runSpacing: 2,
              children: <Widget>[
                for (final ExploreDatum datum in data) _datum(roles, datum),
              ],
            ),
          ),
      ],
    );
  }

  /// A label and its value: together when they fit, apart when they do not
  /// ("Unidad de potencia / Mercedes" at 200%); the value never breaks.
  Widget _datum(GvPrimerRoles roles, ExploreDatum datum) {
    final TextStyle base = GvPrimerTypography.archivo(
      size: 13,
      weight: 600,
      height: 1.35,
    );
    return Wrap(
      spacing: 4,
      children: <Widget>[
        Text(datum.label, style: base.copyWith(color: roles.text.secondary)),
        Text(
          keepTogether(datum.value),
          style: GvPrimerTypography.archivo(
            size: 13,
            weight: 700,
            height: 1.35,
            tabularFigures: true,
          ).copyWith(color: roles.text.primary),
        ),
      ],
    );
  }

  Widget? _figure(GvPrimerRoles roles, TextScaler scaler, bool narrow) {
    final String? value = figure;
    final String? caption = figureCaption;
    if (value == null && caption == null) return null;
    final bool circuit = figureKind == ExploreFigureKind.circuit;
    final TextStyle numberStyle = GvPrimerRowType.figure(
      size: circuit
          ? GvPrimerTypography.cappedSize(scaler, 24, 30)
          : GvPrimerTypography.cappedSize(scaler, 28, 32),
      width: circuit ? 106 : 118,
    ).copyWith(color: roles.text.primary);
    final TextStyle captionStyle = GvPrimerTypography.archivo(
      size: 13,
      weight: 700,
      height: 1.2,
    ).copyWith(letterSpacing: 0.04 * 13, color: roles.text.secondary);
    final Widget? number = value == null
        ? null
        : Text(
            value,
            key: const ValueKey<String>('explore-row-figure'),
            softWrap: false,
            textScaler: TextScaler.noScaling,
            style: numberStyle,
          );
    final Widget? cap = caption == null
        ? null
        : Text(
            caption,
            key: const ValueKey<String>('explore-row-figure-caption'),
            softWrap: false,
            style: captionStyle,
          );
    if (narrow) {
      // Without a slot to share the first line with, the figure is set
      // inline ("43 COL", "5.793 km").
      return Row(
        key: const ValueKey<String>('explore-row-fig'),
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: <Widget>[
          ?number,
          if (number != null && cap != null) const SizedBox(width: 8),
          ?cap,
        ],
      );
    }
    return Column(
      key: const ValueKey<String>('explore-row-fig'),
      crossAxisAlignment: CrossAxisAlignment.end,
      children: <Widget>[
        ?number,
        if (number != null && cap != null) const SizedBox(height: 4),
        ?cap,
      ],
    );
  }
}
