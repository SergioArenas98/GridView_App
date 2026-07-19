import 'package:flutter/material.dart';

import '../theme/tokens/tokens.dart';

/// Primary call-to-action button (filled red). A null [onPressed] disables it;
/// [isLoading] shows a spinner and blocks input while preserving size.
class GvPrimaryButton extends StatelessWidget {
  const GvPrimaryButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.isLoading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    final Widget child = isLoading
        ? const SizedBox(
            height: GvIconSizes.md,
            width: GvIconSizes.md,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: GvColors.onAccentPrimary,
            ),
          )
        : _LabelWithIcon(label: label, icon: icon);

    return ElevatedButton(
      onPressed: isLoading ? null : onPressed,
      child: child,
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
