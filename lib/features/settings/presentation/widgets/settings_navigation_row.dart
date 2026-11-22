import 'dart:async';

import 'package:flutter/material.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/gv_primer_focus.dart';
import '../../../../core/widgets/gv_primer_icons.dart';
import '../../../../core/widgets/gv_primer_row_parts.dart';
import 'settings_group.dart';
import 'settings_primer_text.dart';
import 'settings_rows_density.dart';
import 'settings_selection_mark.dart';

/// What a Settings row shows at its end.
enum SettingsRowTrailing {
  /// The row chevron: the row opens a Settings screen.
  chevron,

  /// The mail glyph: Send feedback (owner decision 55C.13A-4, SETT-04). It
  /// replaces the chevron; there is no leading icon.
  mail,

  /// Nothing (a row that is not interactive).
  none,
}

/// Joins the parts of a composed accessible name, dropping every part that is
/// absent or blank so the result never carries a dangling separator (the
/// legacy `GvSettingsRow` rule, kept).
String settingsSpokenLabel(List<String?> parts) => parts
    .whereType<String>()
    .map((String part) => part.trim())
    .where((String part) => part.isNotEmpty)
    .join(', ');

/// A Settings root row (Step 55C.13A, `settings.css` `.srow`).
///
/// Flat on the page, no card; a 1px `line.subtle` hairline inset to the
/// gutter separates it from the row above ([divider]). Content:
/// - a title (17px, 600), optionally followed by a description (14px,
///   `text.secondary`); or
/// - a preference: the name as a label (14px, 600, `text.secondary`) above
///   its current value (19px, 750, `wdth` 92) with the small 12° mark
///   (owner decision 55C.13A-3).
///
/// At least 60px tall (12px vertical padding, 16px gutter), never clipped:
/// the row grows with its text. The trailing chevron or mail glyph sits 12px
/// after the text.
///
/// **Large text (owner decision SF-20, Step 55C.13AR).** The row spans its
/// list, so its width is the list's: the title and value take the list's
/// width-axis tier ([SettingsRowsDensity]), the same for every row, as the
/// reference's container query does. A single word that still would not fit
/// narrows further only within the role's approved steps (SETT-09).
///
/// **Interaction.** With [onActivate] the whole row is one button (one
/// focus stop) whose spoken name is title, value and description, in reading
/// order; Enter and Space activate it; pressed = `state.pressed.control`,
/// hover = `surface.band` (hovering devices only), focus = the Settings ring
/// ([settingsFocusGeometry]). Without it the row is static text: no chevron,
/// no hover, no focus stop, the title in `text.secondary`.
///
/// **Focus restoration (owner decision 55C.13A-9).** When the row was
/// activated from the keyboard (it had primary focus in keyboard highlight
/// mode) and the [onActivate] future completes (the opened route was
/// popped), the row takes focus back, if the keyboard is still the active
/// input. A touch activation never moves focus. No router change is
/// involved: the row awaits its own navigation.
class SettingsNavigationRow extends StatefulWidget {
  const SettingsNavigationRow({
    super.key,
    required this.title,
    this.value,
    this.description,
    this.onActivate,
    this.trailing = SettingsRowTrailing.chevron,
    this.divider = false,
  });

  final String title;

  /// The current preference value; when present the row uses the
  /// label-and-value layout.
  final String? value;
  final String? description;

  /// Opens the destination; the future completes when the opened route is
  /// popped (or at once for an action that opens no route).
  final Future<void> Function()? onActivate;
  final SettingsRowTrailing trailing;

  /// Draws the hairline above the row (every row but a group's first).
  final bool divider;

  /// `.srow { min-height: 60px }`.
  static const double minHeight = 60;

  @override
  State<SettingsNavigationRow> createState() => _SettingsNavigationRowState();
}

class _SettingsNavigationRowState extends State<SettingsNavigationRow> {
  final FocusNode _node = FocusNode(debugLabel: 'SettingsNavigationRow');

  @override
  void dispose() {
    _node.dispose();
    super.dispose();
  }

  bool get _keyboard =>
      FocusManager.instance.highlightMode == FocusHighlightMode.traditional;

  Future<void> _activate() async {
    final Future<void> Function()? open = widget.onActivate;
    if (open == null) return;
    final bool fromKeyboard = _node.hasPrimaryFocus && _keyboard;
    await open();
    if (!mounted || !fromKeyboard || !_keyboard) return;
    _node.requestFocus();
  }

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final bool interactive = widget.onActivate != null;
    final String label = settingsSpokenLabel(<String?>[
      widget.title,
      widget.value,
      widget.description,
    ]);
    // Measured below the row's semantics node, which stays its first render
    // object: the row is as wide as its list, so its width is the list's.
    final Widget visual = LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) => _visual(
        roles,
        interactive,
        SettingsRowsDensity.of(
          constraints.maxWidth,
          MediaQuery.textScalerOf(context),
        ),
      ),
    );
    if (!interactive) {
      return Semantics(
        container: true,
        label: label,
        child: ExcludeSemantics(child: visual),
      );
    }
    return GvPrimerFocusTarget(
      focusNode: _node,
      onActivate: () => unawaited(_activate()),
      semanticLabel: label,
      geometry: settingsFocusGeometry,
      pressedColor: roles.state.pressedControl,
      hoverColor: roles.surface.band,
      child: ExcludeSemantics(child: visual),
    );
  }

  Widget _visual(
    GvPrimerRoles roles,
    bool interactive,
    SettingsRowsDensity density,
  ) {
    return Stack(
      children: <Widget>[
        ConstrainedBox(
          constraints: const BoxConstraints(
            minHeight: SettingsNavigationRow.minHeight,
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: GvPrimerLayout.gutter,
              vertical: 12,
            ),
            child: Row(
              children: <Widget>[
                Expanded(child: _text(roles, interactive, density)),
                if (interactive &&
                    widget.trailing != SettingsRowTrailing.none) ...<Widget>[
                  const SizedBox(width: 12),
                  _trailing(roles),
                ],
              ],
            ),
          ),
        ),
        if (widget.divider)
          const GvPrimerRowDivider(
            start: GvPrimerLayout.gutter,
            end: GvPrimerLayout.gutter,
          ),
      ],
    );
  }

  Widget _text(
    GvPrimerRoles roles,
    bool interactive,
    SettingsRowsDensity density,
  ) {
    final String? value = widget.value;
    final String? description = widget.description;
    if (value != null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Text(
            widget.title,
            style: SettingsType.rowLabel.style().copyWith(
              color: roles.text.secondary,
            ),
          ),
          const SizedBox(height: 2),
          _Value(value: value, density: density),
        ],
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        SettingsFitText(
          widget.title,
          role: SettingsType.rowTitle,
          widths: density.titleWidths,
          color: interactive ? roles.text.primary : roles.text.secondary,
        ),
        if (description != null && description.trim().isNotEmpty) ...<Widget>[
          const SizedBox(height: 3),
          Text(
            description,
            style: SettingsType.rowDescription.style().copyWith(
              color: roles.text.secondary,
            ),
          ),
        ],
      ],
    );
  }

  Widget _trailing(GvPrimerRoles roles) => switch (widget.trailing) {
    SettingsRowTrailing.chevron => const GvPrimerRowChevron(),
    // `.srow__go--ext` slot: 20px glyph, 2px end margin.
    SettingsRowTrailing.mail => Padding(
      padding: const EdgeInsetsDirectional.only(end: 2),
      child: GvPrimerIcon(
        GvPrimerGlyph.mail,
        size: 20,
        color: roles.text.secondary,
      ),
    ),
    SettingsRowTrailing.none => const SizedBox.shrink(),
  };
}

/// `.srow__value`: the small 12° mark, the tier's gap (9px, 7px in a compact
/// list), then the value. The mark is centred on the value's first line
/// (`margin-top: calc((1.25em - 14px) / 2)`), whatever the text size.
class _Value extends StatelessWidget {
  const _Value({required this.value, required this.density});

  final String value;
  final SettingsRowsDensity density;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final TextScaler scaler = MediaQuery.textScalerOf(context);
    final double lineHeight =
        scaler.scale(SettingsType.rowValue.size) * SettingsType.rowValue.height;
    final double markTop =
        ((lineHeight - SettingsSelectionMark.valueSize.height) / 2)
            .clamp(0, double.infinity)
            .toDouble();
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Padding(
          padding: EdgeInsets.only(top: markTop),
          child: const SettingsSelectionMark.value(),
        ),
        SizedBox(width: density.markGap),
        Expanded(
          child: SettingsFitText(
            value,
            role: SettingsType.rowValue,
            widths: density.valueWidths,
            letterSpacing: density.valueLetterSpacing(scaler),
            color: roles.text.primary,
          ),
        ),
      ],
    );
  }
}
