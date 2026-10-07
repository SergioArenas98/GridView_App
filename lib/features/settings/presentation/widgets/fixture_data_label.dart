import '../../../../l10n/app_localizations.dart';
import '../../../shared/domain/fixture_data_identity.dart';

/// How Settings names bundled fixture data that is not plain sample data, or
/// `null` for sample data and while the data is not identified yet, where the
/// sample wording stands.
String? fixtureDataSourceLabel(
  AppLocalizations l10n,
  FixtureDataIdentity? identity,
) => switch (identity) {
  FrozenCaptureData(:final DateTime capturedAt) =>
    l10n.settingsDataSourceFrozen(captureDateLabel(capturedAt)),
  UnverifiedFixtureData() => l10n.settingsDataSourceUnverified,
  SampleFixtureData() || null => null,
};
