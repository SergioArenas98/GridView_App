import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../l10n/app_localizations.dart';

/// The pinned Calendar header (Calendar Stage 1, CT-03): the title row
/// (adaptive title, Refresh, Settings) and the season row, on the opaque page
/// colour with a hairline below. It sits outside the scroll view, so both rows
/// stay pinned while the caption, notices and rows scroll beneath it. No other
/// sticky element and no dynamic title release (Stage 2) exist.
class CalendarHeader extends StatelessWidget {
  const CalendarHeader({
    super.key,
    required this.onRefresh,
    required this.onOpenSettings,
    this.season,
  });

  final VoidCallback onRefresh;
  final VoidCallback onOpenSettings;

  /// "2026 season", or `null` while no season is known.
  final String? season;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    // Reading order follows the prototype's markup (title, Refresh, Settings,
    // season), not geometry: the 48dp buttons start above the title's text
    // box, so a geometric sort would read Refresh first.
    return Semantics(
      container: true,
      explicitChildNodes: true,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: roles.surface.page,
          border: Border(bottom: BorderSide(color: roles.line.subtle)),
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(GvPrimerLayout.gutter, 12, 12, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Row(
                children: <Widget>[
                  Expanded(
                    child: Semantics(
                      sortKey: const OrdinalSortKey(0),
                      child: CalendarTitle(l10n.calendarTitle),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Semantics(
                    sortKey: const OrdinalSortKey(1),
                    child: _CalendarIconButton(
                      key: const ValueKey<String>('calendar-refresh'),
                      icon: Icons.refresh,
                      label: l10n.calendarRefreshAction,
                      onPressed: onRefresh,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Semantics(
                    sortKey: const OrdinalSortKey(2),
                    child: _CalendarIconButton(
                      icon: Icons.settings_outlined,
                      label: l10n.settingsOpen,
                      onPressed: onOpenSettings,
                    ),
                  ),
                ],
              ),
              if (season case final String label)
                Transform.translate(
                  // `.appbar--sticky .season { margin-top: -4px }`.
                  offset: const Offset(0, -4),
                  child: Semantics(
                    container: true,
                    sortKey: const OrdinalSortKey(3),
                    child: Text(
                      label,
                      style: GvPrimerTypography.archivo(
                        size: GvPrimerLayout.bodyFontSize,
                        weight: 500,
                        height: 1.3,
                      ).copyWith(color: roles.text.secondary),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The adaptive screen title (CT-01, shared title fit rule S-2): the wordmark
/// size `min(1.5rem, 34px)`, weight 800, narrowing Archivo's width axis
/// 118 → 100 → 84 → 72 until the one word fits its column, and only then
/// scaling it down. Never an ellipsis, never wrapped; announced as the `h1`.
class CalendarTitle extends StatelessWidget {
  const CalendarTitle(this.text, {super.key});

  final String text;

  /// The width-axis steps, widest first.
  static const List<double> widths = <double>[118, 100, 84, 72];

  /// The style that fits [text] in [maxWidth], and its width step.
  static TextStyle fit(
    String text,
    double maxWidth,
    TextScaler scaler,
    TextDirection direction,
  ) {
    final double size = GvPrimerTypography.cappedSize(scaler, 24, 34);
    TextStyle styleFor(double width, double px) => GvPrimerTypography.archivo(
      size: px,
      weight: 800,
      width: width,
      height: 1.1,
    ).copyWith(letterSpacing: -0.02 * px);
    double measure(TextStyle style) {
      final TextPainter painter = TextPainter(
        text: TextSpan(text: text, style: style),
        textDirection: direction,
        maxLines: 1,
      )..layout();
      final double w = painter.width;
      painter.dispose();
      return w;
    }

    for (final double width in widths) {
      final TextStyle style = styleFor(width, size);
      if (measure(style) <= maxWidth + 1) return style;
    }
    final TextStyle narrowest = styleFor(widths.last, size);
    final double scaled =
        (size * maxWidth / measure(narrowest) * 100).floorToDouble() / 100;
    return styleFor(widths.last, scaled);
  }

  @override
  Widget build(BuildContext context) {
    final Color color = GvPrimerSurface.of(context).roles.text.primary;
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        final TextStyle style = fit(
          text,
          constraints.maxWidth,
          MediaQuery.textScalerOf(context),
          Directionality.of(context),
        );
        return Semantics(
          header: true,
          child: Text(
            text,
            maxLines: 1,
            softWrap: false,
            textScaler: TextScaler.noScaling,
            style: style.copyWith(color: color),
          ),
        );
      },
    );
  }
}

/// The 48dp round app-bar action (`.icon-btn`), as on Home: the primary-text
/// icon, `state.hover` from hovering pointers, `state.pressed.control` while
/// pressed (XT-5), the standard outer ring, one button node named by [label]
/// and the tooltip the legacy action had. (A second copy of Home's private
/// action; promoting one shared app-bar action is left to the shell step so
/// Home is not modified here.)
class _CalendarIconButton extends StatelessWidget {
  const _CalendarIconButton({
    super.key,
    required this.icon,
    required this.label,
    required this.onPressed,
  });

  final IconData icon;
  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    const BorderRadius round = BorderRadius.all(Radius.circular(24));
    return Tooltip(
      message: label,
      excludeFromSemantics: true,
      child: GvPrimerFocusTarget(
        onActivate: onPressed,
        semanticLabel: label,
        hoverColor: roles.surface.band,
        pressedColor: roles.state.pressedControl,
        fillRadius: round,
        child: SizedBox.square(
          dimension: GvPrimerLayout.minTarget,
          child: Center(child: Icon(icon, size: 24, color: roles.text.primary)),
        ),
      ),
    );
  }
}
