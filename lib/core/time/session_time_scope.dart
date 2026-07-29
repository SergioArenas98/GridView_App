import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/shared/application/providers.dart';
import '../preferences/preferences_providers.dart';
import 'session_time.dart';

/// Builds the presentation-time policy for the active locale and preference.
///
/// Every live session-time surface calls this rather than constructing a
/// presenter of its own, so a single preference change updates Home, Calendar
/// and Grand Prix consistently and no widget can quietly apply a different
/// policy. It reads the locale from [context] (the framework already rebuilds on
/// a locale change) and the preference and device clock from providers.
SessionTimePresenter sessionTimePresenterOf(
  BuildContext context,
  WidgetRef ref,
) {
  return SessionTimePresenter(
    locale: Localizations.localeOf(context).languageCode,
    preference: ref.watch(timeDisplayPreferenceProvider),
    deviceTimeZone: ref.watch(deviceTimeZoneProvider),
  );
}
