import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/time/session_time.dart';
import 'package:gridview/core/time/timezones.dart';
import 'package:intl/date_symbol_data_local.dart';

void main() {
  setUpAll(() {
    ensureTimeZonesInitialized();
    initializeDateFormatting('en');
  });

  const SessionTimePresenter presenter = SessionTimePresenter(locale: 'en');

  group('event-local conversion with DST', () {
    test('summer instant is CEST (+2) in Europe/Brussels', () {
      final DisplayedTime? shown = presenter.formatInstant(
        DateTime.utc(2026, 7, 26, 13),
        eventTimeZone: 'Europe/Brussels',
      );
      expect(shown, isNotNull);
      expect(shown!.time, '15:00');
      expect(shown.zoneLabel, 'CEST');
      expect(shown.mode, SessionTimeZoneMode.event);
    });

    test('winter instant is CET (+1) in Europe/Brussels', () {
      final DisplayedTime? shown = presenter.formatInstant(
        DateTime.utc(2026, 1, 10, 13),
        eventTimeZone: 'Europe/Brussels',
      );
      expect(shown!.time, '14:00');
      expect(shown.zoneLabel, 'CET');
      expect(shown.mode, SessionTimeZoneMode.event);
    });
  });

  group('fallbacks', () {
    test('a null instant returns null', () {
      expect(
        presenter.formatInstant(null, eventTimeZone: 'Europe/Rome'),
        isNull,
      );
    });

    test('an unknown zone falls back to the device clock', () {
      final DisplayedTime? shown = presenter.formatInstant(
        DateTime.utc(2026, 7, 26, 13),
        eventTimeZone: 'Mars/Olympus_Mons',
      );
      expect(shown, isNotNull);
      expect(shown!.mode, SessionTimeZoneMode.device);
    });

    test('device mode is used when no event zone is supplied', () {
      final DisplayedTime? shown = presenter.formatInstant(
        DateTime.utc(2026, 7, 26, 13),
      );
      expect(shown!.mode, SessionTimeZoneMode.device);
    });
  });

  group('calendar-only dates', () {
    test('do not shift regardless of timezone', () {
      final String? range = presenter.formatDateRange(
        '2026-07-24',
        '2026-07-26',
      );
      expect(range, isNotNull);
      expect(range, contains('24'));
      expect(range, contains('26'));
      expect(range, contains('Jul'));
    });

    test('a single date renders once', () {
      final String? single = presenter.formatDateRange(
        '2026-07-26',
        '2026-07-26',
      );
      expect(single, contains('26'));
      expect(single, isNot(contains('–')));
    });

    test('null dates yield null', () {
      expect(presenter.formatDateRange(null, null), isNull);
    });
  });
}
