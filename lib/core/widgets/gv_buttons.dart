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
  /// system is deliberately localization-agnostic.
  ///
  /// Required in practice whenever [isLoading] is true — see the assertion in
  /// [build] — and ignored otherwise, so an ordinary button never has to think
  /// about it.
  final String? loadingLabel;

  @override
  Widget build(BuildContext context) {
    // The contract, enforced in development and in CI rather than in release:
    // a loading state nobody can hear is the defect this button already had
    // once, and it is invisible to a sighted reviewer, so it must not be
    // possible to reintroduce it silently. Asserted here rather than in the
    // constructor because detecting a whitespace-only label needs `trim()`,
    // which a const constructor's initializer list cannot evaluate — and
    // keeping the constructor const matters to every caller that is not
    // loading.
    assert(
      !isLoading || (loadingLabel?.trim().isNotEmpty ?? false),
      'GvPrimaryButton(isLoading: true) needs a non-blank localized '
      'loadingLabel — AppLocalizations.a11yLoading. Without one the button '
      'announces nothing about the work it is doing, and a screen-reader user '
      'is told only the name of a control that has stopped responding.',
    );
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
      // A boundary, like the ElevatedButton this branch replaces. Without it
      // the annotation is not a node of its own and merges into whatever
      // encloses the button — on a real screen the button's name disappears
      // into its section heading instead of being a button a screen reader can
      // land on. In isolation the two are indistinguishable, which is why this
      // only surfaced once a whole screen was rendered.
      container: true,
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
