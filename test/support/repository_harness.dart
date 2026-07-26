import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/shared/data/remote/gridview_api.dart';
import 'package:gridview/features/shared/data/repositories/bootstrap_repository_impl.dart';
import 'package:gridview/features/shared/data/repositories/calendar_repository_impl.dart';
import 'package:gridview/features/shared/data/repositories/circuit_repository_impl.dart';
import 'package:gridview/features/shared/data/repositories/constructor_repository_impl.dart';
import 'package:gridview/features/shared/data/repositories/content_repository_impl.dart';
import 'package:gridview/features/shared/data/repositories/driver_repository_impl.dart';
import 'package:gridview/features/shared/data/repositories/grand_prix_repository_impl.dart';
import 'package:gridview/features/shared/data/repositories/home_repository_impl.dart';
import 'package:gridview/features/shared/data/repositories/result_repository_impl.dart';
import 'package:gridview/features/shared/data/repositories/season_repository_impl.dart';
import 'package:gridview/features/shared/data/repositories/standings_repository_impl.dart';
import 'package:gridview/features/shared/data/sync/refresh_coordinator.dart';
import 'package:gridview/features/shared/data/sync/resource_sync.dart';

/// Bundles every remote-to-local repository over a single database + remote API
/// + shared coordinator, for repository/persistence/concurrency tests. A fixed
/// [now] keeps freshness deterministic.
class RepositoryHarness {
  RepositoryHarness(
    this.db,
    this.api, {
    DateTime? now,
    RefreshCoordinator? coordinator,
  }) : sync = ResourceSync(db),
       coordinator = coordinator ?? RefreshCoordinator(),
       _now = now ?? DateTime.utc(2026, 7, 18, 12);

  final GridViewDatabase db;
  final GridViewApi api;
  final ResourceSync sync;
  final RefreshCoordinator coordinator;
  final DateTime _now;

  DateTime now() => _now;

  BootstrapRepositoryImpl get bootstrap => BootstrapRepositoryImpl(
    remote: api,
    sync: sync,
    coordinator: coordinator,
    now: now,
    seasons: db.seasonDao,
    calendar: db.calendarDao,
    competitors: db.competitorDao,
    standings: db.standingsDao,
    snapshots: db.verticalSliceDao,
  );

  SeasonRepositoryImpl get season => SeasonRepositoryImpl(
    remote: api,
    sync: sync,
    coordinator: coordinator,
    now: now,
    local: db.seasonDao,
  );

  HomeRepositoryImpl get home => HomeRepositoryImpl(
    remote: api,
    sync: sync,
    coordinator: coordinator,
    now: now,
    local: db.verticalSliceDao,
  );

  CalendarRepositoryImpl get calendar => CalendarRepositoryImpl(
    remote: api,
    sync: sync,
    coordinator: coordinator,
    now: now,
    local: db.calendarDao,
  );

  GrandPrixRepositoryImpl get grandPrix => GrandPrixRepositoryImpl(
    remote: api,
    sync: sync,
    coordinator: coordinator,
    now: now,
    local: db.verticalSliceDao,
    media: db.mediaDao,
  );

  ResultRepositoryImpl get results => ResultRepositoryImpl(
    remote: api,
    sync: sync,
    coordinator: coordinator,
    now: now,
    local: db.resultsDao,
  );

  StandingsRepositoryImpl get standings => StandingsRepositoryImpl(
    remote: api,
    sync: sync,
    coordinator: coordinator,
    now: now,
    local: db.standingsDao,
  );

  DriverRepositoryImpl get drivers => DriverRepositoryImpl(
    remote: api,
    sync: sync,
    coordinator: coordinator,
    now: now,
    local: db.competitorDao,
  );

  ConstructorRepositoryImpl get constructors => ConstructorRepositoryImpl(
    remote: api,
    sync: sync,
    coordinator: coordinator,
    now: now,
    local: db.competitorDao,
  );

  CircuitRepositoryImpl get circuits => CircuitRepositoryImpl(
    remote: api,
    sync: sync,
    coordinator: coordinator,
    now: now,
    local: db.calendarDao,
  );

  ContentRepositoryImpl get content => ContentRepositoryImpl(
    remote: api,
    sync: sync,
    coordinator: coordinator,
    now: now,
  );
}
