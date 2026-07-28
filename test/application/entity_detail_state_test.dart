import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/features/shared/application/entity_detail_state.dart';
import 'package:gridview/features/shared/domain/entities/entity_profile.dart';
import 'package:gridview/features/shared/domain/entities/sync_state.dart';
import 'package:gridview/features/shared/domain/freshness_evaluator.dart';

import '../support/entity_fixtures.dart';

/// The shared entity-detail state derivation, in isolation.
///
/// The central rule: a real local entity always renders, and only the **exact
/// detail resource's** own metadata may claim that the detail is materialized or
/// carry its freshness. A collection-derived summary is real content that
/// nonetheless claims nothing about the detail endpoint.
void main() {
  final DateTime now = DateTime.utc(2026, 7, 18, 12);
  const int season = 2026;

  ResourceSyncState detailMeta({DateTime? staleAfter}) => ResourceSyncState(
    resourceKey: 'driver:max-verstappen:2026',
    season: season,
    lastSuccessAt: now.subtract(const Duration(minutes: 5)),
    generatedAt: now.subtract(const Duration(minutes: 5)),
    staleAfter: staleAfter,
  );

  EntityDetailState<DriverProfile> derive({
    int? forSeason = season,
    bool seasonReady = true,
    DriverProfile? profile,
    bool profileReady = true,
    ResourceSyncState? metadata,
    bool metadataReady = true,
    bool refreshing = false,
    ApiFailure? lastFailure,
    bool notFound = false,
  }) => computeEntityDetailState<DriverProfile>(
    season: forSeason,
    seasonReady: seasonReady,
    profile: profile,
    profileReady: profileReady,
    metadata: metadata,
    metadataReady: metadataReady,
    refreshing: refreshing,
    lastFailure: lastFailure,
    notFound: notFound,
    now: now,
  );

  group('season context', () {
    test('an unresolved season while resolving is loading', () {
      expect(
        derive(forSeason: null, seasonReady: false),
        isA<EntityDetailLoading<DriverProfile>>(),
      );
    });

    test(
      'a resolved-but-absent season is season-unavailable, never a request',
      () {
        expect(
          derive(forSeason: null),
          isA<EntityDetailSeasonUnavailable<DriverProfile>>(),
        );
      },
    );

    test('a refresh in flight keeps an unresolved season in loading', () {
      expect(
        derive(forSeason: null, refreshing: true),
        isA<EntityDetailLoading<DriverProfile>>(),
      );
    });
  });

  group('partial versus materialized', () {
    test('a collection-derived profile renders without claiming freshness', () {
      final state = derive(profile: partialDriverProfileFixture());
      final ready = state as EntityDetailReady<DriverProfile>;
      expect(ready.materialized, isFalse);
      expect(
        ready.freshness,
        isNull,
        reason: 'a collection never vouches for a detail',
      );
      expect(ready.lastSuccessAt, isNull);
      expect(ready.profile.driver.fullName, 'Max Verstappen');
    });

    test('a materialized detail reports its own exact freshness', () {
      final state = derive(
        profile: driverProfileFixture(),
        metadata: detailMeta(),
      );
      final ready = state as EntityDetailReady<DriverProfile>;
      expect(ready.materialized, isTrue);
      expect(ready.freshness, FreshnessState.fresh);
      expect(ready.lastSuccessAt, isNotNull);
    });

    test('a stale materialized detail stays visible and reports stale', () {
      final state = derive(
        profile: driverProfileFixture(),
        metadata: detailMeta(
          staleAfter: now.subtract(const Duration(minutes: 1)),
        ),
      );
      final ready = state as EntityDetailReady<DriverProfile>;
      expect(ready.isStale, isTrue);
      expect(ready.profile.driver.fullName, isNotEmpty);
    });
  });

  group('not found', () {
    test('a 404 with no local entity is a definitive not-found', () {
      expect(
        derive(notFound: true),
        isA<EntityDetailNotFound<DriverProfile>>(),
      );
    });

    test('a 404 with a real local summary keeps the content visible', () {
      final state = derive(
        profile: partialDriverProfileFixture(),
        notFound: true,
      );
      final ready = state as EntityDetailReady<DriverProfile>;
      expect(ready.detailUnavailable, isTrue);
      expect(ready.refreshError, isNull, reason: 'focused, not a page error');
      expect(ready.profile.driver.fullName, 'Max Verstappen');
    });

    test('a definitive not-found outranks a transient failure', () {
      expect(
        derive(
          notFound: true,
          lastFailure: const ApiFailure(kind: ApiFailureKind.networkTimeout),
        ),
        isA<EntityDetailNotFound<DriverProfile>>(),
      );
    });
  });

  group('failures', () {
    test(
      'no local entity plus a failure is a recoverable first-load error',
      () {
        final state = derive(
          lastFailure: const ApiFailure(kind: ApiFailureKind.serverUnavailable),
        );
        expect(state, isA<EntityDetailFirstLoadError<DriverProfile>>());
        expect(
          (state as EntityDetailFirstLoadError<DriverProfile>).failure.cause,
          EntityDetailFailureCause.resourceFailed,
        );
      },
    );

    test('cached content survives a refresh failure', () {
      final state = derive(
        profile: driverProfileFixture(),
        metadata: detailMeta(),
        lastFailure: const ApiFailure(kind: ApiFailureKind.networkUnavailable),
      );
      final ready = state as EntityDetailReady<DriverProfile>;
      expect(ready.profile.driver.fullName, 'Max Verstappen');
      expect(ready.refreshError, isNotNull);
    });

    test('a failure is not reported while the refresh is still running', () {
      final state = derive(
        profile: driverProfileFixture(),
        metadata: detailMeta(),
        refreshing: true,
        lastFailure: const ApiFailure(kind: ApiFailureKind.networkUnavailable),
      );
      final ready = state as EntityDetailReady<DriverProfile>;
      expect(ready.refreshing, isTrue);
      expect(ready.refreshError, isNull);
    });

    test('an unready profile or metadata stream is loading', () {
      expect(
        derive(profileReady: false),
        isA<EntityDetailLoading<DriverProfile>>(),
      );
      expect(
        derive(metadataReady: false),
        isA<EntityDetailLoading<DriverProfile>>(),
      );
    });
  });

  group('profile section availability', () {
    test('a partial driver profile reports no detail-owned facts', () {
      expect(partialDriverProfileFixture().hasProfileFacts, isFalse);
    });

    test('a complete driver profile reports its facts', () {
      expect(driverProfileFixture().hasProfileFacts, isTrue);
    });

    test('a partial team profile reports no season facts', () {
      final TeamProfile team = partialTeamProfileFixture();
      expect(team.hasSeasonFacts, isFalse);
      expect(team.hasProfileFacts, isFalse);
      expect(
        team.displayName,
        'BWT Alpine Formula One Team',
        reason: 'season branding still decides the display name',
      );
      expect(team.stableFallbackName, 'Alpine');
    });

    test('a team whose branding equals its stable name shows no fallback', () {
      final TeamProfile team = teamProfileFixture(seasonName: null);
      expect(team.displayName, 'Alpine');
      expect(team.stableFallbackName, isNull);
    });

    test('a circuit profile separates physical facts from the event', () {
      final CircuitProfile circuit = circuitProfileFixture();
      expect(circuit.hasPhysicalFacts, isTrue);
      expect(circuit.hasLapRecord, isTrue);
      expect(circuit.relatedGrandPrix!.round, 13);

      final CircuitProfile bare = circuitProfileFixture(
        lengthMeters: null,
        cornerCount: null,
        direction: null,
        firstGrandPrixYear: null,
        withLapRecord: false,
        withRelated: false,
      );
      expect(bare.hasPhysicalFacts, isFalse);
      expect(bare.hasLapRecord, isFalse);
      expect(
        bare.relatedGrandPrix,
        isNull,
        reason: 'hosting no event this season is valid, not an error',
      );
    });
  });
}
