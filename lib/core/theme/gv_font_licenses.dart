import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// The asset holding the SIL Open Font License shipped with Archivo.
const String archivoLicenseAsset = 'assets/fonts/archivo/OFL.txt';

/// The package name under which Archivo's licence is listed.
const String archivoLicensePackage = 'Archivo font';

bool _registered = false;

/// Registers the licences of the fonts bundled as app assets with Flutter's
/// [LicenseRegistry], next to the package licences Flutter collects itself.
///
/// Asset fonts are not collected automatically, so without this Archivo's
/// OFL would be missing from every licence listing. Registration is lazy (the
/// file is read only when a licence listing is requested) and idempotent.
///
/// The OFL notice is also carried inside the font file itself (`name` table
/// copyright and licence entries) and as the bundled `OFL.txt`.
void registerBundledFontLicenses() {
  if (_registered) return;
  _registered = true;
  LicenseRegistry.addLicense(_archivoLicense);
}

Stream<LicenseEntry> _archivoLicense() async* {
  final String text = await rootBundle.loadString(archivoLicenseAsset);
  yield LicenseEntryWithLineBreaks(<String>[archivoLicensePackage], text);
}

/// Test-only: allows a test to register again after resetting the registry.
@visibleForTesting
void debugResetBundledFontLicenses() => _registered = false;
