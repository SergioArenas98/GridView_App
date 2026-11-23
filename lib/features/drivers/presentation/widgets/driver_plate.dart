import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';

import '../../../../core/media/media_image_loader.dart';
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../shared/presentation/widgets/primer_detail_parts.dart';

/// The number the board shows and the existing field label that names its
/// source (DR-03): the relevant span's race number ("Race number"), else the
/// permanent number ("Permanent number"). Never invented.
@immutable
class DriverPlateNumber {
  const DriverPlateNumber({required this.label, required this.figure});

  /// `driverRaceNumber` or `driverPermanentNumber`.
  final String label;

  /// The locale-formatted number, without `#`.
  final String figure;
}

/// The Driver Detail identity plate (`dd.css` `.dp`, D01–D06, DR-01..03).
///
/// A full-bleed band (Dark: `surface.band` under the 4.5% white sheen; Light:
/// the flat band, LT-13) carrying, left, the season line (DR-02), the
/// condensed name (the page's heading) and the nationality, and, right, the
/// Red Oxide number board: the decorative plate gradient (DK-6, LT-10)
/// behind a 12° leading edge that runs off the right edge, with the
/// number-source label, `#` + figure and the short code in Chalk.
///
/// **Stacked** (the name takes the full width; nationality and board share a
/// wrapping lower row) at or below 23em of the plate's body text, or 30em
/// when the board is wider than one digit or shows only a code; **bare**
/// (no board) without a number and a code. Nothing is truncated.
///
/// **Reading order** follows the prototype: heading → season line →
/// "Nationality: …" → the board's one text alternative ("Race number 1 ·
/// VER"); the visual digits are hidden (PD-06 / XS-03 still open).
///
/// **Portrait** (driver-owned media only, decorative): when a request
/// resolves, the existing `GvRemoteImage` slot fills the plate behind a
/// left-weighted scrim and never sizes it, so loading, failure and arrival
/// cannot move anything; while pending or after a failure the slot stays
/// empty (no placeholder icon, XS-15). Without a request (the approved media
/// inventory is empty) there is no layer at all (DR-01 difference 1).
class DriverPlate extends StatelessWidget {
  const DriverPlate({
    super.key,
    required this.name,
    required this.seasonLine,
    this.nationality,
    this.nationalityLabel,
    this.number,
    this.code,
    this.portrait,
    this.stackForUnbrokenName = false,
  });

  final String name;

  /// `seasonLabel` with the ready state's season.
  final String seasonLine;
  final String? nationality;

  /// The visually hidden "Nationality" term read before the value.
  final String? nationalityLabel;
  final DriverPlateNumber? number;
  final String? code;

  /// The resolved portrait request, built in the plate's layout from its
  /// own context and width; `null` when the driver has no usable portrait.
  final MediaImageRequest? Function(BuildContext context, double width)?
  portrait;

  /// DD-06 / XS-14 rule B (owner-approved Step 55C.9F; Driver Detail turns
  /// it on). When `true`, a plate that would be wide also stacks if the
  /// name's longest word, as rendered, is wider than the name column beside
  /// the board, so a word such as "Verstappen" is never split at about
  /// 346–360dp. `false` keeps only the 23em / 30em container widths.
  final bool stackForUnbrokenName;

  /// Minimum height of the wide plate (`.dp__grid`).
  static const double minHeight = 176;

  /// Gap between the text column and the board (`column-gap`).
  static const double columnGap = 18;

  /// Dark heading sheen (token map §5 "Sheen": white 4.5% on detail
  /// headings, cleared on the Light headings, LT-13):
  /// `linear-gradient(168deg, rgba(255,255,255,.045) 0%, transparent 46%)`.
  /// A contextual decorative value, not a role or token.
  /// Shared with the Team banner since Step 55C.10.
  static const GvPrimerGradient darkSheen = PrimerDetailHeading.darkSheen;

  bool get _hasBoard => number != null || code != null;

  /// A board wider than one digit, or a code-only board, stacks earlier
  /// (`.dp--wide`, found with "#33" at 390dp).
  bool get _wideBoard => number == null || number!.figure.length > 1;

  /// Whether a plate of [width] uses the stacked layout under [scaler].
  bool isStacked(double width, TextScaler scaler) =>
      width <= GvPrimerLayout.containerEm(scaler, 23) ||
      (_hasBoard &&
          _wideBoard &&
          width <= GvPrimerLayout.containerEm(scaler, 30));

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final bool dark = Theme.of(context).brightness == Brightness.dark;
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        final double width = constraints.maxWidth;
        final TextScaler scaler = MediaQuery.textScalerOf(context);
        final MediaImageRequest? request = portrait?.call(context, width);
        final TextStyle ambient = DefaultTextStyle.of(context).style;
        final _PlateText text = _PlateText(roles, scaler, ambient);
        final bool stacked =
            isStacked(width, scaler) ||
            (stackForUnbrokenName &&
                _hasBoard &&
                text.longestNameWord(name) >
                    _wideNameColumn(width, scaler, roles, ambient));
        final _Board? board = _hasBoard
            ? _Board(
                number: number,
                code: code,
                stacked: stacked,
                scaler: scaler,
                chalk: roles.fill.brand.on,
                ambient: ambient,
              )
            : null;
        final Widget content = stacked || board == null
            ? _stacked(text, board, width, stacked: stacked)
            : _wide(text, board);
        return Semantics(
          key: const ValueKey<String>('driver-plate'),
          container: true,
          explicitChildNodes: true,
          child: ClipRect(
            // The band, then (Dark) the sheen as its second background
            // layer, then the portrait and its scrim, then the content.
            child: ColoredBox(
              color: roles.surface.band,
              child: Stack(
                children: <Widget>[
                  if (dark)
                    Positioned.fill(
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: darkSheen.toGradient(),
                        ),
                      ),
                    ),
                  if (request != null) ...<Widget>[
                    Positioned.fill(
                      child: GvRemoteImage(
                        key: const ValueKey<String>('driver-plate-portrait'),
                        request: request,
                        // Ignored under the tight constraints of the layer.
                        aspectRatio: 1,
                        logicalWidth: width,
                        placeholderIcon: Icons.person_outline,
                        borderRadius: BorderRadius.zero,
                        decorative: true,
                        // Missing, pending and failed media leave the plate
                        // exactly as without a portrait (XS-15).
                        showPlaceholder: false,
                      ),
                    ),
                    Positioned.fill(
                      child: ExcludeSemantics(
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: <Color>[
                                roles.surface.band,
                                roles.surface.band.withValues(alpha: 0.86),
                                roles.surface.band.withValues(alpha: 0.2),
                              ],
                              stops: const <double>[0, 0.45, 1],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                  content,
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  /// The width the name gets beside the wide board (rule B only): the plate
  /// minus the wide board, the column gap and the name's left padding.
  double _wideNameColumn(
    double width,
    TextScaler scaler,
    GvPrimerRoles roles,
    TextStyle ambient,
  ) {
    final _Board wide = _Board(
      number: number,
      code: code,
      stacked: false,
      scaler: scaler,
      chalk: roles.fill.brand.on,
      ambient: ambient,
    );
    return width - wide.width - columnGap - GvPrimerLayout.gutter;
  }

  /// The wide plate: text column bottom-aligned on the left, the board the
  /// full height of the band on the right, at least [minHeight] tall.
  Widget _wide(_PlateText text, _Board board) {
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: minHeight),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  text.season(
                    seasonLine,
                    const EdgeInsets.fromLTRB(16, 24, 0, 0),
                  ),
                  text.name(
                    name,
                    EdgeInsets.fromLTRB(16, 8, 0, nationality == null ? 24 : 0),
                  ),
                  if (nationality != null)
                    text.nationality(
                      nationalityLabel,
                      nationality!,
                      const EdgeInsets.fromLTRB(16, 10, 0, 22),
                    ),
                ],
              ),
            ),
            const SizedBox(width: columnGap),
            board,
          ],
        ),
      ),
    );
  }

  /// The stacked plate (and the bare plate): the name the full width, then
  /// the wrapping lower row of nationality and board.
  Widget _stacked(
    _PlateText text,
    _Board? board,
    double width, {
    required bool stacked,
  }) {
    final double top = stacked ? 20 : 24;
    final EdgeInsets natPadding = stacked
        ? const EdgeInsets.fromLTRB(16, 14, 0, 20)
        : const EdgeInsets.fromLTRB(16, 10, 0, 22);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        text.season(seasonLine, EdgeInsets.fromLTRB(16, top, 16, 0)),
        text.name(
          name,
          EdgeInsets.fromLTRB(16, 8, 16, nationality == null ? 24 : 0),
        ),
        ?_foot(text, board, width, natPadding),
      ],
    );
  }

  Widget? _foot(
    _PlateText text,
    _Board? board,
    double width,
    EdgeInsets natPadding,
  ) {
    final Widget? nat = nationality == null
        ? null
        : text.nationality(nationalityLabel, nationality!, natPadding);
    final Widget? placed = board == null
        ? null
        : Padding(padding: const EdgeInsets.only(top: 14), child: board);
    if (nat == null && placed == null) return null;
    if (placed == null) return nat;
    if (nat == null) {
      return Align(alignment: Alignment.centerRight, child: placed);
    }
    // A flex row that wraps: the nationality never shrinks below its longest
    // word; when it and the board cannot share the row, the board drops to
    // its own line, still right-aligned.
    final double natMin =
        natPadding.left + text.longestWord(nationality!, text.natStyle);
    if (natMin + columnGap + board!.width <= width) {
      return Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: <Widget>[
          Expanded(child: nat),
          const SizedBox(width: columnGap),
          placed,
        ],
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        nat,
        Align(alignment: Alignment.centerRight, child: placed),
      ],
    );
  }
}

/// The plate's text column styles and builders.
class _PlateText {
  _PlateText(this.roles, this.scaler, this.ambient);

  final GvPrimerRoles roles;
  final TextScaler scaler;

  /// The inherited text style the plate's `Text` widgets merge with, so a
  /// measurement equals what renders.
  final TextStyle ambient;

  /// `.dp__season`: 13px (scales), 600, line height 1.2, secondary (DR-02;
  /// Grand Prix Detail's season-line type).
  TextStyle get seasonStyle => GvPrimerTypography.archivo(
    size: 13,
    weight: 600,
    height: 1.2,
  ).copyWith(color: roles.text.secondary);

  /// `.dp__nat`: 15px (scales), 600, line height 1.3, secondary.
  TextStyle get natStyle => GvPrimerTypography.archivo(
    size: 15,
    weight: 600,
    height: 1.3,
  ).copyWith(color: roles.text.secondary);

  Widget season(String value, EdgeInsets padding) => Padding(
    padding: padding,
    child: Semantics(
      container: true,
      sortKey: const OrdinalSortKey(1),
      child: Text(
        value,
        key: const ValueKey<String>('driver-plate-season'),
        style: seasonStyle,
      ),
    ),
  );

  /// `.dp__name`: `min(2.5rem, 44px)`, 800, `wdth` 78, line height 0.98,
  /// −0.015em; wraps, never truncated. The page's heading.
  /// `.dp__name` style at its rendered (capped) size, unscaled.
  TextStyle get nameStyle {
    final double size = GvPrimerTypography.cappedSize(scaler, 40, 44);
    return GvPrimerTypography.archivo(
      size: size,
      weight: 800,
      width: 78,
      height: 0.98,
    ).copyWith(letterSpacing: -0.015 * size, color: roles.text.primary);
  }

  /// The widest word of the name as rendered (rule B only).
  double longestNameWord(String value) {
    double widest = 0;
    for (final String word in value.split(RegExp(r'\s+'))) {
      if (word.isEmpty) continue;
      widest = math.max(
        widest,
        _measure(word, ambient.merge(nameStyle), TextScaler.noScaling).width,
      );
    }
    return widest;
  }

  Widget name(String value, EdgeInsets padding) => Padding(
    padding: padding,
    child: Semantics(
      container: true,
      sortKey: const OrdinalSortKey(0),
      header: true,
      child: Text(
        value,
        key: const ValueKey<String>('driver-plate-name'),
        textScaler: TextScaler.noScaling,
        style: nameStyle,
      ),
    ),
  );

  /// `.dp__nat` with its visually hidden term ("Nationality: Dutch").
  Widget nationality(String? label, String value, EdgeInsets padding) =>
      Padding(
        padding: padding,
        child: Semantics(
          container: true,
          sortKey: const OrdinalSortKey(2),
          label: label == null ? value : '$label: $value',
          child: ExcludeSemantics(
            child: Text(
              value,
              key: const ValueKey<String>('driver-plate-nationality'),
              style: natStyle,
            ),
          ),
        ),
      );

  /// The width of the longest word of [text] in [style] under the scaler:
  /// CSS `min-content`.
  double longestWord(String text, TextStyle style) {
    double widest = 0;
    for (final String word in text.split(RegExp(r'\s+'))) {
      if (word.isEmpty) continue;
      widest = math.max(
        widest,
        _measure(word, ambient.merge(style), scaler).width,
      );
    }
    return widest;
  }
}

Size _measure(String text, TextStyle style, TextScaler scaler) {
  final TextPainter painter = TextPainter(
    text: TextSpan(text: text, style: style),
    textDirection: TextDirection.ltr,
    textScaler: scaler,
    maxLines: 1,
  )..layout();
  final Size size = painter.size;
  painter.dispose();
  return size;
}

/// The Red Oxide number board (`.dp__plate`): Chalk content bottom-right,
/// its width computed from the same text metrics the layout uses, so the
/// stacked row can decide whether nationality and board share a line.
class _Board extends StatelessWidget {
  _Board({
    required this.number,
    required this.code,
    required this.stacked,
    required this.scaler,
    required this.chalk,
    required this.ambient,
  }) {
    _layOut();
  }

  final DriverPlateNumber? number;
  final String? code;
  final bool stacked;
  final TextScaler scaler;
  final Color chalk;

  /// The inherited text style the board's `Text` widgets merge with, so the
  /// measured widths equal the rendered ones.
  final TextStyle ambient;

  /// How far the gradient layer runs past the right edge (`inset: 0 -48px 0
  /// 0`); the plate clips it.
  static const double overrun = 48;

  late final TextStyle _labelStyle;
  late final TextStyle _hashStyle;
  late final TextStyle _figureStyle;
  late final TextStyle _codeStyle;
  late final EdgeInsets _padding;
  late final double _labelWidth;
  late final double _codeShift;

  /// The board's outer width.
  late final double width;

  void _layOut() {
    final double bodyEm = scaler.scale(15);
    final double hashSize = stacked
        ? GvPrimerTypography.cappedSize(scaler, 18, 22)
        : GvPrimerTypography.cappedSize(scaler, 22, 26);
    final double figureSize = stacked
        ? GvPrimerTypography.cappedSize(scaler, 64, 72)
        : GvPrimerTypography.cappedSize(scaler, 96, 104);
    final bool codeOnly = number == null;
    final double codeSize = codeOnly
        ? GvPrimerTypography.cappedSize(scaler, 36, 40)
        : scaler.scale(15);
    final double codeTracking = codeOnly ? 0.04 : 0.14;
    _labelStyle = GvPrimerTypography.archivo(
      size: scaler.scale(13),
      weight: 700,
      height: 1.2,
    ).copyWith(color: chalk);
    _hashStyle = GvPrimerTypography.archivo(
      size: hashSize,
      weight: 800,
      height: 1,
    ).copyWith(color: chalk);
    _figureStyle = GvPrimerTypography.archivo(
      size: figureSize,
      weight: 850,
      width: 125,
      height: 0.8,
      tabularFigures: true,
    ).copyWith(letterSpacing: -0.04 * figureSize, color: chalk);
    _codeStyle = GvPrimerTypography.archivo(
      size: codeSize,
      weight: 800,
      width: 112,
      height: 1,
    ).copyWith(letterSpacing: codeTracking * codeSize, color: chalk);
    _codeShift = codeTracking * codeSize;
    _padding = stacked
        ? EdgeInsets.fromLTRB(math.max(30, 1.5 * bodyEm), 14, 16, 16)
        : const EdgeInsets.fromLTRB(40, 18, 16, 20);

    double content = 0;
    if (number != null) {
      // `.dp__lab`: max-width 6.5em (stacked 5em) of its own 13px, but
      // never narrower than its longest word; a wrapped label takes the
      // full measure, as the CSS block does.
      final double measure = (stacked ? 5 : 6.5) * scaler.scale(13);
      double longest = 0;
      for (final String word in number!.label.split(' ')) {
        longest = math.max(
          longest,
          _measure(
            word,
            ambient.merge(_labelStyle),
            TextScaler.noScaling,
          ).width,
        );
      }
      final double full = _measure(
        number!.label,
        ambient.merge(_labelStyle),
        TextScaler.noScaling,
      ).width;
      // Rounded up, so the measured width never wraps the text it measured.
      _labelWidth = math.max(math.min(full, measure), longest).ceilToDouble();
      final double figureRow =
          _measure('#', ambient.merge(_hashStyle), TextScaler.noScaling).width +
          0.18 * hashSize +
          _measure(
            number!.figure,
            ambient.merge(_figureStyle),
            TextScaler.noScaling,
          ).width;
      content = math.max(_labelWidth, figureRow);
    } else {
      _labelWidth = 0;
    }
    if (code != null) {
      content = math.max(
        content,
        _measure(code!, ambient.merge(_codeStyle), TextScaler.noScaling).width -
            _codeShift,
      );
    }
    width = math.max(
      stacked ? 80 : 96,
      // Rounded up: the measured text widths are fractional.
      (_padding.left + content + _padding.right).ceilToDouble(),
    );
  }

  String get _semanticLabel => <String>[
    if (number != null) '${number!.label} ${number!.figure}',
    ?code,
  ].join(' · ');

  @override
  Widget build(BuildContext context) {
    final double hashSize = _hashStyle.fontSize!;
    return Semantics(
      sortKey: const OrdinalSortKey(3),
      container: true,
      label: _semanticLabel,
      child: ExcludeSemantics(
        child: SizedBox(
          key: const ValueKey<String>('driver-plate-board'),
          width: width,
          child: Stack(
            clipBehavior: Clip.none,
            children: <Widget>[
              Positioned(
                left: 0,
                top: 0,
                bottom: 0,
                right: -overrun,
                child: DecoratedBox(
                  decoration: ShapeDecoration(
                    gradient: GvPrimerEffects.brandGradientPlate.toGradient(),
                    shape: const GvLiveryCut(edges: GvLiveryCutEdges.leading),
                  ),
                ),
              ),
              Padding(
                padding: _padding,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: <Widget>[
                    if (number != null) ...<Widget>[
                      SizedBox(
                        width: _labelWidth,
                        child: Text(
                          number!.label,
                          textAlign: TextAlign.right,
                          textScaler: TextScaler.noScaling,
                          style: _labelStyle,
                        ),
                      ),
                      SizedBox(height: stacked ? 8 : 10),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Padding(
                            padding: EdgeInsets.only(
                              top: 0.2 * hashSize,
                              right: 0.18 * hashSize,
                            ),
                            child: Text(
                              '#',
                              textScaler: TextScaler.noScaling,
                              style: _hashStyle,
                            ),
                          ),
                          Text(
                            number!.figure,
                            key: const ValueKey<String>('driver-plate-figure'),
                            textScaler: TextScaler.noScaling,
                            style: _figureStyle,
                          ),
                        ],
                      ),
                    ],
                    if (code != null) ...<Widget>[
                      if (number != null) SizedBox(height: stacked ? 10 : 14),
                      // `margin-right: -<tracking>`: the tracking after the
                      // last letter sits in the padding.
                      Transform.translate(
                        offset: Offset(_codeShift, 0),
                        child: Text(
                          code!,
                          key: const ValueKey<String>('driver-plate-code'),
                          textScaler: TextScaler.noScaling,
                          style: _codeStyle,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
