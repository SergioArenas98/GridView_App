import 'package:flutter/material.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/gv_primer_focus.dart';
import '../../../../core/widgets/gv_primer_row_parts.dart';
import 'settings_group.dart';
import 'settings_navigation_row.dart';
import 'settings_primer_text.dart';
import 'settings_selection_mark.dart';

/// One option of a [SettingsOptionList], already reduced to localized copy.
@immutable
class SettingsOptionData {
  const SettingsOptionData({
    required this.key,
    required this.label,
    required this.selected,
    required this.onSelected,
    this.description,
  });

  final Key key;
  final String label;
  final String? description;
  final bool selected;
  final VoidCallback onSelected;
}

/// The options of one Settings preference (Step 55C.13A, `settings.css`
/// `.opts`): flat rows on the page, a 1px `line.subtle` hairline inset to the
/// gutter between consecutive options.
class SettingsOptionList extends StatelessWidget {
  const SettingsOptionList({super.key, required this.options});

  final List<SettingsOptionData> options;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: <Widget>[
      for (int i = 0; i < options.length; i++)
        SettingsOption(
          key: options[i].key,
          label: options[i].label,
          description: options[i].description,
          selected: options[i].selected,
          onSelected: options[i].onSelected,
          divider: i > 0,
        ),
    ],
  );
}

/// One selectable option (`settings.css` `.opt`).
///
/// Layout: the 26 × 20 selection mark ([SettingsSelectionMark.option]), 16px,
/// then the label (17px, 550; 800 when selected) and its explanation (15px,
/// `text.secondary`, at most 34em wide), at least 64px tall with 18px
/// vertical padding. The mark is centred on the label's first line.
///
/// **Semantics (owner decisions 55C.13A-6 to -8).** One node, one focus
/// stop: a radio in a mutually exclusive group with its `checked` and
/// `selected` state, and a button with a tap action, as the legacy option.
/// Its name is the label followed by the explanation (kept in the label, not
/// a hint); the literal ", Selected" suffix is no longer appended, because
/// the checked state already announces selection. Enter and Space select;
/// there is no arrow-key radio navigation.
///
/// Pressed = `state.pressed.control`, hover = `surface.band`, focus = the
/// Settings ring.
class SettingsOption extends StatelessWidget {
  const SettingsOption({
    super.key,
    required this.label,
    required this.selected,
    required this.onSelected,
    this.description,
    this.divider = false,
  });

  final String label;
  final String? description;
  final bool selected;
  final VoidCallback onSelected;
  final bool divider;

  /// `.opt { min-height: 64px }`.
  static const double minHeight = 64;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final TextScaler scaler = MediaQuery.textScalerOf(context);
    final String? explanation = description;
    final double labelLine =
        scaler.scale(SettingsType.optionLabel.size) *
        SettingsType.optionLabel.height;
    final double markTop =
        ((labelLine - SettingsSelectionMark.optionSize.height) / 2)
            .clamp(0, double.infinity)
            .toDouble();
    final double descriptionMax =
        34 * scaler.scale(SettingsType.optionDescription.size);
    final Widget visual = Stack(
      children: <Widget>[
        ConstrainedBox(
          constraints: const BoxConstraints(minHeight: minHeight),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: GvPrimerLayout.gutter,
              vertical: 18,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Padding(
                  padding: EdgeInsets.only(top: markTop),
                  child: SettingsSelectionMark.option(selected: selected),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      SettingsFitText(
                        label,
                        role: SettingsType.optionLabel,
                        color: roles.text.primary,
                        weight: selected
                            ? SettingsType.optionLabelSelectedWeight
                            : SettingsType.optionLabel.weight,
                        measureWeight: SettingsType.optionLabelSelectedWeight,
                      ),
                      if (explanation != null &&
                          explanation.trim().isNotEmpty) ...<Widget>[
                        const SizedBox(height: 4),
                        ConstrainedBox(
                          constraints: BoxConstraints(maxWidth: descriptionMax),
                          child: Text(
                            explanation,
                            style: SettingsType.optionDescription
                                .style()
                                .copyWith(color: roles.text.secondary),
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
        if (divider)
          const GvPrimerRowDivider(
            start: GvPrimerLayout.gutter,
            end: GvPrimerLayout.gutter,
          ),
      ],
    );
    return GvPrimerFocusTarget(
      onActivate: onSelected,
      selected: selected,
      geometry: settingsFocusGeometry,
      pressedColor: roles.state.pressedControl,
      hoverColor: roles.surface.band,
      // Merged into the target's node: the radio state and the full name.
      child: Semantics(
        inMutuallyExclusiveGroup: true,
        checked: selected,
        label: settingsSpokenLabel(<String?>[label, explanation]),
        child: ExcludeSemantics(child: visual),
      ),
    );
  }
}
