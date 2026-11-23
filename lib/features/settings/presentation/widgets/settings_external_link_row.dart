import 'dart:async';

import 'package:flutter/material.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/gv_primer_focus.dart';
import '../../../../core/widgets/gv_primer_icons.dart';
import '../../../../core/widgets/gv_primer_row_parts.dart';
import 'settings_group.dart';
import 'settings_information.dart';
import 'settings_primer_text.dart';
import 'settings_rows_density.dart';

/// A Settings row that opens a destination outside GridView (Step 55C.13B,
/// `information.css` `.xrow`): the Settings row with the open-in-new glyph
/// at its end **instead of** the in-app chevron, so it never looks like a
/// row that navigates inside GridView.
///
/// - Title 17px, 600 (the root row's title, with its list's width-axis tier,
///   SF-20); then, when given, a value (16px, 650), a displayed address
///   (15px, 500, `text.secondary`, free to break anywhere because a path
///   has no word boundaries) and a description (14px, `text.secondary`, at
///   most 34em).
/// - At least 60px tall, 12px × 16px padding, never clipped; [divider] draws
///   the inset hairline above it (`.xlinks` rows all have one).
/// - **Interaction (SF-13).** One button, one focus stop, whose accessible
///   name is title, value, address and description in reading order: a
///   meaningful label, never a URL in its place. Enter and Space activate
///   it; pressed, hover and focus as the root rows. The destination itself
///   is never shown or spoken beyond the displayed address the record
///   supplies.
/// - [descriptionLocale] marks a description whose language is reliably
///   known (provider-supplied English).
class SettingsExternalLinkRow extends StatelessWidget {
  const SettingsExternalLinkRow({
    super.key,
    required this.title,
    required this.onActivate,
    this.value,
    this.address,
    this.description,
    this.descriptionLocale,
    this.divider = false,
  });

  final String title;
  final String? value;
  final String? address;
  final String? description;
  final Locale? descriptionLocale;

  /// Hands the destination to the platform; completes when the hand-off
  /// has been attempted.
  final Future<void> Function() onActivate;
  final bool divider;

  /// `.srow { min-height: 60px }`.
  static const double minHeight = 60;

  /// The trailing glyph's size (`.xrow__glyph`).
  static const double glyphSize = 20;

  @override
  Widget build(BuildContext context) {
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    return GvPrimerFocusTarget(
      onActivate: () => unawaited(onActivate()),
      geometry: settingsFocusGeometry,
      pressedColor: roles.state.pressedControl,
      hoverColor: roles.surface.band,
      child: Semantics(
        attributedLabel: settingsAttributedLabel(<SettingsSpokenPart>[
          SettingsSpokenPart(title),
          SettingsSpokenPart(value),
          SettingsSpokenPart(address),
          SettingsSpokenPart(description, locale: descriptionLocale),
        ]),
        child: ExcludeSemantics(
          child: LayoutBuilder(
            builder: (BuildContext context, BoxConstraints constraints) =>
                _visual(
                  context,
                  roles,
                  SettingsRowsDensity.of(
                    constraints.maxWidth,
                    MediaQuery.textScalerOf(context),
                  ),
                ),
          ),
        ),
      ),
    );
  }

  Widget _visual(
    BuildContext context,
    GvPrimerRoles roles,
    SettingsRowsDensity density,
  ) {
    final String? value = this.value;
    final String? address = this.address;
    final String? description = this.description;
    return Stack(
      children: <Widget>[
        ConstrainedBox(
          constraints: const BoxConstraints(minHeight: minHeight),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: GvPrimerLayout.gutter,
              vertical: 12,
            ),
            child: Row(
              children: <Widget>[
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      SettingsFitText(
                        title,
                        role: SettingsType.rowTitle,
                        widths: density.titleWidths,
                        color: roles.text.primary,
                      ),
                      if (value != null && value.isNotEmpty) ...<Widget>[
                        const SizedBox(height: 2),
                        Text(
                          value,
                          style: SettingsType.linkValue.style().copyWith(
                            color: roles.text.primary,
                          ),
                        ),
                      ],
                      if (address != null && address.isNotEmpty) ...<Widget>[
                        const SizedBox(height: 2),
                        Text(
                          address,
                          style: SettingsType.linkAddress.style().copyWith(
                            color: roles.text.secondary,
                          ),
                        ),
                      ],
                      if (description != null &&
                          description.trim().isNotEmpty) ...<Widget>[
                        const SizedBox(height: 3),
                        SettingsMeasure(
                          size: SettingsType.rowDescription.size,
                          em: SettingsType.linkDescriptionMeasureEm,
                          child: Text(
                            description,
                            style: SettingsType.rowDescription.style().copyWith(
                              color: roles.text.secondary,
                              locale: descriptionLocale,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Padding(
                  padding: const EdgeInsetsDirectional.only(end: 2),
                  child: GvPrimerIcon(
                    GvPrimerGlyph.openExternal,
                    size: glyphSize,
                    color: roles.text.secondary,
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
  }
}
