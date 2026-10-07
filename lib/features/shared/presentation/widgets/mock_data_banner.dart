import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/theme.dart';
import '../../../../l10n/app_localizations.dart';
import '../../application/fixture_data_identity_provider.dart';
import '../../domain/fixture_data_identity.dart';

/// A persistent, clearly-visible banner shown in dev/staging builds that serve
/// fixture data, so sample data is never mistaken for authoritative results.
/// Never shown in production (the provider wiring reports mock = false there).
///
/// A test-only frozen-data build is labelled as frozen captured data with its
/// capture date. Until the bundled data is identified, and for sample data,
/// the sample wording is shown: it never claims more than is known.
class MockDataBanner extends ConsumerWidget {
  const MockDataBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final GvSemanticColors colors = context.gvColors;
    final String label = switch (ref.watch(fixtureDataIdentityProvider).value) {
      FrozenCaptureData(:final DateTime capturedAt) => l10n.frozenDataBanner(
        captureDateLabel(capturedAt),
      ),
      UnverifiedFixtureData() => l10n.unverifiedDataBanner,
      SampleFixtureData() || null => l10n.mockDataBanner,
    };
    return Semantics(
      label: label,
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: GvSpacing.md,
          vertical: GvSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: context.gvColors.surfaceElevated,
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
                label,
                style: context.gvText.label.copyWith(
                  color: context.gvColors.textSecondary,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
