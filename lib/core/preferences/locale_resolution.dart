import 'package:flutter/widgets.dart';

import 'preference_values.dart';

/// The language GridView falls back to whenever nothing better can be resolved.
///
/// English is the source ARB locale, so it is always complete.
const Locale kFallbackLocale = Locale('en');

/// Resolves the locale the application should render in.
///
/// A pure function of the user's preference, the platform locales and the
/// supported locales, so every rule is testable without a `MaterialApp`:
///
/// * an explicit [AppLanguagePreference.english] or
///   [AppLanguagePreference.spanish] pins that language and ignores every later
///   platform locale change;
/// * [AppLanguagePreference.system] resolves to Spanish **only** when a
///   supported platform locale resolves to Spanish, and otherwise falls back
///   predictably to English;
/// * an unsupported or malformed platform locale falls back rather than
///   throwing, so no locale can crash the shell.
///
/// Only the language subtag is matched, so regional variants (`es_419`, `es_MX`,
/// `en_GB`) resolve to their supported base language instead of falling through
/// to English.
Locale resolveAppLocale({
  required AppLanguagePreference preference,
  required List<Locale>? platformLocales,
  required Iterable<Locale> supportedLocales,
}) {
  final List<Locale> supported = supportedLocales.toList(growable: false);

  final Locale? pinned = preference.locale;
  if (pinned != null) {
    return _matchLanguage(pinned, supported) ?? kFallbackLocale;
  }

  for (final Locale candidate in platformLocales ?? const <Locale>[]) {
    final Locale? match = _matchLanguage(candidate, supported);
    if (match != null) return match;
  }
  return kFallbackLocale;
}

/// The supported locale whose language subtag equals [candidate]'s, or `null`.
Locale? _matchLanguage(Locale candidate, List<Locale> supported) {
  for (final Locale locale in supported) {
    if (locale.languageCode == candidate.languageCode) return locale;
  }
  return null;
}
