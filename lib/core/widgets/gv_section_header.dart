import 'package:flutter/material.dart';

import '../theme/tokens/tokens.dart';

/// A section title with an optional trailing action (e.g. "See all").
class GvSectionHeader extends StatelessWidget {
  const GvSectionHeader({
    super.key,
    required this.title,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      header: true,
      child: Row(
        children: <Widget>[
          Expanded(
            child: Text(
              title,
              style: GvTypography.sectionTitle,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (actionLabel != null && onAction != null)
            TextButton(
              onPressed: onAction,
              child: Text(
                actionLabel!,
                style: GvTypography.label.copyWith(
                  color: GvColors.accentSecondary,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
