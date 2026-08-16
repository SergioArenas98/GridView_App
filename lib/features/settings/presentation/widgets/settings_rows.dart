import 'package:flutter/material.dart';

import '../../../../core/theme/theme.dart';

/// Joins the parts of a composed accessible name, dropping every part that is
/// absent or blank so the result never carries a dangling separator.
String _spoken(List<String?> parts) => parts
    .whereType<String>()
    .map((String part) => part.trim())
    .where((String part) => part.isNotEmpty)
    .join(', ');

/// A Settings row: a title, the current value, and a chevron.
///
/// Low decoration on purpose — Settings is a secondary screen, not a dashboard.
/// The whole row is one button with a complete label, at least
/// [GvLayout.minTouchTarget] tall, and it grows rather than clips at large text
/// scales. The value is always already-localized copy; a wire token is never
/// displayed.
class GvSettingsRow extends StatelessWidget {
  const GvSettingsRow({
    super.key,
    required this.title,
    this.value,
    this.description,
    this.icon,
    this.onTap,
  });

  final String title;
  final String? value;
  final String? description;
  final IconData? icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final GvSemanticColors colors = context.gvColors;
    return Semantics(
      button: onTap != null,
      // Everything the row shows, in the order it is read on screen. The
      // description is the part that says what a row actually does — a row
      // called "Component catalogue" explains nothing without it — and it was
      // rendered but never spoken, because the whole subtree below is excluded.
      label: _spoken(<String?>[title, value, description]),
      onTap: onTap,
      child: ExcludeSemantics(
        child: InkWell(
          onTap: onTap,
          borderRadius: GvRadii.mdAll,
          child: ConstrainedBox(
            constraints: const BoxConstraints(
              minHeight: GvLayout.minTouchTarget,
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: GvSpacing.sm,
                vertical: GvSpacing.sm,
              ),
              child: Row(
                children: <Widget>[
                  if (icon != null) ...<Widget>[
                    Icon(icon, size: GvIconSizes.lg, color: colors.textMuted),
                    const SizedBox(width: GvSpacing.md),
                  ],
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        Text(title, style: context.gvText.bodyL),
                        if (value != null)
                          Padding(
                            padding: const EdgeInsets.only(top: GvSpacing.xxs),
                            child: Text(value!, style: context.gvText.label),
                          ),
                        if (description != null)
                          Padding(
                            padding: const EdgeInsets.only(top: GvSpacing.xxs),
                            child: Text(
                              description!,
                              style: context.gvText.caption,
                            ),
                          ),
                      ],
                    ),
                  ),
                  if (onTap != null) ...<Widget>[
                    const SizedBox(width: GvSpacing.sm),
                    Icon(Icons.chevron_right, color: colors.textMuted),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// A read-only Settings field: a label and its value, never interactive.
///
/// Used by the information screens, where a value is reported rather than
/// chosen. A missing value renders as nothing rather than as an empty row, so
/// the screen never claims to know something it does not.
class GvSettingsField extends StatelessWidget {
  const GvSettingsField({super.key, required this.label, required this.value});

  final String label;
  final String? value;

  @override
  Widget build(BuildContext context) {
    final String? shown = value;
    if (shown == null || shown.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: GvSpacing.xs),
      child: Semantics(
        label: '$label, $shown',
        child: ExcludeSemantics(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Text(label, style: context.gvText.label),
              const SizedBox(height: GvSpacing.xxs),
              Text(shown, style: context.gvText.bodyL),
            ],
          ),
        ),
      ),
    );
  }
}

/// One selectable option in a Settings choice screen.
///
/// A radio list rather than a custom control: the selected state is exposed to
/// the screen reader as a real radio value, the target is a full row, and it
/// stays usable at 200% text.
class GvSettingsOption extends StatelessWidget {
  const GvSettingsOption({
    super.key,
    required this.label,
    required this.selected,
    required this.onSelected,
    this.description,
    this.selectedStateLabel,
  });

  final String label;
  final String? description;
  final bool selected;
  final VoidCallback onSelected;

  /// Spoken confirmation of the selected state, so selection is never conveyed
  /// by the radio glyph alone.
  final String? selectedStateLabel;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      inMutuallyExclusiveGroup: true,
      checked: selected,
      selected: selected,
      button: true,
      label: <String>[
        label,
        ?description,
        if (selected) ?selectedStateLabel,
      ].join(', '),
      onTap: onSelected,
      child: ExcludeSemantics(
        child: InkWell(
          onTap: onSelected,
          borderRadius: GvRadii.mdAll,
          child: ConstrainedBox(
            constraints: const BoxConstraints(
              minHeight: GvLayout.minTouchTarget,
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: GvSpacing.sm,
                vertical: GvSpacing.sm,
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  // The glyph reinforces the selected state; the semantics above
                  // carry it independently, so it is never colour- or icon-only.
                  Icon(
                    selected
                        ? Icons.radio_button_checked
                        : Icons.radio_button_unchecked,
                    size: GvIconSizes.lg,
                    color: selected
                        ? context.gvColors.accentPrimary
                        : context.gvColors.textMuted,
                  ),
                  const SizedBox(width: GvSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        Text(label, style: context.gvText.bodyL),
                        if (description != null)
                          Padding(
                            padding: const EdgeInsets.only(top: GvSpacing.xxs),
                            child: Text(
                              description!,
                              style: context.gvText.caption,
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
