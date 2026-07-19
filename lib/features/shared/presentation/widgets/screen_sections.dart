import 'package:flutter/material.dart';

import '../../../../core/theme/tokens/tokens.dart';
import '../../../../core/widgets/widgets.dart';

/// A titled section: a [GvSectionHeader] with an optional trailing action, then
/// the section content. Used to give every screen a consistent vertical rhythm.
class GvScreenSection extends StatelessWidget {
  const GvScreenSection({
    super.key,
    required this.title,
    required this.child,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final Widget child;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        GvSectionHeader(
          title: title,
          actionLabel: actionLabel,
          onAction: onAction,
        ),
        const SizedBox(height: GvSpacing.sm),
        child,
      ],
    );
  }
}

/// A label/value pair rendered on one baseline. Optional values are simply not
/// passed by the caller, so no empty rows or false zeroes appear.
class GvDetailField extends StatelessWidget {
  const GvDetailField({super.key, required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: GvSpacing.xs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Expanded(child: Text(label, style: GvTypography.label)),
          const SizedBox(width: GvSpacing.md),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: GvTypography.bodyM.copyWith(color: GvColors.textPrimary),
            ),
          ),
        ],
      ),
    );
  }
}

/// A card that groups a set of [GvDetailField]s (or any children) with dividers.
class GvInfoCard extends StatelessWidget {
  const GvInfoCard({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return GvContentCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          for (int i = 0; i < children.length; i++) ...<Widget>[
            if (i > 0) const Divider(height: 1),
            children[i],
          ],
        ],
      ),
    );
  }
}
