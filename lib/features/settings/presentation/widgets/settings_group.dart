import 'package:flutter/material.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/gv_primer_focus.dart';
import 'settings_primer_text.dart';

/// Focus ring of every Settings row and option (`settings.css`
/// `.srow:focus-visible, .opt:focus-visible { outline-offset: -3px;
/// border-radius: 6px }`): 2px, 3px inside, 6px corner, in the page focus
/// colour (Ember in Dark, Graphite in Light).
const GvPrimerFocusGeometry settingsFocusGeometry = GvPrimerFocusGeometry(
  offset: GvPrimerMetrics.focusOffsetRow,
  radius: GvPrimerMetrics.focusRingRadius,
);

/// A Settings group (`settings.css` `.sgroup` + `.kicker`): a kicker heading
/// in `text.secondary` with a trailing rule, then its rows.
///
/// - 20px above the first group, 28px above the others; 6px below the kicker.
/// - The kicker is a heading (`h2` in the prototype; Flutter has no heading
///   levels) and wraps; the rule takes the rest of the line (at least 24px)
///   and is vertically centred on the kicker.
/// - [dashed] draws the Developer group's rule dashed in `line.strong`
///   (Primer's "not confirmed" pattern), 1.5px; otherwise a 1px
///   `line.subtle` rule.
class SettingsGroup extends StatelessWidget {
  const SettingsGroup({
    super.key,
    required this.title,
    required this.children,
    this.first = false,
    this.dashed = false,
  }) : _top = null,
       _kickerGap = 6;

  /// A section of a Settings information screen (Step 55C.13B,
  /// `information.css` `.isec`): 32px above, 4px between the kicker and its
  /// content; the kicker and its rule are the group's.
  const SettingsGroup.information({
    super.key,
    required this.title,
    required this.children,
  }) : first = false,
       dashed = false,
       _top = 32,
       _kickerGap = 4;

  final String title;
  final List<Widget> children;
  final bool first;
  final bool dashed;
  final double? _top;
  final double _kickerGap;

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(top: _top ?? (first ? 20 : 28)),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Padding(
          padding: EdgeInsets.fromLTRB(
            GvPrimerLayout.gutter,
            0,
            GvPrimerLayout.gutter,
            _kickerGap,
          ),
          child: _Kicker(title: title, dashed: dashed),
        ),
        ...children,
      ],
    ),
  );
}

class _Kicker extends StatelessWidget {
  const _Kicker({required this.title, required this.dashed});

  final String title;
  final bool dashed;

  static const double _gap = 12;
  static const double _minRule = 24;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final TextStyle style = SettingsType.kicker.style().copyWith(
      color: roles.text.secondary,
    );
    final Widget rule = dashed
        ? CustomPaint(
            size: const Size.fromHeight(1.5),
            painter: SettingsDashedRulePainter(roles.line.strong),
          )
        : SizedBox(height: 1, child: ColoredBox(color: roles.line.subtle));
    final Widget text = Semantics(
      header: true,
      child: Text(title, style: style),
    );
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        // The kicker keeps its natural width while the rule still gets its
        // 24px minimum; a longer kicker wraps and the rule keeps 24px.
        final TextPainter painter = TextPainter(
          text: TextSpan(
            text: title,
            style: DefaultTextStyle.of(context).style.merge(style),
          ),
          textDirection: Directionality.of(context),
          textScaler: MediaQuery.textScalerOf(context),
          maxLines: 1,
        )..layout();
        final double natural = painter.width;
        painter.dispose();
        final bool roomy =
            natural + _gap + _minRule <= constraints.maxWidth + 0.5;
        return Row(
          children: <Widget>[
            if (roomy) text else Expanded(child: text),
            const SizedBox(width: _gap),
            if (roomy)
              Expanded(child: rule)
            else
              SizedBox(width: _minRule, child: rule),
          ],
        );
      },
    );
  }
}

/// `border-top: 1.5px dashed` with the shared Primer dash pattern
/// ([GvPrimerMetrics.dashLength] / [GvPrimerMetrics.dashGap]).
class SettingsDashedRulePainter extends CustomPainter {
  const SettingsDashedRulePainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final Paint paint = Paint()
      ..color = color
      ..strokeWidth = size.height
      ..isAntiAlias = true;
    final double y = size.height / 2;
    const double step = GvPrimerMetrics.dashLength + GvPrimerMetrics.dashGap;
    for (double x = 0; x < size.width; x += step) {
      final double end = (x + GvPrimerMetrics.dashLength).clamp(0, size.width);
      canvas.drawLine(Offset(x, y), Offset(end, y), paint);
    }
  }

  @override
  bool shouldRepaint(SettingsDashedRulePainter oldDelegate) =>
      oldDelegate.color != color;
}
