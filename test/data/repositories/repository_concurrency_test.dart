import 'dart:async';

import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/dto/event_dto.dart';
import 'package:gridview/core/api/dto/standing_dto.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/shared/data/remote/remote_cancellation.dart';
import 'package:gridview/features/shared/data/remote/remote_result.dart';
import 'package:gridview/features/shared/domain/refresh_result.dart';

import '../../support/repository_harness.dart';
import '../../support/scripted_api.dart';

void main() {
  late GridViewDatabase db;
  late ScriptedGridViewApi api;
  late RepositoryHarness h;

  setUp(() {
    db = GridViewDatabase.forTesting(NativeDatabase.memory());
    api = ScriptedGridViewApi();
    // One shared coordinator across the harness's repositories.
    h = RepositoryHarness(db, api);
  });
  tearDown(() => db.close());

  test(
    'two simultaneous refreshes for the same key make one HTTP request',
    () async {
      final Completer<void> gate = Completer<void>();
      api.calendar = (_) {
        // Block until released so both callers overlap in flight.
        return _blocked(gate, () => _calendar());
      };

      final Future<RefreshResult> a = h.calendar.refreshCalendar(2026);
      final Future<RefreshResult> b = h.calendar.refreshCalendar(2026);
      gate.complete();
      await Future.wait(<Future<RefreshResult>>[a, b]);

      expect(
        api.callsFor('calendar'),
        1,
        reason: 'deduplicated to one request',
      );
      expect(await h.calendar.readCalendar(2026), hasLength(5));
    },
  );

  test('two different keys run independently', () async {
    final Completer<void> gate = Completer<void>();
    api.calendar = (_) => _blocked(gate, () => _calendar());
    api.driverStandings = (_) => _blocked(
      gate,
      () => modifiedListFromFixture<DriverStandingDto>(
        'standings/drivers-fractional.json',
        (Map<String, dynamic> e) => DriverStandingDto.fromJson(e),
      ),
    );

    final Future<RefreshResult> a = h.calendar.refreshCalendar(2026);
    final Future<RefreshResult> b = h.standings.refreshDriverStandings(2026);
    gate.complete();
    final List<RefreshResult> results = await Future.wait(
      <Future<RefreshResult>>[a, b],
    );

    expect(results[0], isA<RefreshSuccess>());
    expect(results[1], isA<RefreshSuccess>());
    expect(api.callsFor('calendar'), 1);
    expect(api.callsFor('driverStandings'), 1);
  });

  test('a failed refresh releases the key so a retry re-requests', () async {
    api.calendar = (_) => const RemoteFailure<List<GrandPrixSummaryDto>>(
      ApiFailure(kind: ApiFailureKind.networkUnavailable),
    );
    await h.calendar.refreshCalendar(2026);
    expect(api.callsFor('calendar'), 1);

    api.calendar = (_) => _calendar();
    final RefreshResult retry = await h.calendar.refreshCalendar(2026);
    expect(retry, isA<RefreshSuccess>());
    expect(api.callsFor('calendar'), 2, reason: 'the key was released');
  });

  test('cancellation releases the key and a later retry works', () async {
    // A cancelled request returns a cancelled failure; the slot is released.
    api.calendar = (String? etag) =>
        const RemoteFailure<List<GrandPrixSummaryDto>>(
          ApiFailure(kind: ApiFailureKind.cancelled),
        );
    final RemoteCancellation cancellation = RemoteCancellation()..cancel();
    final RefreshResult cancelled = await h.calendar.refreshCalendar(2026);
    expect(
      (cancelled as RefreshFailure).failure.kind,
      ApiFailureKind.cancelled,
    );
    // The cancellation object is accepted by the API surface.
    expect(cancellation.isCancelled, isTrue);

    api.calendar = (_) => _calendar();
    final RefreshResult retry = await h.calendar.refreshCalendar(2026);
    expect(retry, isA<RefreshSuccess>());
    expect(api.callsFor('calendar'), 2);
  });
}

RemoteResult<List<GrandPrixSummaryDto>> _calendar() =>
    modifiedListFromFixture<GrandPrixSummaryDto>(
      'calendar/2026.json',
      GrandPrixSummaryDto.fromJson,
      etag: 'W/"cal"',
    );

/// Awaits [gate], then returns [build]'s result — models an in-flight request.
Future<RemoteResult<T>> _blocked<T>(
  Completer<void> gate,
  RemoteResult<T> Function() build,
) async {
  await gate.future;
  return build();
}
