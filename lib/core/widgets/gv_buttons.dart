import 'package:flutter/material.dart';

import '../theme/theme.dart';

/// Primary call-to-action button (filled red). A null [onPressed] disables it;
/// [isLoading] shows a spinner and blocks input while preserving size.
class GvPrimaryButton extends StatelessWidget {
  const GvPrimaryButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.isLoading = false,
    this.loadingLabel,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool isLoading;

  /// The localized state spoken after the button's own name while [isLoading],
  /// e.g. "Try again, Loading". Supplied by the caller because the design
  /// system is deliberately localization-agnostic; omitting it keeps the name
  /// and simply says nothing about the state.
  final String? loadingLabel;

  @override
  Widget build(BuildContext context) {
    if (!isLoading) {
      return ElevatedButton(
        onPressed: onPressed,
        child: _LabelWithIcon(label: label, icon: icon),
      );
    }

    // A spinner carries no text, so the label the button had a moment ago
    // vanished from the semantics tree at exactly the moment the user needed
    // confirmation of what was running. The name is restored here and the
    // spinner below is excluded, so it is spoken once and not twice.
    final String? state = loadingLabel?.trim();
    return Semantics(
      button: true,
      enabled: false,
      label: (state == null || state.isEmpty) ? label : '$label, $state',
      child: ExcludeSemantics(
        child: ElevatedButton(
          onPressed: null,
          child: SizedBox(
            height: GvIconSizes.md,
            width: GvIconSizes.md,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: context.gvColors.onAccentPrimary,
            ),
          ),
        ),
      ),
    );
  }
}

/// Secondary button (outlined).
class GvSecondaryButton extends StatelessWidget {
  const GvSecondaryButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: onPressed,
      child: _LabelWithIcon(label: label, icon: icon),
    );
  }
}

/// Icon-only button with a required semantic label (accessibility).
class GvIconButton extends StatelessWidget {
  const GvIconButton({
    super.key,
    required this.icon,
    required this.semanticLabel,
    this.onPressed,
  });

  final IconData icon;
  final String semanticLabel;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: onPressed,
      icon: Icon(icon, size: GvIconSizes.lg, semanticLabel: semanticLabel),
      tooltip: semanticLabel,
      isSelected: false,
    );
  }
}

class _LabelWithIcon extends StatelessWidget {
  const _LabelWithIcon({required this.label, this.icon});

  final String label;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    if (icon == null) {
      return Text(label, overflow: TextOverflow.ellipsis);
    }
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Icon(icon, size: GvIconSizes.md),
        const SizedBox(width: GvSpacing.xs),
        Flexible(child: Text(label, overflow: TextOverflow.ellipsis)),
      ],
    );
  }
}
