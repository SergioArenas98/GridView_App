import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/preferences/preference_store.dart';
import 'package:gridview/core/preferences/preference_values.dart';
import 'package:gridview/core/preferences/preferences_repository.dart';

void main() {
  late List<PreferenceDiagnostic> diagnostics;

  setUp(() => diagnostics = <PreferenceDiagnostic>[]);

  AppPreferencesRepository build(
    InMemoryPreferenceStore store, {
    bool storeUnavailable = false,
  }) {
    final AppPreferencesRepository repository = AppPreferencesRepository(
      store: store,
      onDiagnostic: diagnostics.add,
      storeUnavailable: storeUnavailable,
    );
    addTearDown(repository.dispose);
    return repository;
  }

  group('first launch', () {
    test('an empty store yields the documented defaults and no diagnostic', () {
      final AppPreferencesRepository repository = build(
        InMemoryPreferenceStore(),
      );
      expect(repository.snapshot, AppPreferences.defaults);
      expect(diagnostics, isEmpty);
    });
  });

  group('round trips', () {
    test('language persists its wire token and reloads', () async {
      final InMemoryPreferenceStore store = InMemoryPreferenceStore();
      final AppPreferencesRepository repository = build(store);

      expect(
        await repository.setLanguage(AppLanguagePreference.spanish),
        PreferenceWriteOutcome.persisted,
      );
      expect(repository.snapshot.language, AppLanguagePreference.spanish);
      expect(store.values[PreferenceKeys.language], 'spanish');

      // Close and reopen over the same storage.
      final AppPreferencesRepository reopened = build(
        InMemoryPreferenceStore(initial: store.values),
      );
      expect(reopened.snapshot.language, AppLanguagePreference.spanish);
    });

    test('theme persists its wire token and reloads', () async {
      final InMemoryPreferenceStore store = InMemoryPreferenceStore();
      final AppPreferencesRepository repository = build(store);

      await repository.setTheme(AppThemePreference.light);
      expect(store.values[PreferenceKeys.theme], 'light');
      expect(
        build(InMemoryPreferenceStore(initial: store.values)).snapshot.theme,
        AppThemePreference.light,
      );
    });

    test('time display persists its wire token and reloads', () async {
      final InMemoryPreferenceStore store = InMemoryPreferenceStore();
      final AppPreferencesRepository repository = build(store);

      await repository.setTimeDisplay(TimeDisplayPreference.both);
      expect(store.values[PreferenceKeys.timeDisplay], 'both');
      expect(
        build(
          InMemoryPreferenceStore(initial: store.values),
        ).snapshot.timeDisplay,
        TimeDisplayPreference.both,
      );
    });

    test('no preference is ever stored as an enum index or a label', () async {
      final InMemoryPreferenceStore store = InMemoryPreferenceStore();
      final AppPreferencesRepository repository = build(store);
      await repository.setLanguage(AppLanguagePreference.spanish);
      await repository.setTheme(AppThemePreference.light);
      await repository.setTimeDisplay(TimeDisplayPreference.event);

      expect(store.values.values, <String>['spanish', 'light', 'event']);
      for (final String stored in store.values.values) {
        expect(int.tryParse(stored), isNull);
        // A localized label would have leaked a translated word.
        expect(stored, isNot(anyOf('Español', 'Claro', 'Evento')));
      }
    });

    test('changes emit the complete snapshot', () async {
      final AppPreferencesRepository repository = build(
        InMemoryPreferenceStore(),
      );
      final List<AppPreferences> emitted = <AppPreferences>[];
      repository.changes.listen(emitted.add);

      await repository.setTheme(AppThemePreference.light);
      await pumpEventQueue();

      expect(emitted, hasLength(1));
      expect(emitted.single.theme, AppThemePreference.light);
      expect(emitted.single.language, AppLanguagePreference.system);
    });

    test('re-selecting the current value does not re-emit', () async {
      final AppPreferencesRepository repository = build(
        InMemoryPreferenceStore(),
      );
      final List<AppPreferences> emitted = <AppPreferences>[];
      repository.changes.listen(emitted.add);

      await repository.setTheme(AppThemePreference.dark); // already the default
      await pumpEventQueue();

      expect(emitted, isEmpty);
    });
  });

  group('damaged storage', () {
    test('an unknown token falls back and reports a diagnostic', () {
      final AppPreferencesRepository repository = build(
        InMemoryPreferenceStore(
          initial: <String, String>{
            PreferenceKeys.theme: 'solarized',
            PreferenceKeys.language: 'spanish',
          },
        ),
      );

      expect(repository.snapshot.theme, AppThemePreference.dark);
      // The unrelated, valid preference is untouched by the fallback.
      expect(repository.snapshot.language, AppLanguagePreference.spanish);

      expect(diagnostics, hasLength(1));
      expect(diagnostics.single.kind, PreferenceDiagnosticKind.corruptedValue);
      expect(diagnostics.single.key, PreferenceKeys.theme);
    });

    test('a diagnostic never carries the stored text', () {
      build(
        InMemoryPreferenceStore(
          initial: <String, String>{PreferenceKeys.theme: 'secret-value'},
        ),
      );
      expect(diagnostics.single.toString(), isNot(contains('secret-value')));
    });

    test(
      'a corrupted value is repaired by the next successful write',
      () async {
        final InMemoryPreferenceStore store = InMemoryPreferenceStore(
          initial: <String, String>{PreferenceKeys.theme: 'solarized'},
        );
        final AppPreferencesRepository repository = build(store);
        expect(repository.snapshot.theme, AppThemePreference.dark);

        await repository.setTheme(AppThemePreference.light);
        expect(store.values[PreferenceKeys.theme], 'light');
        expect(
          build(InMemoryPreferenceStore(initial: store.values)).snapshot.theme,
          AppThemePreference.light,
        );
      },
    );

    test('an unopenable store still renders defaults, with a diagnostic', () {
      final AppPreferencesRepository repository = build(
        InMemoryPreferenceStore(),
        storeUnavailable: true,
      );
      expect(repository.snapshot, AppPreferences.defaults);
      expect(
        diagnostics.single.kind,
        PreferenceDiagnosticKind.storeUnavailable,
      );
    });
  });

  group('write failures', () {
    test('a failed write reverts the visible value and reports it', () async {
      final AppPreferencesRepository repository = build(
        InMemoryPreferenceStore(failingKeys: <String>{PreferenceKeys.theme}),
      );

      expect(
        await repository.setTheme(AppThemePreference.light),
        PreferenceWriteOutcome.failed,
      );
      // Visible state converges back on what is actually stored.
      expect(repository.snapshot.theme, AppThemePreference.dark);
      expect(diagnostics.single.kind, PreferenceDiagnosticKind.writeFailure);
    });

    test('one failing preference never erases another', () async {
      final AppPreferencesRepository repository = build(
        InMemoryPreferenceStore(failingKeys: <String>{PreferenceKeys.theme}),
      );

      await repository.setLanguage(AppLanguagePreference.spanish);
      await repository.setTheme(AppThemePreference.light);

      expect(repository.snapshot.theme, AppThemePreference.dark);
      expect(repository.snapshot.language, AppLanguagePreference.spanish);
    });
  });

  group('overlapping writes', () {
    test('the latest selection wins and the stale one is skipped', () async {
      final InMemoryPreferenceStore store = InMemoryPreferenceStore();
      final AppPreferencesRepository repository = build(store);

      final Future<PreferenceWriteOutcome> first = repository.setTheme(
        AppThemePreference.light,
      );
      final Future<PreferenceWriteOutcome> second = repository.setTheme(
        AppThemePreference.system,
      );

      expect(await first, PreferenceWriteOutcome.superseded);
      expect(await second, PreferenceWriteOutcome.persisted);
      expect(store.values[PreferenceKeys.theme], 'system');
      expect(repository.snapshot.theme, AppThemePreference.system);
    });

    test('writes to different preferences all land', () async {
      final InMemoryPreferenceStore store = InMemoryPreferenceStore();
      final AppPreferencesRepository repository = build(store);

      await Future.wait(<Future<PreferenceWriteOutcome>>[
        repository.setTheme(AppThemePreference.light),
        repository.setLanguage(AppLanguagePreference.english),
        repository.setTimeDisplay(TimeDisplayPreference.event),
      ]);

      expect(store.values, <String, String>{
        PreferenceKeys.theme: 'light',
        PreferenceKeys.language: 'english',
        PreferenceKeys.timeDisplay: 'event',
      });
    });
  });
}
