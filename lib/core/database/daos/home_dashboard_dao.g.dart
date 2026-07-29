// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'home_dashboard_dao.dart';

// ignore_for_file: type=lint
mixin _$HomeDashboardDaoMixin on DatabaseAccessor<GridViewDatabase> {
  $SnapshotsTable get snapshots => attachedDatabase.snapshots;
  $SeasonsTable get seasons => attachedDatabase.seasons;
  $CircuitsTable get circuits => attachedDatabase.circuits;
  $GrandPrixEventsTable get grandPrixEvents => attachedDatabase.grandPrixEvents;
  $SessionsTable get sessions => attachedDatabase.sessions;
  $DriversTable get drivers => attachedDatabase.drivers;
  $ConstructorsTable get constructors => attachedDatabase.constructors;
  $DriverStandingsTable get driverStandings => attachedDatabase.driverStandings;
  $ConstructorStandingsTable get constructorStandings =>
      attachedDatabase.constructorStandings;
  $RaceResultsTable get raceResults => attachedDatabase.raceResults;
  HomeDashboardDaoManager get managers => HomeDashboardDaoManager(this);
}

class HomeDashboardDaoManager {
  final _$HomeDashboardDaoMixin _db;
  HomeDashboardDaoManager(this._db);
  $$SnapshotsTableTableManager get snapshots =>
      $$SnapshotsTableTableManager(_db.attachedDatabase, _db.snapshots);
  $$SeasonsTableTableManager get seasons =>
      $$SeasonsTableTableManager(_db.attachedDatabase, _db.seasons);
  $$CircuitsTableTableManager get circuits =>
      $$CircuitsTableTableManager(_db.attachedDatabase, _db.circuits);
  $$GrandPrixEventsTableTableManager get grandPrixEvents =>
      $$GrandPrixEventsTableTableManager(
        _db.attachedDatabase,
        _db.grandPrixEvents,
      );
  $$SessionsTableTableManager get sessions =>
      $$SessionsTableTableManager(_db.attachedDatabase, _db.sessions);
  $$DriversTableTableManager get drivers =>
      $$DriversTableTableManager(_db.attachedDatabase, _db.drivers);
  $$ConstructorsTableTableManager get constructors =>
      $$ConstructorsTableTableManager(_db.attachedDatabase, _db.constructors);
  $$DriverStandingsTableTableManager get driverStandings =>
      $$DriverStandingsTableTableManager(
        _db.attachedDatabase,
        _db.driverStandings,
      );
  $$ConstructorStandingsTableTableManager get constructorStandings =>
      $$ConstructorStandingsTableTableManager(
        _db.attachedDatabase,
        _db.constructorStandings,
      );
  $$RaceResultsTableTableManager get raceResults =>
      $$RaceResultsTableTableManager(_db.attachedDatabase, _db.raceResults);
}
