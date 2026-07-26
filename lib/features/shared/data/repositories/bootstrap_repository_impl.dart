// ignore_for_file: prefer_initializing_formals
import '../../../../core/api/dto/event_dto.dart';
import '../../../../core/api/dto/summary_dto.dart';
import '../../../../core/api/dto/view_dto.dart';
import '../../../../core/database/daos/calendar_dao.dart';
import '../../../../core/database/daos/competitor_dao.dart';
import '../../../../core/database/daos/season_dao.dart';
import '../../../../core/database/daos/standings_dao.dart';
import '../../../../core/database/daos/vertical_slice_dao.dart';
import '../../domain/entities/circuit.dart';
import '../../domain/entities/grand_prix.dart';
import '../../domain/entities/resource_key.dart';
import '../../domain/entities/season.dart';
import '../../domain/entities/session.dart';
import '../../domain/entities/sync_state.dart';
import '../../domain/refresh_result.dart';
import '../../domain/repositories/bootstrap_repository.dart';
import '../mappers/competitor_mapper.dart';
import '../mappers/event_mapper.dart';
import '../mappers/freshness_mapper.dart';
import '../mappers/home_mapper.dart';
import '../mappers/standing_mapper.dart';
import '../mappers/summary_mapper.dart';
import '../remote/remote_cancellation.dart';
import '../remote/remote_result.dart';
import '../sync/resource_snapshot.dart';
import 'synced_repository.dart';

/// The first-launch aggregate as a single conditional resource.
///
/// **One representation, one ETag.** Bootstrap is fetched, conflict-checked and
/// persisted exactly like any other resource, through the shared
/// [SyncedRepository] pipeline: its validator, provenance and success timestamps
/// live under [ResourceKey.bootstrap] and nowhere else. The compact families it
/// carries never inherit that validator — `home`, `calendar:<season>`,
/// `standings:*`, `drivers:*`, `constructors:*`, `circuits:*` and
/// `content:manifest` each earn their own metadata only when their own endpoint
/// is refreshed. Fabricating per-family ETags here would let a later conditional
/// request claim a validator the server never issued for that URL.
///
/// **One transaction.** [ResourceSync] opens a single transaction around the
/// conflict decision, the whole domain write and the success metadata, so a
/// failure in any family — or in the metadata write — rolls back every other
/// bootstrap change and leaves the previous cache intact.
///
/// **Compact data never downgrades detail data.** Every write below is either a
/// partial-identity upsert (fields the summary actually carries) or a
/// season-scoped replacement of a collection the contract defines as complete
/// for that season. Unrelated seasons, detail-owned biographies, circuit
/// physical facts, detail-synced sessions, media and results are untouched.
class BootstrapRepositoryImpl extends SyncedRepository
    implements BootstrapRepository {
  BootstrapRepositoryImpl({
    required super.remote,
    required super.sync,
    required super.coordinator,
    required super.now,
    required SeasonDao seasons,
    required CalendarDao calendar,
    required CompetitorDao competitors,
    required StandingsDao standings,
    required VerticalSliceDao snapshots,
  }) : _seasons = seasons,
       _calendar = calendar,
       _competitors = competitors,
       _standings = standings,
       _snapshots = snapshots;

  final SeasonDao _seasons;
  final CalendarDao _calendar;
  final CompetitorDao _competitors;
  final StandingsDao _standings;
  final VerticalSliceDao _snapshots;

  @override
  Future<bool> isMaterialized() async =>
      _bootstrapRepresentation(await sync.read(ResourceKey.bootstrap()));

  @override
  Future<RefreshResult> refreshBootstrap({
    bool bypassValidator = false,
    RemoteCancellation? cancellation,
  }) {
    return refreshResource<BootstrapDataDto>(
      key: ResourceKey.bootstrap(),
      // Bootstrap always asks for the server's current season, so its metadata
      // row carries no season scope: the key is a single global representation
      // and the payload names whichever season is current.
      scope: ResourceScope.none,
      fetch: ({String? etag, RemoteCancellation? cancellation}) =>
          remote.fetchBootstrap(etag: etag, cancellation: cancellation),
      // The provenance is bootstrap's own response meta. `data.contentVersion`
      // and `data.mediaVersion` are informational echoes of the content
      // manifest: recording them under `content:manifest` would forge that
      // resource's metadata, so they drive no local write here.
      metaOf: (RemoteModified<BootstrapDataDto> m) =>
          RemoteSnapshotMeta.fromMeta(
            m.meta,
            etag: m.etag,
            serverStale: m.data.home.freshness.stale,
          ),
      writeDomain: _writeBootstrap,
      hasLocalRepresentation: _bootstrapRepresentation,
      cancellation: cancellation,
      bypassValidator: bypassValidator,
    );
  }

  /// A bootstrap representation exists when a successful bootstrap has been
  /// recorded **and** the current-season identity its stored data needs to
  /// render is present. Collection emptiness is deliberately not consulted: a
  /// season with no events yet is a valid, materialized bootstrap.
  Future<bool> _bootstrapRepresentation(ResourceSyncState? storedMeta) async {
    if (storedMeta?.lastSuccessAt == null) return false;
    return (await _seasons.countCurrentSeason()) > 0;
  }

  /// Persists every contract-defined bootstrap family. Runs inside the single
  /// transaction opened by [ResourceSync], so any throw rolls the whole
  /// bootstrap back.
  Future<void> _writeBootstrap(
    RemoteModified<BootstrapDataDto> modified,
  ) async {
    final BootstrapDataDto data = modified.data;
    final Season season = seasonFromDto(data.season);
    final int year = season.year;

    // 1. Season identity. `isCurrent` comes from the payload, never assumed:
    //    marking it current clears the flag on every other season atomically,
    //    while their rows and data stay untouched.
    if (season.isCurrent) {
      await _seasons.setCurrentSeason(season);
    } else {
      await _seasons.upsertSeason(season);
    }

    // 2. Calendar — complete and authoritative for this season (OpenAPI
    //    `BootstrapData.calendar`). Surviving events keep their detail-synced
    //    sessions, official name and media; other seasons are untouched.
    await _calendar.replaceCalendar(
      year,
      data.calendar
          .map((GrandPrixSummaryDto e) => grandPrixFromSummaryDto(e))
          .toList(growable: false),
      <Circuit>[
        for (final GrandPrixSummaryDto e in data.calendar)
          if (circuitFromSummaryDto(e) case final Circuit c) c,
      ],
    );

    // 3. Circuit summaries — a compact upsert that never deletes (a circuit may
    //    be referenced by another season) and never clobbers detail-synced
    //    coordinates, length, corner count, lap record or media.
    await _calendar.upsertCircuitSummaries(
      data.circuits.map(circuitFromCircuitSummaryDto).toList(growable: false),
    );

    // 4. Drivers — identity upsert first (preserves detail-owned biography and
    //    media), then the season's participation, complete for this season.
    await _competitors.upsertDriverIdentities(
      data.drivers.map(driverIdentityFromSeasonSummary).toList(growable: false),
    );
    await _competitors.replaceDriverSeasonEntries(
      year,
      data.drivers
          .map(
            (SeasonDriverSummaryDto d) =>
                driverSeasonEntryFromSeasonSummary(d, year),
          )
          .toList(growable: false),
    );

    // 5. Constructors — same shape: identity upsert, then season branding.
    await _competitors.upsertConstructorIdentities(
      data.constructors
          .map(constructorIdentityFromSeasonSummary)
          .toList(growable: false),
    );
    await _competitors.replaceConstructorSeasonEntries(
      year,
      data.constructors
          .map(
            (SeasonConstructorSummaryDto c) =>
                constructorSeasonEntryFromSeasonSummary(c, year),
          )
          .toList(growable: false),
    );

    // 6. Standings — each table is complete for the season.
    await _standings.replaceDriverStandings(
      year,
      data.driverStandings.map(driverStandingFromDto).toList(growable: false),
    );
    await _standings.replaceConstructorStandings(
      year,
      data.constructorStandings
          .map(constructorStandingFromDto)
          .toList(growable: false),
    );

    // 7. Home snapshot. Unlike `GET /v1/home`, the bootstrap contract permits a
    //    Home block with no featured event (a season with nothing scheduled
    //    yet), so an absent featured event is not an invalid payload here — it
    //    simply leaves the Home snapshot unwritten rather than failing the whole
    //    bootstrap.
    await _writeHomeFromBootstrap(data.home, modified);
  }

  Future<void> _writeHomeFromBootstrap(
    HomeDataDto home,
    RemoteModified<BootstrapDataDto> modified,
  ) async {
    final GrandPrixSummaryDto? featuredDto = home.featuredEvent;
    if (featuredDto == null) return;

    final List<Session> sessions = home.featuredSession == null
        ? const <Session>[]
        : <Session>[sessionFromDto(home.featuredSession!)];
    final GrandPrix featured = grandPrixFromSummaryDto(
      featuredDto,
      sessions: sessions,
    );
    // The outer pipeline already applied the conflict rule against
    // resource_sync_metadata for the bootstrap representation, so the
    // snapshots-table gate (which only guards direct DAO callers) is forced.
    await _snapshots.writeHomeSnapshot(
      featured: featured,
      featuredCircuit: circuitFromSummaryDto(featuredDto),
      freshness: freshnessFromMeta(modified.meta),
      force: true,
    );
  }
}
