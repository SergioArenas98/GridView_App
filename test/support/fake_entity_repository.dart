import 'package:gridview/features/shared/data/remote/remote_cancellation.dart';
import 'package:gridview/features/shared/domain/entities/circuit.dart';
import 'package:gridview/features/shared/domain/entities/detail_views.dart';
import 'package:gridview/features/shared/domain/entities/entity_profile.dart';
import 'package:gridview/features/shared/domain/entities/season_card.dart';
import 'package:gridview/features/shared/domain/refresh_result.dart';
import 'package:gridview/features/shared/domain/repositories/circuit_repository.dart';
import 'package:gridview/features/shared/domain/repositories/constructor_repository.dart';
import 'package:gridview/features/shared/domain/repositories/driver_repository.dart';

/// One recorded on-demand detail refresh: which entity, for which season.
///
/// Tests assert on these to prove a detail requested **exactly** its own
/// resource, at most once per entry, for the exact resolved season — and that a
/// rebuild or a local emission produced no extra request.
typedef DetailRefreshCall = ({String entityId, int season});

/// Fake [DriverRepository]: independent collection and detail streams, separate
/// refresh hooks and separate call counters.
///
/// The collection and the detail are deliberately kept apart, so a test can
/// prove that opening a detail never refreshed the collection and that the two
/// never share metadata.
class FakeDriverRepository implements DriverRepository {
  FakeDriverRepository({
    this.cards,
    this.cardsStream,
    this.profile,
    this.profileStream,
    this.onRefreshCollection,
    this.onRefreshDetail,
  });

  final List<SeasonDriverCard> Function(int season)? cards;
  final Stream<List<SeasonDriverCard>> Function(int season)? cardsStream;

  final DriverProfile? Function(int season, String driverId)? profile;
  final Stream<DriverProfile?> Function(int season, String driverId)?
  profileStream;

  final Future<RefreshResult> Function(int season)? onRefreshCollection;
  final Future<RefreshResult> Function(String driverId, int season)?
  onRefreshDetail;

  final List<int> collectionRefreshSeasons = <int>[];
  final List<DetailRefreshCall> detailRefreshes = <DetailRefreshCall>[];

  int get collectionRefreshCount => collectionRefreshSeasons.length;
  int get detailRefreshCount => detailRefreshes.length;

  @override
  Stream<List<SeasonDriverCard>> watchSeasonDriverCards(int season) =>
      cardsStream?.call(season) ??
      Stream<List<SeasonDriverCard>>.value(
        cards?.call(season) ?? const <SeasonDriverCard>[],
      );

  @override
  Future<List<SeasonDriverCard>> readSeasonDriverCards(int season) =>
      watchSeasonDriverCards(season).first;

  @override
  Stream<DriverProfile?> watchDriverProfile({
    required int season,
    required String driverId,
  }) =>
      profileStream?.call(season, driverId) ??
      Stream<DriverProfile?>.value(profile?.call(season, driverId));

  @override
  Future<DriverProfile?> readDriverProfile({
    required int season,
    required String driverId,
  }) => watchDriverProfile(season: season, driverId: driverId).first;

  @override
  Future<RefreshResult> refreshSeasonDrivers(
    int season, {
    bool bypassValidator = false,
    RemoteCancellation? cancellation,
  }) {
    collectionRefreshSeasons.add(season);
    return onRefreshCollection?.call(season) ??
        Future<RefreshResult>.value(const RefreshSuccess());
  }

  @override
  Future<RefreshResult> refreshDriver({
    required String driverId,
    required int season,
    bool bypassValidator = false,
    RemoteCancellation? cancellation,
  }) {
    detailRefreshes.add((entityId: driverId, season: season));
    return onRefreshDetail?.call(driverId, season) ??
        Future<RefreshResult>.value(const RefreshSuccess());
  }

  // --- Legacy views, unused by Phase 7C presentation -----------------------
  @override
  Stream<List<SeasonDriver>> watchSeasonDrivers(int season) =>
      Stream<List<SeasonDriver>>.value(const <SeasonDriver>[]);

  @override
  Future<List<SeasonDriver>> readSeasonDrivers(int season) async =>
      const <SeasonDriver>[];

  @override
  Stream<DriverDetailView?> watchDriver({
    required int season,
    required String driverId,
  }) => Stream<DriverDetailView?>.value(null);

  @override
  Future<DriverDetailView?> readDriver({
    required int season,
    required String driverId,
  }) async => null;
}

/// Fake [ConstructorRepository]. See [FakeDriverRepository].
class FakeConstructorRepository implements ConstructorRepository {
  FakeConstructorRepository({
    this.cards,
    this.cardsStream,
    this.profile,
    this.profileStream,
    this.onRefreshCollection,
    this.onRefreshDetail,
  });

  final List<SeasonTeamCard> Function(int season)? cards;
  final Stream<List<SeasonTeamCard>> Function(int season)? cardsStream;

  final TeamProfile? Function(int season, String constructorId)? profile;
  final Stream<TeamProfile?> Function(int season, String constructorId)?
  profileStream;

  final Future<RefreshResult> Function(int season)? onRefreshCollection;
  final Future<RefreshResult> Function(String constructorId, int season)?
  onRefreshDetail;

  final List<int> collectionRefreshSeasons = <int>[];
  final List<DetailRefreshCall> detailRefreshes = <DetailRefreshCall>[];

  int get collectionRefreshCount => collectionRefreshSeasons.length;
  int get detailRefreshCount => detailRefreshes.length;

  @override
  Stream<List<SeasonTeamCard>> watchSeasonTeamCards(int season) =>
      cardsStream?.call(season) ??
      Stream<List<SeasonTeamCard>>.value(
        cards?.call(season) ?? const <SeasonTeamCard>[],
      );

  @override
  Future<List<SeasonTeamCard>> readSeasonTeamCards(int season) =>
      watchSeasonTeamCards(season).first;

  @override
  Stream<TeamProfile?> watchTeamProfile({
    required int season,
    required String constructorId,
  }) =>
      profileStream?.call(season, constructorId) ??
      Stream<TeamProfile?>.value(profile?.call(season, constructorId));

  @override
  Future<TeamProfile?> readTeamProfile({
    required int season,
    required String constructorId,
  }) => watchTeamProfile(season: season, constructorId: constructorId).first;

  @override
  Future<RefreshResult> refreshSeasonConstructors(
    int season, {
    bool bypassValidator = false,
    RemoteCancellation? cancellation,
  }) {
    collectionRefreshSeasons.add(season);
    return onRefreshCollection?.call(season) ??
        Future<RefreshResult>.value(const RefreshSuccess());
  }

  @override
  Future<RefreshResult> refreshConstructor({
    required String constructorId,
    required int season,
    bool bypassValidator = false,
    RemoteCancellation? cancellation,
  }) {
    detailRefreshes.add((entityId: constructorId, season: season));
    return onRefreshDetail?.call(constructorId, season) ??
        Future<RefreshResult>.value(const RefreshSuccess());
  }

  // --- Legacy views, unused by Phase 7C presentation -----------------------
  @override
  Stream<List<SeasonConstructor>> watchSeasonConstructors(int season) =>
      Stream<List<SeasonConstructor>>.value(const <SeasonConstructor>[]);

  @override
  Future<List<SeasonConstructor>> readSeasonConstructors(int season) async =>
      const <SeasonConstructor>[];

  @override
  Stream<TeamDetailView?> watchConstructor({
    required int season,
    required String constructorId,
  }) => Stream<TeamDetailView?>.value(null);

  @override
  Future<TeamDetailView?> readConstructor({
    required int season,
    required String constructorId,
  }) async => null;
}

/// Fake [CircuitRepository]. See [FakeDriverRepository].
class FakeCircuitRepository implements CircuitRepository {
  FakeCircuitRepository({
    this.cards,
    this.cardsStream,
    this.profile,
    this.profileStream,
    this.onRefreshCollection,
    this.onRefreshDetail,
  });

  final List<SeasonCircuitCard> Function(int season)? cards;
  final Stream<List<SeasonCircuitCard>> Function(int season)? cardsStream;

  final CircuitProfile? Function(int season, String circuitId)? profile;
  final Stream<CircuitProfile?> Function(int season, String circuitId)?
  profileStream;

  final Future<RefreshResult> Function(int season)? onRefreshCollection;
  final Future<RefreshResult> Function(String circuitId, int season)?
  onRefreshDetail;

  final List<int> collectionRefreshSeasons = <int>[];
  final List<DetailRefreshCall> detailRefreshes = <DetailRefreshCall>[];

  int get collectionRefreshCount => collectionRefreshSeasons.length;
  int get detailRefreshCount => detailRefreshes.length;

  @override
  Stream<List<SeasonCircuitCard>> watchSeasonCircuitCards(int season) =>
      cardsStream?.call(season) ??
      Stream<List<SeasonCircuitCard>>.value(
        cards?.call(season) ?? const <SeasonCircuitCard>[],
      );

  @override
  Future<List<SeasonCircuitCard>> readSeasonCircuitCards(int season) =>
      watchSeasonCircuitCards(season).first;

  @override
  Stream<CircuitProfile?> watchCircuitProfile({
    required int season,
    required String circuitId,
  }) =>
      profileStream?.call(season, circuitId) ??
      Stream<CircuitProfile?>.value(profile?.call(season, circuitId));

  @override
  Future<CircuitProfile?> readCircuitProfile({
    required int season,
    required String circuitId,
  }) => watchCircuitProfile(season: season, circuitId: circuitId).first;

  @override
  Future<RefreshResult> refreshSeasonCircuits(
    int season, {
    bool bypassValidator = false,
    RemoteCancellation? cancellation,
  }) {
    collectionRefreshSeasons.add(season);
    return onRefreshCollection?.call(season) ??
        Future<RefreshResult>.value(const RefreshSuccess());
  }

  @override
  Future<RefreshResult> refreshCircuit({
    required String circuitId,
    required int season,
    bool bypassValidator = false,
    RemoteCancellation? cancellation,
  }) {
    detailRefreshes.add((entityId: circuitId, season: season));
    return onRefreshDetail?.call(circuitId, season) ??
        Future<RefreshResult>.value(const RefreshSuccess());
  }

  // --- Legacy views, unused by Phase 7C presentation -----------------------
  @override
  Stream<List<Circuit>> watchSeasonCircuits(int season) =>
      Stream<List<Circuit>>.value(const <Circuit>[]);

  @override
  Future<List<Circuit>> readSeasonCircuits(int season) async =>
      const <Circuit>[];

  @override
  Stream<CircuitDetailView?> watchCircuit(String circuitId) =>
      Stream<CircuitDetailView?>.value(null);

  @override
  Future<CircuitDetailView?> readCircuit(String circuitId) async => null;
}
