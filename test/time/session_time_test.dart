import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/preferences/preference_values.dart';
import 'package:gridview/core/time/device_time_zone.dart';
import 'package:gridview/core/time/session_time.dart';
import 'package:gridview/core/time/timezones.dart';
import 'package:intl/date_symbol_data_local.dart';

/// Every clock in these tests is pinned: the event zone is an explicit IANA
/// name and the device zone is injected, so no assertion depends on the host
/// machine's time zone.
void main() {
  setUpAll(() async {
    ensureTimeZonesInitialized();
    await initializeDateFormatting('en');
    await initializeDateFormatting('es');
  });

  SessionTimePresenter presenterIn(
    TimeDisplayPreference preference, {
    String device = 'UTC',
    String locale = 'en',
  }) => SessionTimePresenter(
    locale: locale,
    preference: preference,
    deviceTimeZone: DeviceTimeZone.iana(device),
  );

  group('device mode', () {
    test('shows the device clock and labels it as the device clock', () {
      final PresentedTime? shown = presenterIn(
        TimeDisplayPreference.device,
        device: 'Europe/Madrid',
      ).present(DateTime.utc(2026, 7, 26, 13), eventTimeZone: 'Asia/Tokyo');

      expect(shown, isNotNull);
      expect(shown!.primary.time, '15:00');
      expect(shown.primary.zoneLabel, 'CEST');
      expect(shown.primary.mode, SessionTimeZoneMode.device);
      // Device mode never shows a second clock.
      expect(shown.secondary, isNull);
      expect(shown.hasBoth, isFalse);
    });

    test('ignores the event zone entirely', () {
      final PresentedTime? withZone = presenterIn(
        TimeDisplayPreference.device,
      ).present(DateTime.utc(2026, 7, 26, 13), eventTimeZone: 'Asia/Tokyo');
      final PresentedTime? withoutZone = presenterIn(
        TimeDisplayPreference.device,
      ).present(DateTime.utc(2026, 7, 26, 13));

      expect(withZone!.primary, withoutZone!.primary);
    });
  });

  group('event mode', () {
    test('summer instant is CEST (+2) in Europe/Brussels', () {
      final PresentedTime? shown = presenterIn(TimeDisplayPreference.event)
          .present(
            DateTime.utc(2026, 7, 26, 13),
            eventTimeZone: 'Europe/Brussels',
          );

      expect(shown!.primary.time, '15:00');
      expect(shown.primary.zoneLabel, 'CEST');
      expect(shown.primary.mode, SessionTimeZoneMode.event);
    });

    test('winter instant is CET (+1) in Europe/Brussels', () {
      final PresentedTime? shown = presenterIn(TimeDisplayPreference.event)
          .present(
            DateTime.utc(2026, 1, 10, 13),
            eventTimeZone: 'Europe/Brussels',
          );

      expect(shown!.primary.time, '14:00');
      expect(shown.primary.zoneLabel, 'CET');
    });

    test('an event zone is only ever taken from the declared IANA name', () {
      // A country is never enough: an unnamed zone falls back, never guessed.
      final PresentedTime? shown = presenterIn(
        TimeDisplayPreference.event,
      ).present(DateTime.utc(2026, 7, 26, 13));

      expect(shown!.primary.mode, SessionTimeZoneMode.device);
    });

    test('a missing event zone falls back to the device clock and never claims '
        'to be event time', () {
      final PresentedTime? shown = presenterIn(
        TimeDisplayPreference.event,
        device: 'Europe/Madrid',
      ).present(DateTime.utc(2026, 7, 26, 13));

      expect(shown!.primary.time, '15:00');
      expect(shown.primary.zoneLabel, 'CEST');
      expect(shown.primary.mode, SessionTimeZoneMode.device);
    });

    test('an invalid event zone falls back safely, exposing no error', () {
      for (final String invalid in <String>[
        '',
        'Mars/Olympus',
        'GMT+9',
        'not a zone',
      ]) {
        final PresentedTime? shown = presenterIn(
          TimeDisplayPreference.event,
        ).present(DateTime.utc(2026, 7, 26, 13), eventTimeZone: invalid);

        expect(
          shown!.primary.mode,
          SessionTimeZoneMode.device,
          reason: invalid,
        );
        expect(shown.primary.time, '13:00');
      }
    });
  });

  group('both mode', () {
    test('shows the event clock led, with the device clock beneath', () {
      final PresentedTime? shown =
          presenterIn(
            TimeDisplayPreference.both,
            device: 'Europe/London',
          ).present(
            DateTime.utc(2026, 7, 26, 13),
            eventTimeZone: 'Europe/Brussels',
          );

      expect(shown!.primary.time, '15:00');
      expect(shown.primary.mode, SessionTimeZoneMode.event);
      expect(shown.secondary!.time, '14:00');
      expect(shown.secondary!.mode, SessionTimeZoneMode.device);
      expect(shown.hasBoth, isTrue);
    });

    test('the two zones are distinguishable by label', () {
      final PresentedTime? shown =
          presenterIn(
            TimeDisplayPreference.both,
            device: 'Europe/London',
          ).present(
            DateTime.utc(2026, 7, 26, 13),
            eventTimeZone: 'Europe/Brussels',
          );

      expect(shown!.primary.zoneLabel, 'CEST');
      expect(shown.secondary!.zoneLabel, 'BST');
      expect(shown.primary.zoneLabel, isNot(shown.secondary!.zoneLabel));
    });

    test('an identical device and event clock is not duplicated', () {
      final PresentedTime? shown =
          presenterIn(
            TimeDisplayPreference.both,
            device: 'Europe/Brussels',
          ).present(
            DateTime.utc(2026, 7, 26, 13),
            eventTimeZone: 'Europe/Brussels',
          );

      expect(shown!.primary.time, '15:00');
      expect(shown.secondary, isNull);
      expect(shown.hasBoth, isFalse);
    });

    test('a missing event zone collapses to the device clock alone', () {
      final PresentedTime? shown = presenterIn(
        TimeDisplayPreference.both,
        device: 'Europe/Madrid',
      ).present(DateTime.utc(2026, 7, 26, 13));

      expect(shown!.primary.mode, SessionTimeZoneMode.device);
      expect(shown.secondary, isNull);
    });
  });

  group('day boundaries', () {
    test('a conversion that crosses midnight keeps both days visible', () {
      // 23:00 UTC on 26 July is 08:00 on 27 July in Tokyo.
      final PresentedTime? shown = presenterIn(
        TimeDisplayPreference.both,
      ).present(DateTime.utc(2026, 7, 26, 23), eventTimeZone: 'Asia/Tokyo');

      expect(shown!.primary.time, '08:00');
      expect(shown.primary.dayMonth, contains('27'));
      expect(shown.secondary!.time, '23:00');
      expect(shown.secondary!.dayMonth, contains('26'));
      expect(shown.crossesDay, isTrue);
    });

    test('same-day conversions do not claim a day change', () {
      final PresentedTime? shown = presenterIn(TimeDisplayPreference.both)
          .present(
            DateTime.utc(2026, 7, 26, 13),
            eventTimeZone: 'Europe/Brussels',
          );

      expect(shown!.crossesDay, isFalse);
    });
  });

  group('daylight saving', () {
    test(
      'an instant inside the spring-forward gap resolves without throwing',
      () {
        // 02:30 local on 29 March 2026 does not exist in Europe/Brussels.
        final PresentedTime? shown = presenterIn(TimeDisplayPreference.event)
            .present(
              DateTime.utc(2026, 3, 29, 1, 30),
              eventTimeZone: 'Europe/Brussels',
            );

        expect(shown, isNotNull);
        expect(shown!.primary.mode, SessionTimeZoneMode.event);
        expect(shown.primary.time, '03:30');
      },
    );

    test('an ambiguous repeated local hour stays unambiguous by zone label', () {
      final SessionTimePresenter presenter = presenterIn(
        TimeDisplayPreference.event,
      );
      final PresentedTime? before = presenter.present(
        DateTime.utc(2026, 10, 25, 0, 30),
        eventTimeZone: 'Europe/Brussels',
      );
      final PresentedTime? after = presenter.present(
        DateTime.utc(2026, 10, 25, 1, 30),
        eventTimeZone: 'Europe/Brussels',
      );

      expect(before!.primary.time, '02:30');
      expect(before.primary.zoneLabel, 'CEST');
      expect(after!.primary.time, '02:30');
      expect(after.primary.zoneLabel, 'CET');
      // Identical clock text, different zone label: the pair is never ambiguous.
      expect(before.primary.zoneLabel, isNot(after.primary.zoneLabel));
    });

    test(
      'the device clock follows its own transitions, not the event zone',
      () {
        final SessionTimePresenter presenter = presenterIn(
          TimeDisplayPreference.device,
          device: 'Europe/Madrid',
        );
        expect(
          presenter.present(DateTime.utc(2026, 1, 10, 13))!.primary.zoneLabel,
          'CET',
        );
        expect(
          presenter.present(DateTime.utc(2026, 7, 10, 13))!.primary.zoneLabel,
          'CEST',
        );
      },
    );
  });

  group('missing values', () {
    test('a null instant renders nothing and never becomes midnight', () {
      for (final TimeDisplayPreference preference
          in TimeDisplayPreference.values) {
        expect(
          presenterIn(preference).present(null, eventTimeZone: 'Asia/Tokyo'),
          isNull,
          reason: preference.wire,
        );
      }
    });

    test('a calendar-only date never shifts with any preference or zone', () {
      for (final TimeDisplayPreference preference
          in TimeDisplayPreference.values) {
        expect(
          presenterIn(
            preference,
            device: 'Pacific/Kiritimati',
          ).formatDateRange('2026-07-26', '2026-07-26'),
          presenterIn(
            preference,
            device: 'Pacific/Midway',
          ).formatDateRange('2026-07-26', '2026-07-26'),
        );
      }
    });

    test('a date range renders both ends, a single date renders once', () {
      final SessionTimePresenter presenter = presenterIn(
        TimeDisplayPreference.device,
      );
      final String? range = presenter.formatDateRange(
        '2026-07-24',
        '2026-07-26',
      );
      expect(range, allOf(contains('24'), contains('26'), contains('Jul')));

      final String? single = presenter.formatDateRange(
        '2026-07-26',
        '2026-07-26',
      );
      expect(single, contains('26'));
      expect(single, isNot(contains('–')));
    });

    test(
      'a malformed calendar date yields no range rather than a wrong one',
      () {
        final SessionTimePresenter presenter = presenterIn(
          TimeDisplayPreference.device,
        );
        expect(presenter.formatDateRange(null, null), isNull);
        expect(presenter.formatDateRange('2026-07', null), isNull);
        expect(presenter.formatDateRange('not-a-date', null), isNull);
      },
    );
  });

  group('locale conventions', () {
    test('English and Spanish both follow the locale 24-hour convention', () {
      expect(
        presenterIn(TimeDisplayPreference.event, locale: 'en')
            .present(
              DateTime.utc(2026, 7, 26, 13),
              eventTimeZone: 'Europe/Brussels',
            )!
            .primary
            .time,
        '15:00',
      );
      expect(
        presenterIn(TimeDisplayPreference.event, locale: 'es')
            .present(
              DateTime.utc(2026, 7, 26, 13),
              eventTimeZone: 'Europe/Brussels',
            )!
            .primary
            .time,
        '15:00',
      );
    });

    test('the weekday and month names follow the locale', () {
      final PresentedTime? en =
          presenterIn(TimeDisplayPreference.event, locale: 'en').present(
            DateTime.utc(2026, 7, 26, 13),
            eventTimeZone: 'Europe/Brussels',
          );
      final PresentedTime? es =
          presenterIn(TimeDisplayPreference.event, locale: 'es').present(
            DateTime.utc(2026, 7, 26, 13),
            eventTimeZone: 'Europe/Brussels',
          );

      expect(en!.primary.weekday, isNot(es!.primary.weekday));
    });
  });
}
