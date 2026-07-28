import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/dto/detail_dto.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/core/database/unresolved_identity.dart';
import 'package:gridview/features/shared/data/remote/remote_result.dart';
import 'package:gridview/features/shared/domain/entities/circuit.dart';
import 'package:gridview/features/shared/domain/entities/constructor.dart';
import 'package:gridview/features/shared/domain/entities/driver.dart';
import 'package:gridview/features/shared/domain/entities/resource_key.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/shared/domain/refresh_result.dart';

import '../../support/repository_harness.dart';
import '../../support/scripted_api.dart';

/// The referential-stub / `304` recovery contract (ADR 0012), proven identically
/// for all three on-demand detail families.
///
/// A referential stub exists only to satisfy a foreign key. It is **not** a
/// local domain representation, so it must never be returned as detail content
/// and must never suppress the single unconditional recovery request that a
/// `304`-with-no-representation requires.
///
/// Each family is exercised through the same seven cases, so the three cannot
/// drift apart.
void main() {
  const int season = 2026;

  late GridViewDatabase db;
  late ScriptedGridViewApi api;
  late RepositoryHarness h;

  setUp(() {
    db = GridViewDatabase.forTesting(NativeDatabase.memory());
    api = ScriptedGridViewApi();
    h = RepositoryHarness(db, api, now: DateTime.utc(2026, 7, 20));
  });
  tearDown(() => db.close());

  Map<String, dynamic> envelope(Object? data) => <String, dynamic>{
    'data': data,
    'meta': <String, dynamic>{
      'apiVersion': '1',
      'generatedAt': '2026-07-18T12:00:00Z',
      'sourceUpdatedAt': '2026-07-18T11:55:00Z',
      'requestId': 'r-1',
    },
  };

  /// One detail family, described only through the seams these tests need.
  ///
  /// Every field is the family's own: its endpoint name, its canonical key, its
  /// stub-creation path, its resolution check and its detail read.
  final List<
    ({
      String label,
      String endpoint,
      String entityId,
      String resolvedName,
      String Function(String id) key,
      Future<void> Function(String id) createStub,
      Future<bool> Function(String id) hasResolved,
      Future<bool> Function(String id) hasDetailContent,
      Future<void> Function(String id) upsertAuthoritative,
      void Function(String? Function(String? etag) record, bool resolveOnRetry)
      script,
      Future<RefreshResult> Function(String id) refresh,
    })
  >
  families =
      <
        ({
          String label,
          String endpoint,
          String entityId,
          String resolvedName,
          String Function(String id) key,
          Future<void> Function(String id) createStub,
          Future<bool> Function(String id) hasResolved,
          Future<bool> Function(String id) hasDetailContent,
          Future<void> Function(String id) upsertAuthoritative,
          void Function(
            String? Function(String? etag) record,
            bool resolveOnRetry,
          )
          script,
          Future<RefreshResult> Function(String id) refresh,
        })
      >[
        (
          label: 'driver',
          endpoint: 'driver',
          entityId: 'ghost-driver',
          resolvedName: 'Ghost Driver',
          key: (String id) => ResourceKey.driver(id, season),
          createStub: (String id) => db.competitorDao.ensureDriverIdentity(id),
          hasResolved: (String id) => db.competitorDao.hasResolvedDriver(id),
          hasDetailContent: (String id) async =>
              (await db.competitorDao.driverProfile(season, id)) != null,
          upsertAuthoritative: (String id) => db.competitorDao.upsertDrivers(
            <Driver>[Driver(id: id, fullName: 'Real Driver')],
          ),
          script: (String? Function(String? etag) record, bool resolveOnRetry) {
            api.driver = (String? etag) {
              record(etag);
              if (etag != null) {
                return const RemoteNotModified<DriverDetailDto>();
              }
              if (!resolveOnRetry) {
                return const RemoteNotModified<DriverDetailDto>();
              }
              return modifiedFromJson<DriverDetailDto>(
                envelope(<String, dynamic>{
                  'driver': <String, dynamic>{
                    'id': 'ghost-driver',
                    'fullName': 'Ghost Driver',
                    'biography': 'Resolved by the recovery request.',
                  },
                }),
                (Object? d) =>
                    DriverDetailDto.fromJson(d! as Map<String, dynamic>),
                etag: 'W/"resolved"',
              );
            };
          },
          refresh: (String id) =>
              h.drivers.refreshDriver(driverId: id, season: season),
        ),
        (
          label: 'constructor',
          endpoint: 'constructor',
          entityId: 'ghost-team',
          resolvedName: 'Ghost Team',
          key: (String id) => ResourceKey.constructor(id, season),
          createStub: (String id) =>
              db.competitorDao.ensureConstructorIdentity(id),
          hasResolved: (String id) =>
              db.competitorDao.hasResolvedConstructor(id),
          hasDetailContent: (String id) async =>
              (await db.competitorDao.teamProfile(season, id)) != null,
          upsertAuthoritative: (String id) =>
              db.competitorDao.upsertConstructors(<Constructor>[
                Constructor(id: id, name: 'Real Team'),
              ]),
          script: (String? Function(String? etag) record, bool resolveOnRetry) {
            api.constructor = (String? etag) {
              record(etag);
              if (etag != null) {
                return const RemoteNotModified<ConstructorDetailDto>();
              }
              if (!resolveOnRetry) {
                return const RemoteNotModified<ConstructorDetailDto>();
              }
              return modifiedFromJson<ConstructorDetailDto>(
                envelope(<String, dynamic>{
                  'constructor': <String, dynamic>{
                    'id': 'ghost-team',
                    'name': 'Ghost Team',
                    'biography': 'Resolved by the recovery request.',
                  },
                }),
                (Object? d) =>
                    ConstructorDetailDto.fromJson(d! as Map<String, dynamic>),
                etag: 'W/"resolved"',
              );
            };
          },
          refresh: (String id) => h.constructors.refreshConstructor(
            constructorId: id,
            season: season,
          ),
        ),
        (
          label: 'circuit',
          endpoint: 'circuit',
          entityId: 'ghost-circuit',
          resolvedName: 'Ghost Circuit',
          key: (String id) => ResourceKey.circuit(id, season),
          createStub: (String id) => db.calendarDao.ensureCircuitIdentity(id),
          hasResolved: (String id) => db.calendarDao.hasResolvedCircuit(id),
          hasDetailContent: (String id) async =>
              (await db.calendarDao.circuitProfile(season, id)) != null,
          upsertAuthoritative: (String id) => db.calendarDao.upsertCircuits(
            <Circuit>[Circuit(id: id, name: 'Real Circuit')],
          ),
          script: (String? Function(String? etag) record, bool resolveOnRetry) {
            api.circuit = (String? etag) {
              record(etag);
              if (etag != null) {
                return const RemoteNotModified<CircuitDetailDto>();
              }
              if (!resolveOnRetry) {
                return const RemoteNotModified<CircuitDetailDto>();
              }
              return modifiedFromJson<CircuitDetailDto>(
                envelope(<String, dynamic>{
                  'circuit': <String, dynamic>{
                    'id': 'ghost-circuit',
                    'name': 'Ghost Circuit',
                    'lengthMeters': 5000,
                  },
                }),
                (Object? d) =>
                    CircuitDetailDto.fromJson(d! as Map<String, dynamic>),
                etag: 'W/"resolved"',
              );
            };
          },
          refresh: (String id) =>
              h.circuits.refreshCircuit(circuitId: id, season: season),
        ),
      ];

  for (final family in families) {
    group('${family.label} detail', () {
      /// Records every validator the endpoint saw, so a test can prove exactly
      /// how many requests were made and whether each was conditional.
      List<String?> sentEtags() {
        final List<String?> sent = <String?>[];
        family.script((String? etag) {
          sent.add(etag);
          return etag;
        }, true);
        return sent;
      }

      Future<void> storeEtag(String id, {String etag = 'W/"stale"'}) =>
          db.syncMetadataDao.upsert(
            ResourceSyncState(
              resourceKey: family.key(id),
              season: season,
              entityId: id,
              etag: etag,
            ),
          );

      test('a stub is never returned as detail content', () async {
        await family.createStub(family.entityId);
        expect(await family.hasResolved(family.entityId), isFalse);
        expect(await family.hasDetailContent(family.entityId), isFalse);
      });

      test(
        'stub-only state plus a 304 causes exactly one unconditional retry',
        () async {
          await family.createStub(family.entityId);
          await storeEtag(family.entityId);
          final List<String?> sent = sentEtags();

          await family.refresh(family.entityId);

          expect(
            sent,
            <String?>['W/"stale"', null],
            reason:
                'one conditional request, then exactly one unconditional retry',
          );
          expect(api.callsFor(family.endpoint), 2);
        },
      );

      test(
        'a successful retry resolves the identity and persists the detail',
        () async {
          await family.createStub(family.entityId);
          await storeEtag(family.entityId);
          sentEtags();

          final RefreshResult result = await family.refresh(family.entityId);

          expect(result, isA<RefreshSuccess>());
          expect(await family.hasResolved(family.entityId), isTrue);
          expect(await family.hasDetailContent(family.entityId), isTrue);

          final ResourceSyncState? meta = await db.syncMetadataDao.read(
            family.key(family.entityId),
          );
          expect(meta?.etag, 'W/"resolved"');
          expect(meta?.lastSuccessAt, isNotNull);
        },
      );

      test(
        'a 304 after a materialized authoritative detail does not retry',
        () async {
          // First: materialize the detail for real.
          await family.createStub(family.entityId);
          await storeEtag(family.entityId);
          sentEtags();
          expect(await family.refresh(family.entityId), isA<RefreshSuccess>());
          expect(await family.hasResolved(family.entityId), isTrue);

          // Now a plain 304 against the persisted validator.
          final List<String?> sent = sentEtags();
          final RefreshResult result = await family.refresh(family.entityId);

          expect(
            sent,
            <String?>['W/"resolved"'],
            reason: 'a materialized detail revalidates once and never retries',
          );
          expect(
            (result as RefreshSuccess).application,
            RefreshApplication.notModified,
          );
        },
      );

      test('a persistent 304 with no representation cannot loop', () async {
        await family.createStub(family.entityId);
        await storeEtag(family.entityId);
        // The retry answers 304 as well: an inconsistent cache/protocol.
        final List<String?> sent = <String?>[];
        family.script((String? etag) {
          sent.add(etag);
          return etag;
        }, false);

        final RefreshResult result = await family.refresh(family.entityId);

        expect(sent, <String?>['W/"stale"', null]);
        expect(
          api.callsFor(family.endpoint),
          2,
          reason: 'exactly two requests — the recovery never loops',
        );
        expect(result, isA<RefreshFailure>());
        expect(
          (result as RefreshFailure).failure.kind,
          ApiFailureKind.invalidResponse,
        );
        expect(await family.hasResolved(family.entityId), isFalse);
      });

      test(
        'a transient failure after the retry stays a typed failure',
        () async {
          await family.createStub(family.entityId);
          await storeEtag(family.entityId);

          final List<String?> sent = <String?>[];
          void scriptFailingRetry() {
            switch (family.label) {
              case 'driver':
                api.driver = (String? etag) {
                  sent.add(etag);
                  return etag != null
                      ? const RemoteNotModified<DriverDetailDto>()
                      : const RemoteFailure<DriverDetailDto>(
                          ApiFailure(kind: ApiFailureKind.networkUnavailable),
                        );
                };
              case 'constructor':
                api.constructor = (String? etag) {
                  sent.add(etag);
                  return etag != null
                      ? const RemoteNotModified<ConstructorDetailDto>()
                      : const RemoteFailure<ConstructorDetailDto>(
                          ApiFailure(kind: ApiFailureKind.networkUnavailable),
                        );
                };
              default:
                api.circuit = (String? etag) {
                  sent.add(etag);
                  return etag != null
                      ? const RemoteNotModified<CircuitDetailDto>()
                      : const RemoteFailure<CircuitDetailDto>(
                          ApiFailure(kind: ApiFailureKind.networkUnavailable),
                        );
                };
            }
          }

          scriptFailingRetry();
          final RefreshResult result = await family.refresh(family.entityId);

          expect(sent, <String?>['W/"stale"', null]);
          expect(result, isA<RefreshFailure>());
          expect(
            (result as RefreshFailure).failure.kind,
            ApiFailureKind.networkUnavailable,
          );
          // The stub relationship row survives: nothing was deleted, and it is
          // still not renderable content.
          expect(await family.hasResolved(family.entityId), isFalse);
          expect(await family.hasDetailContent(family.entityId), isFalse);
        },
      );

      test('an existing real identity is never downgraded to a stub', () async {
        await family.upsertAuthoritative(family.entityId);
        expect(await family.hasResolved(family.entityId), isTrue);

        // Another resource references the same id and ensures the foreign key.
        await family.createStub(family.entityId);

        expect(
          await family.hasResolved(family.entityId),
          isTrue,
          reason: 'ensure* is insert-or-ignore, never an overwrite',
        );
        expect(await family.hasDetailContent(family.entityId), isTrue);
      });

      test('a real identity makes a 304 a plain revalidation', () async {
        await family.upsertAuthoritative(family.entityId);
        await storeEtag(family.entityId, etag: 'W/"real"');
        final List<String?> sent = sentEtags();

        final RefreshResult result = await family.refresh(family.entityId);

        expect(sent, <String?>['W/"real"'], reason: 'no recovery retry');
        expect(
          (result as RefreshSuccess).application,
          RefreshApplication.notModified,
        );
      });
    });
  }

  test('the unresolved marker never leaks into a resolved name', () async {
    await db.competitorDao.ensureDriverIdentity('stub-driver');
    await db.competitorDao.ensureConstructorIdentity('stub-team');
    await db.calendarDao.ensureCircuitIdentity('stub-circuit');

    // The single detection path, used everywhere, agrees with the read models.
    expect(isUnresolvedIdentityName(kUnresolvedIdentityName), isTrue);
    expect(resolvedDisplayName(kUnresolvedIdentityName), isNull);
    expect(resolvedDisplayName('Real Name'), 'Real Name');

    expect(await db.competitorDao.seasonDriverCards(season), isEmpty);
    expect(await db.competitorDao.seasonTeamCards(season), isEmpty);
    expect(await db.calendarDao.seasonCircuitCards(season), isEmpty);
  });
}
