import 'package:flutter/material.dart';

import '../theme/tokens/tokens.dart';

/// A section title with an optional trailing action (e.g. "See all").
///
/// The action shares the row's width with the title rather than taking its
/// natural size, so a long localized action label (or a large text scale) makes
/// both sides ellipsize instead of overflowing.
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
            Flexible(
              child: TextButton(
                onPressed: onAction,
                child: Text(
                  actionLabel!,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GvTypography.label.copyWith(
                    color: GvColors.accentSecondary,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
