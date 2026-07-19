import 'package:timezone/data/latest_all.dart' as tzdata;

bool _initialized = false;

/// Loads the IANA timezone database once. Idempotent, so it is safe to call
/// from bootstrap and from every test `setUp`.
void ensureTimeZonesInitialized() {
  if (_initialized) return;
  tzdata.initializeTimeZones();
  _initialized = true;
}
