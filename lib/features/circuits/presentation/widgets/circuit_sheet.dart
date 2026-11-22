import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/media/media_image_loader.dart';
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../shared/presentation/widgets/primer_detail_parts.dart';
import 'circuit_facts.dart';

/// The circuit's own media, when the profile selected an asset (CI04).
@immutable
class CircuitSheetMedia {
  const CircuitSheetMedia({this.request, this.semanticLabel});

  /// The resolved request, or `null` when the selected asset has no
  /// acceptable variant (shown as the failed fallback).
  final MediaImageRequest? request;

  /// "Track layout of {circuit}" for a layout diagram (informative);
  /// `null` for a photograph (decorative).
  final String? semanticLabel;
}

/// The Circuit Detail sheet (`cd.css` `.ch`, CI01–CI08, Step 55C.11): the
/// circuit's stable identity in one band, nothing season-scoped.
///
/// A full-bleed band (Dark: `surface.band` under the 4.5% white sheen;
/// Light: the flat band, light-b2 §3) with 24px top padding on the gutter:
///
/// 1. the name (the page's heading): Primer's most condensed cut, `wdth` 72,
///    `min(2.5rem, 44px)` (`min(2.125rem, 36px)` on a narrow sheet), weight
///    820, line height 0.98, −0.012em, at most 14em wide, balanced, never
///    truncated; a hyphenated word of up to 18 characters is kept whole
///    (`.nobr`);
/// 2. the location, secondary, 15px weight 600, 10px below;
/// 3. the media frame, only when an asset was selected ([media]);
/// 4. the "Circuit facts" kicker (an `h2`) and the facts ([facts]), 24px
///    below, closing the band 20px under the last fact. Without facts the
///    band closes 26px under its last line (`.ch--bare`).
///
/// "Narrow" is the CSS container query `@container ch (max-width: 21em)` on
/// the band's content box.
class CircuitSheet extends StatelessWidget {
  const CircuitSheet({
    super.key,
    required this.name,
    this.location,
    this.media,
    this.facts,
  });

  final String name;
  final String? location;

  /// Built from the sheet's own context and content width; `null` when no
  /// asset is selected (no slot at all).
  final CircuitSheetMedia? Function(BuildContext context, double width)? media;

  /// The physical facts, or `null` when the profile has none
  /// (`hasPhysicalFacts`).
  final CircuitFactsData? facts;

  /// The name's maximum width in `em` (`max-width: 14em`).
  static const double nameMaxEm = 14;

  /// The longest hyphenated word kept on one line (`.nobr`).
  static const int unbrokenHyphenatedMax = 18;

  /// The most lines a name is balanced over (Chromium's limit).
  static const int balanceMaxLines = 6;

  /// Whether a sheet whose content box is [contentWidth] wide is narrow.
  static bool isNarrow(double contentWidth, TextScaler scaler) =>
      contentWidth <= GvPrimerLayout.containerEm(scaler, 21);

  /// [value] with a word joiner after each hyphen of a word of at most
  /// [unbrokenHyphenatedMax] characters, so "Spa-Francorchamps" never
  /// breaks after "Spa-" (CSS `.nobr`). Longer words keep their break.
  static String keepShortHyphenatedWords(String value) => value.splitMapJoin(
    RegExp(r'\S+'),
    onMatch: (Match m) {
      final String word = m[0]!;
      if (!word.contains('-') || word.length > unbrokenHyphenatedMax) {
        return word;
      }
      return word.replaceAll('-', '-⁠');
    },
  );

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final bool dark = Theme.of(context).brightness == Brightness.dark;
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        final double content = math.max(
          0,
          constraints.maxWidth - 2 * GvPrimerLayout.gutter,
        );
        final TextScaler scaler = MediaQuery.textScalerOf(context);
        final bool narrow = isNarrow(content, scaler);
        final CircuitSheetMedia? slot = media?.call(context, content);
        final CircuitFactsData? data = facts;
        return Semantics(
          key: const ValueKey<String>('circuit-sheet'),
          container: true,
          explicitChildNodes: true,
          child: ColoredBox(
            color: roles.surface.band,
            child: DecoratedBox(
              // Dark: the sheen as the band's second background layer.
              decoration: BoxDecoration(
                gradient: dark
                    ? PrimerDetailHeading.darkSheen.toGradient()
                    : null,
              ),
              child: Padding(
                padding: EdgeInsets.fromLTRB(
                  GvPrimerLayout.gutter,
                  24,
                  GvPrimerLayout.gutter,
                  data == null ? 26 : 0,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    _name(context, roles, scaler, content, narrow),
                    if (location case final String place) ...<Widget>[
                      const SizedBox(height: 10),
                      Text(
                        place,
                        key: const ValueKey<String>('circuit-sheet-location'),
                        style: GvPrimerTypography.archivo(
                          size: 15,
                          weight: 600,
                          height: 1.35,
                        ).copyWith(color: roles.text.secondary),
                      ),
                    ],
                    if (slot != null) ...<Widget>[
                      const SizedBox(height: 20),
                      CircuitMediaFrame(media: slot, width: content),
                    ],
                    if (data != null) ...<Widget>[
                      const SizedBox(height: 24),
                      CircuitFacts(data: data, narrow: narrow),
                    ],
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _name(
    BuildContext context,
    GvPrimerRoles roles,
    TextScaler scaler,
    double content,
    bool narrow,
  ) {
    final double size = narrow
        ? GvPrimerTypography.cappedSize(scaler, 34, 36)
        : GvPrimerTypography.cappedSize(scaler, 40, 44);
    final TextStyle style = GvPrimerTypography.archivo(
      size: size,
      weight: 820,
      width: 72,
      height: 0.98,
    ).copyWith(letterSpacing: -0.012 * size, color: roles.text.primary);
    final String shown = keepShortHyphenatedWords(name);
    final double box = balancedWidth(
      shown,
      DefaultTextStyle.of(context).style.merge(style),
      math.min(content, nameMaxEm * size),
    );
    return Align(
      alignment: Alignment.centerLeft,
      child: SizedBox(
        width: box,
        child: Semantics(
          container: true,
          header: true,
          child: Text(
            shown,
            key: const ValueKey<String>('circuit-sheet-name'),
            semanticsLabel: name,
            textScaler: TextScaler.noScaling,
            style: style,
          ),
        ),
      ),
    );
  }

  /// The width `text-wrap: balance` gives [text] in [style] within
  /// [maxWidth]: the narrowest box that keeps the greedy line count (up to
  /// [balanceMaxLines] lines). The same rule as the Team banner name
  /// (Step 55C.10), kept local so the Circuit feature does not depend on
  /// the Team feature.
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
    // Never narrower than the longest unbreakable word (words are split at
    // whitespace; a word joiner keeps "Spa-Francorchamps" one word): CSS
    // balancing never breaks inside a word, while a too-narrow Flutter box
    // would split it between characters.
    double longest = 0;
    for (final String word in text.split(RegExp(r'\s+'))) {
      if (word.isEmpty) continue;
      final TextPainter painter = TextPainter(
        text: TextSpan(text: word, style: style),
        textDirection: TextDirection.ltr,
        textScaler: TextScaler.noScaling,
      )..layout();
      longest = math.max(longest, painter.width);
      painter.dispose();
    }
    double low = math.min(maxWidth, math.max(maxWidth / target, longest));
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

/// The 16:9 media frame (`.ch__media`): reserved from the first frame,
/// because the asset is selected before the first paint, so loading,
/// failure and arrival never move the page.
///
/// The frame is the deep page tone (`--ground-low`: Graphite 950 in Dark,
/// the Light band in Light) with eight 14 × 1.5px secondary registration
/// marks at its corners. Pending: the empty frame. Failed (or a selected
/// asset with no acceptable variant): the decorative 32px route glyph,
/// secondary, centred. A layout diagram is announced with its label; a
/// photograph is decorative. No production media exists (CD-12).
class CircuitMediaFrame extends StatelessWidget {
  const CircuitMediaFrame({
    super.key,
    required this.media,
    required this.width,
  });

  final CircuitSheetMedia media;
  final double width;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final bool dark = roles.brightness == Brightness.dark;
    final Color ground = dark
        ? GvPrimerPalette.graphite950
        : GvPrimerPalette.neutralLightBand;
    final Widget failed = Center(
      key: const ValueKey<String>('circuit-media-failed'),
      child: GvPrimerIcon(
        GvPrimerGlyph.circuit,
        size: 32,
        color: roles.text.secondary,
      ),
    );
    final MediaImageRequest? request = media.request;
    final Widget image = request == null
        ? AspectRatio(aspectRatio: 16 / 9, child: failed)
        : GvRemoteImage(
            key: const ValueKey<String>('circuit-media'),
            request: request,
            aspectRatio: 16 / 9,
            logicalWidth: width,
            placeholderIcon: Icons.route_outlined,
            borderRadius: BorderRadius.zero,
            decorative: media.semanticLabel == null,
            semanticLabel: media.semanticLabel,
            showPlaceholder: false,
            failedPlaceholder: failed,
          );
    final Widget framed = CustomPaint(
      key: const ValueKey<String>('circuit-media-frame'),
      painter: _RegistrationMarks(ground: ground, mark: roles.text.secondary),
      child: image,
    );
    if (request != null) return framed;
    // No request: the frame is the failed fallback; the diagram label is
    // still the slot's name when the asset is a diagram.
    return media.semanticLabel == null
        ? ExcludeSemantics(child: framed)
        : Semantics(image: true, label: media.semanticLabel, child: framed);
  }
}

/// The frame fill and its eight corner marks (14 × 1.5px each).
class _RegistrationMarks extends CustomPainter {
  const _RegistrationMarks({required this.ground, required this.mark});

  final Color ground;
  final Color mark;

  static const double length = 14;
  static const double thickness = 1.5;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(Offset.zero & size, Paint()..color = ground);
    final Paint paint = Paint()..color = mark;
    final double r = size.width;
    final double b = size.height;
    for (final Rect rect in <Rect>[
      const Rect.fromLTWH(0, 0, length, thickness),
      const Rect.fromLTWH(0, 0, thickness, length),
      Rect.fromLTWH(r - length, 0, length, thickness),
      Rect.fromLTWH(r - thickness, 0, thickness, length),
      Rect.fromLTWH(0, b - thickness, length, thickness),
      Rect.fromLTWH(0, b - length, thickness, length),
      Rect.fromLTWH(r - length, b - thickness, length, thickness),
      Rect.fromLTWH(r - thickness, b - length, thickness, length),
    ]) {
      canvas.drawRect(rect, paint);
    }
  }

  @override
  bool shouldRepaint(_RegistrationMarks old) =>
      old.ground != ground || old.mark != mark;
}
