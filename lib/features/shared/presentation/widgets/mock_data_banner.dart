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
///
/// Primer V2 (Step 55C.15), from the Grand Prix Detail states page, spec 26
/// (`consolidation-pilot/grand-prix-detail/gpd.css` `.banner`): 8 × 12
/// padding inside a 1.5px `text.accent` outline (Ember in Dark, Red Oxide in
/// Light) with the small radius, Archivo 14px weight 700 at line height 1.45
/// (`base.css`) in `text.accent`, centred, wrapping freely. The reference has
/// no icon, so the legacy flask glyph is gone; the wording is unchanged. Each
/// screen keeps its own placement and spacing around the banner.
///
/// Semantics: one container node carries the label and the visible text is
/// excluded, so the label is read once.
class MockDataBanner extends ConsumerWidget {
  const MockDataBanner({super.key});

  static const double _fontSize = 14;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final GvPrimerRoles roles = GvPrimerSurface.of(context).roles;
    final String label = switch (ref.watch(fixtureDataIdentityProvider).value) {
      FrozenCaptureData(:final DateTime capturedAt) => l10n.frozenDataBanner(
        captureDateLabel(capturedAt),
      ),
      UnverifiedFixtureData() => l10n.unverifiedDataBanner,
      SampleFixtureData() || null => l10n.mockDataBanner,
    };
    final Color accent = roles.text.accent;
    return Semantics(
      container: true,
      label: label,
      excludeSemantics: true,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(GvPrimerLayout.radiusSm),
          border: Border.all(
            color: accent,
            width: GvPrimerMetrics.statusOutlineWidth,
          ),
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          style: GvPrimerTypography.archivo(
            size: _fontSize,
            weight: 700,
            height: 1.45,
          ).copyWith(color: accent),
        ),
      ),
    );
  }
}
