/// The typed persisted preference values (Phase 8 §4).
///
/// Every value persists a **stable wire token**, never a localized label and
/// never an enum index: reordering an enum or translating a label must not be
/// able to change what a user previously chose. Unknown or corrupted tokens
/// resolve to the documented safe default rather than throwing.
library;

import 'package:flutter/material.dart';

/// Which language the application renders in.
///
/// [system] follows the platform locale for as long as it resolves to a
/// supported language; an explicit choice ignores later platform changes.
enum AppLanguagePreference {
  system('system'),
  english('english'),
  spanish('spanish');

  const AppLanguagePreference(this.wire);

  /// The stable persisted token.
  final String wire;

  /// The documented safe default: follow the platform.
  static const AppLanguagePreference fallback = AppLanguagePreference.system;

  /// Resolves a persisted token, falling back to [fallback] for a missing,
  /// unknown or corrupted value.
  static AppLanguagePreference fromWire(String? wire) {
    for (final AppLanguagePreference value in AppLanguagePreference.values) {
      if (value.wire == wire) return value;
    }
    return fallback;
  }

  /// The locale this preference pins the application to, or `null` when the
  /// platform locale should be followed.
  Locale? get locale => switch (this) {
    AppLanguagePreference.system => null,
    AppLanguagePreference.english => const Locale('en'),
    AppLanguagePreference.spanish => const Locale('es'),
  };
}

/// Which theme the application renders in. Dark is the flagship GridView theme
/// and remains the default.
enum AppThemePreference {
  system('system'),
  dark('dark'),
  light('light');

  const AppThemePreference(this.wire);

  /// The stable persisted token.
  final String wire;

  /// The documented safe default: the flagship dark theme.
  static const AppThemePreference fallback = AppThemePreference.dark;

  /// Resolves a persisted token, falling back to [fallback] for a missing,
  /// unknown or corrupted value.
  static AppThemePreference fromWire(String? wire) {
    for (final AppThemePreference value in AppThemePreference.values) {
      if (value.wire == wire) return value;
    }
    return fallback;
  }

  /// The Material [ThemeMode] this preference resolves to.
  ThemeMode get themeMode => switch (this) {
    AppThemePreference.system => ThemeMode.system,
    AppThemePreference.dark => ThemeMode.dark,
    AppThemePreference.light => ThemeMode.light,
  };
}

/// Which clock session instants are displayed in.
///
/// [event] uses the event's **declared IANA timezone** only — a timezone is
/// never inferred from a country, and an event with no declared zone falls back
/// to the device clock without ever claiming to be event time.
enum TimeDisplayPreference {
  device('device'),
  event('event'),
  both('both');

  const TimeDisplayPreference(this.wire);

  /// The stable persisted token.
  final String wire;

  /// The documented safe default: the device clock.
  static const TimeDisplayPreference fallback = TimeDisplayPreference.device;

  /// Resolves a persisted token, falling back to [fallback] for a missing,
  /// unknown or corrupted value.
  static TimeDisplayPreference fromWire(String? wire) {
    for (final TimeDisplayPreference value in TimeDisplayPreference.values) {
      if (value.wire == wire) return value;
    }
    return fallback;
  }
}

/// A complete, immutable snapshot of every user preference.
///
/// The whole snapshot is replaced on every change, so a widget can depend on
/// exactly the fields it needs and no preference is ever half-applied.
@immutable
class AppPreferences {
  const AppPreferences({
    required this.language,
    required this.theme,
    required this.timeDisplay,
  });

  /// The state a first launch — or a completely unreadable store — renders with.
  static const AppPreferences defaults = AppPreferences(
    language: AppLanguagePreference.fallback,
    theme: AppThemePreference.fallback,
    timeDisplay: TimeDisplayPreference.fallback,
  );

  final AppLanguagePreference language;
  final AppThemePreference theme;
  final TimeDisplayPreference timeDisplay;

  AppPreferences copyWith({
    AppLanguagePreference? language,
    AppThemePreference? theme,
    TimeDisplayPreference? timeDisplay,
  }) {
    return AppPreferences(
      language: language ?? this.language,
      theme: theme ?? this.theme,
      timeDisplay: timeDisplay ?? this.timeDisplay,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AppPreferences &&
          other.language == language &&
          other.theme == theme &&
          other.timeDisplay == timeDisplay;

  @override
  int get hashCode => Object.hash(language, theme, timeDisplay);

  @override
  String toString() =>
      'AppPreferences(language: ${language.wire}, theme: ${theme.wire}, '
      'timeDisplay: ${timeDisplay.wire})';
}
