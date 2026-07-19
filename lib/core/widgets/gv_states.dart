import 'package:flutter/material.dart';

import '../theme/gv_semantic_colors.dart';
import '../theme/tokens/tokens.dart';
import 'gv_buttons.dart';

/// Empty state: explains why there is nothing to show, optionally with an action.
class GvEmptyState extends StatelessWidget {
  const GvEmptyState({
    super.key,
    required this.title,
    required this.message,
    this.icon = Icons.inbox_outlined,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String message;
  final IconData icon;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return _CenteredState(
      icon: icon,
      iconColor: GvColors.textMuted,
      title: title,
      message: message,
      action: (actionLabel != null && onAction != null)
          ? GvSecondaryButton(label: actionLabel!, onPressed: onAction)
          : null,
    );
  }
}

/// Error state: calm, clear and actionable with a retry affordance.
class GvErrorState extends StatelessWidget {
  const GvErrorState({
    super.key,
    required this.title,
    required this.message,
    this.retryLabel,
    this.onRetry,
    this.icon = Icons.error_outline,
  });

  final String title;
  final String message;
  final String? retryLabel;
  final VoidCallback? onRetry;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return _CenteredState(
      icon: icon,
      iconColor: GvColors.accentPrimary,
      title: title,
      message: message,
      action: (retryLabel != null && onRetry != null)
          ? GvPrimaryButton(label: retryLabel!, onPressed: onRetry)
          : null,
    );
  }
}

/// Inline notice that shown data is offline/stale. Uses an icon and text so the
/// meaning does not depend on colour alone.
class GvOfflineNotice extends StatelessWidget {
  const GvOfflineNotice({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final GvSemanticColors colors = context.gvColors;
    return Semantics(
      liveRegion: true,
      label: message,
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: GvSpacing.md,
          vertical: GvSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: GvColors.surfaceElevated,
          borderRadius: GvRadii.mdAll,
          border: Border.all(color: colors.stale),
        ),
        child: Row(
          children: <Widget>[
            Icon(
              Icons.cloud_off_outlined,
              size: GvIconSizes.md,
              color: colors.stale,
            ),
            const SizedBox(width: GvSpacing.sm),
            Expanded(
              child: Text(
                message,
                style: GvTypography.bodyM.copyWith(
                  color: GvColors.textSecondary,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CenteredState extends StatelessWidget {
  const _CenteredState({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.message,
    this.action,
  });

  final IconData icon;
  final Color iconColor;
  final String title;
  final String message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(GvSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(icon, size: GvIconSizes.xl, color: iconColor),
            const SizedBox(height: GvSpacing.md),
            Text(
              title,
              style: GvTypography.cardTitle,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: GvSpacing.xs),
            Text(
              message,
              style: GvTypography.bodyM,
              textAlign: TextAlign.center,
            ),
            if (action != null) ...<Widget>[
              const SizedBox(height: GvSpacing.lg),
              action!,
            ],
          ],
        ),
      ),
    );
  }
}
