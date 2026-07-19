import 'package:flutter/material.dart';

import '../../../../core/theme/gv_semantic_colors.dart';
import '../../../../core/theme/tokens/tokens.dart';
import '../../../../l10n/app_localizations.dart';

/// A persistent, clearly-visible banner shown in dev/staging builds that serve
/// fixture data, so sample data is never mistaken for authoritative results.
/// Never shown in production (the provider wiring reports mock = false there).
class MockDataBanner extends StatelessWidget {
  const MockDataBanner({super.key});

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final GvSemanticColors colors = context.gvColors;
    return Semantics(
      label: l10n.mockDataBanner,
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: GvSpacing.md,
          vertical: GvSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: GvColors.surfaceElevated,
          borderRadius: GvRadii.mdAll,
          border: Border.all(color: colors.warning),
        ),
        child: Row(
          children: <Widget>[
            Icon(
              Icons.science_outlined,
              size: GvIconSizes.md,
              color: colors.warning,
            ),
            const SizedBox(width: GvSpacing.sm),
            Expanded(
              child: Text(
                l10n.mockDataBanner,
                style: GvTypography.label.copyWith(
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
