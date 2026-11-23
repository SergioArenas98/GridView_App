import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';

import '../../../../core/media/media_image_loader.dart';
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../shared/presentation/widgets/primer_detail_parts.dart';

/// One labelled part of the banner's meta line: the stable constructor name
/// or the nationality, with the visually hidden term read before it
/// ("Team: Alpine", TM-02; "Nationality: French"). A `null` [term] reads
/// the value alone (a bare country code).
@immutable
class TeamBannerMeta {
  const TeamBannerMeta({
    required this.value,
    this.term,
    this.stableName = false,
  });

  final String value;
  final String? term;

  /// The stable constructor name (`.tb__stable`: a name, weight 750, primary
  /// text), as opposed to a fact (`.tb__nat`: weight 600, secondary).
  final bool stableName;

  String get semanticLabel => term == null ? value : '$term: $value';
}

/// The Team Detail entrant banner (`td.css` `.tb`, T01–T05; frozen
/// reference `light-rollout-b1/td-*`): season line, the season-aware entrant
/// name as the page heading, the stable constructor name when it differs
/// and the nationality, then the team-colour livery rail when a colour is
/// supplied.
///
/// - **Surface:** the heading band (`surface.band`), with the Dark sheen as
///   a second layer (cleared in Light, LT-13). Full width, square, no card.
/// - **Name:** `min(2.25rem, 40px)`, weight 820, `wdth` 90, line height
///   1.02, −0.018em, at most 15em wide, never truncated; lines are balanced
///   (CSS `text-wrap: balance`) by narrowing the box to the smallest width
///   that keeps the line count.
/// - **Meta:** the stable name (15px, 750, `wdth` 96, primary) and the
///   nationality (600, secondary), split by a 2px 12° `line.strong`
///   hairline; wraps.
/// - **Rail (XT-3):** a 3px pinstripe over the right 46% and a 12px bar
///   from the text edge to the right edge, 4px apart, both cut at 12°; the
///   supplied colour unchanged, with the 1px contextual boundary only when
///   it is below 3:1 against the band ([GvPrimerTeamMark]). Decorative.
/// - **Media (T05):** the constructor's **stable** imagery, never presented
///   as a season livery: a decorative layer behind everything under a
///   left-weighted scrim. While pending, after a failure and without a
///   request the banner renders exactly as without media (no placeholder,
///   XS-15).
///
/// Reading order (prototype DOM): the name, then the season line, then the
/// meta line (XS-03 pending).
class TeamBanner extends StatelessWidget {
  const TeamBanner({
    super.key,
    required this.name,
    required this.seasonLine,
    this.meta = const <TeamBannerMeta>[],
    this.teamColor,
    this.media,
  });

  /// The season-aware display name: the page's heading.
  final String name;

  /// `seasonLabel` with the ready state's season.
  final String seasonLine;

  /// The stable name (when it differs) and the nationality, in that order.
  final List<TeamBannerMeta> meta;

  /// The supplied team colour (season colour, else the constructor's), or
  /// `null` for no rail.
  final Color? teamColor;

  /// The resolved stable-imagery request, built from the banner's own
  /// context and width; `null` when the team has no usable media.
  final MediaImageRequest? Function(BuildContext context, double width)? media;

  /// Space between the bar and the pinstripe (`.tb__rail { gap: 4px }`).
  static const double railGap = 4;

  /// The pinstripe's share of the rail (`.tb__pin { width: 46% }`).
  static const double pinstripeShare = 0.46;

  /// The name's maximum width in `em` (`max-width: 15em`).
  static const double nameMaxEm = 15;

  /// The most lines a name is balanced over (Chromium's limit).
  static const int balanceMaxLines = 6;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final bool dark = Theme.of(context).brightness == Brightness.dark;
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        final double width = constraints.maxWidth;
        final MediaImageRequest? request = media?.call(context, width);
        final TextScaler scaler = MediaQuery.textScalerOf(context);
        final TextStyle ambient = DefaultTextStyle.of(context).style;
        final double textWidth = math.max(0, width - 2 * GvPrimerLayout.gutter);
        final Color? color = teamColor;
        return Semantics(
          key: const ValueKey<String>('team-banner'),
          container: true,
          explicitChildNodes: true,
          child: ClipRect(
            // The band, then (Dark) the sheen as its second background
            // layer, then the media and its scrim, then the content. The
            // clip also trims the rail's boundary at the banner's right and
            // bottom edges, as `.tb { overflow: hidden }`.
            child: ColoredBox(
              color: roles.surface.band,
              child: Stack(
                children: <Widget>[
                  if (dark)
                    Positioned.fill(
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: PrimerDetailHeading.darkSheen.toGradient(),
                        ),
                      ),
                    ),
                  if (request != null) ..._mediaLayer(roles, request, width),
                  Padding(
                    padding: EdgeInsets.only(
                      left: GvPrimerLayout.gutter,
                      top: 22,
                      bottom: color == null ? 24 : 0,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: <Widget>[
                        _textBlock(roles, scaler, ambient, textWidth),
                        if (color != null) ...<Widget>[
                          const SizedBox(height: 20),
                          _Rail(color: color, surface: roles.surface.band),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  List<Widget> _mediaLayer(
    GvPrimerRoles roles,
    MediaImageRequest request,
    double width,
  ) => <Widget>[
    Positioned.fill(
      child: GvRemoteImage(
        key: const ValueKey<String>('team-banner-media'),
        request: request,
        // Ignored under the tight constraints of the layer.
        aspectRatio: 16 / 9,
        logicalWidth: width,
        placeholderIcon: Icons.shield_outlined,
        borderRadius: BorderRadius.zero,
        decorative: true,
        // Missing, pending and failed media leave the banner exactly as
        // without media (XS-15).
        showPlaceholder: false,
      ),
    ),
    // `.tb__media::after`: band 0% → band 90% at 55% → band 55%.
    Positioned.fill(
      child: ExcludeSemantics(
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: <Color>[
                roles.surface.band,
                roles.surface.band.withValues(alpha: 0.9),
                roles.surface.band.withValues(alpha: 0.55),
              ],
              stops: const <double>[0, 0.55, 1],
            ),
          ),
        ),
      ),
    ),
  ];

  Widget _textBlock(
    GvPrimerRoles roles,
    TextScaler scaler,
    TextStyle ambient,
    double textWidth,
  ) {
    final double nameSize = GvPrimerTypography.cappedSize(scaler, 36, 40);
    final TextStyle nameStyle = GvPrimerTypography.archivo(
      size: nameSize,
      weight: 820,
      width: 90,
      height: 1.02,
    ).copyWith(letterSpacing: -0.018 * nameSize, color: roles.text.primary);
    final double nameBox = balancedWidth(
      name,
      ambient.merge(nameStyle),
      math.min(textWidth, nameMaxEm * nameSize),
    );
    return Padding(
      padding: const EdgeInsets.only(right: GvPrimerLayout.gutter),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Semantics(
            container: true,
            sortKey: const OrdinalSortKey(1),
            child: Text(
              seasonLine,
              key: const ValueKey<String>('team-banner-season'),
              style: GvPrimerTypography.archivo(
                size: 13,
                weight: 600,
                height: 1.2,
              ).copyWith(color: roles.text.secondary),
            ),
          ),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerLeft,
            child: SizedBox(
              width: nameBox,
              child: Semantics(
                container: true,
                sortKey: const OrdinalSortKey(0),
                header: true,
                child: Text(
                  name,
                  key: const ValueKey<String>('team-banner-name'),
                  textScaler: TextScaler.noScaling,
                  style: nameStyle,
                ),
              ),
            ),
          ),
          if (meta.isNotEmpty) ...<Widget>[
            const SizedBox(height: 12),
            Semantics(
              container: true,
              explicitChildNodes: true,
              sortKey: const OrdinalSortKey(2),
              child: _MetaLine(meta: meta),
            ),
            // The term list keeps its default 1em bottom margin
            // (`<dl class="tb__meta">` sets only its top margin): 15px at
            // 100%, 30px at 200%, before the rail or the banner's padding.
            SizedBox(height: GvPrimerLayout.containerEm(scaler, 1)),
          ],
        ],
      ),
    );
  }

  /// The width `text-wrap: balance` gives [text] in [style] within
  /// [maxWidth]: the narrowest box that keeps the greedy line count (up to
  /// [balanceMaxLines] lines), so the lines come out as even as the words
  /// allow. One line, or a name that already needs more lines, keeps
  /// [maxWidth].
  static double balancedWidth(String text, TextStyle style, double maxWidth) {
    if (maxWidth <= 0) return 0;
    int linesAt(double width) {
      final TextPainter painter = TextPainter(
        text: TextSpan(text: text, style: style),
        textDirection: TextDirection.ltr,
        textScaler: TextScaler.noScaling,
      )..layout(maxWidth: width);
      final int lines = painter.computeLineMetrics().length;
      painter.dispose();
      return lines;
    }

    final int target = linesAt(maxWidth);
    if (target <= 1 || target > balanceMaxLines) return maxWidth;
    double low = maxWidth / target;
    double high = maxWidth;
    while (high - low > 0.5) {
      final double mid = (low + high) / 2;
      if (linesAt(mid) <= target) {
        high = mid;
      } else {
        low = mid;
      }
    }
    // A hair of slack so the rendered paragraph never wraps one more time
    // than the measurement.
    return math.min(maxWidth, high.ceilToDouble() + 1);
  }
}

/// `.tb__meta`: the stable name and the nationality as one wrapping line,
/// 12px apart (2px between lines), the second introduced by a 2px × 0.95em
/// 12° `line.strong` hairline 12px before it. Each part is one semantics
/// node read with its hidden term.
class _MetaLine extends StatelessWidget {
  const _MetaLine({required this.meta});

  final List<TeamBannerMeta> meta;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final TextScaler scaler = MediaQuery.textScalerOf(context);
    TextStyle style(int index) => meta[index].stableName
        ? GvPrimerTypography.archivo(
            size: 15,
            weight: 750,
            width: 96,
            height: 1.35,
          ).copyWith(color: roles.text.primary)
        : GvPrimerTypography.archivo(
            size: 15,
            weight: 600,
            height: 1.35,
          ).copyWith(color: roles.text.secondary);
    Widget part(int i) => Semantics(
      container: true,
      label: meta[i].semanticLabel,
      child: ExcludeSemantics(
        child: Text(
          meta[i].value,
          key: ValueKey<String>('team-banner-meta-$i'),
          style: style(i),
        ),
      ),
    );
    return Wrap(
      spacing: 12,
      runSpacing: 2,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: <Widget>[
        for (int i = 0; i < meta.length; i++)
          if (i == 0)
            part(i)
          else
            Row(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                SizedBox(
                  width: 2,
                  height: 0.95 * scaler.scale(15),
                  child: DecoratedBox(
                    decoration: ShapeDecoration(
                      color: roles.line.strong,
                      shape: const GvLiveryCut(),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Flexible(child: part(i)),
              ],
            ),
      ],
    );
  }
}

/// `.tb__rail`: the pinstripe over the right 46%, 4px, then the bar from
/// the text edge to the right edge of the banner (XT-3).
class _Rail extends StatelessWidget {
  const _Rail({required this.color, required this.surface});

  final Color color;
  final Color surface;

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: Column(
      key: const ValueKey<String>('team-banner-rail'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Align(
          alignment: Alignment.centerRight,
          child: FractionallySizedBox(
            widthFactor: TeamBanner.pinstripeShare,
            child: GvPrimerTeamMark(
              key: const ValueKey<String>('team-banner-pinstripe'),
              shape: GvPrimerTeamShape.pinstripe,
              color: color,
              surface: surface,
            ),
          ),
        ),
        const SizedBox(height: TeamBanner.railGap),
        GvPrimerTeamMark(
          key: const ValueKey<String>('team-banner-bar'),
          shape: GvPrimerTeamShape.bar,
          color: color,
          surface: surface,
        ),
      ],
    ),
  );
}
