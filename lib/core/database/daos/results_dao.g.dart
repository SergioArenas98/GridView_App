// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'results_dao.dart';

// ignore_for_file: type=lint
mixin _$ResultsDaoMixin on DatabaseAccessor<GridViewDatabase> {
  $SeasonsTable get seasons => attachedDatabase.seasons;
  $CircuitsTable get circuits => attachedDatabase.circuits;
  $GrandPrixEventsTable get grandPrixEvents => attachedDatabase.grandPrixEvents;
  $RaceResultsTable get raceResults => attachedDatabase.raceResults;
  $DriversTable get drivers => attachedDatabase.drivers;
  $ConstructorsTable get constructors => attachedDatabase.constructors;
  $RaceResultEntriesTable get raceResultEntries =>
      attachedDatabase.raceResultEntries;
  ResultsDaoManager get managers => ResultsDaoManager(this);
}

class ResultsDaoManager {
  final _$ResultsDaoMixin _db;
  ResultsDaoManager(this._db);
  $$SeasonsTableTableManager get seasons =>
      $$SeasonsTableTableManager(_db.attachedDatabase, _db.seasons);
  $$CircuitsTableTableManager get circuits =>
      $$CircuitsTableTableManager(_db.attachedDatabase, _db.circuits);
  $$GrandPrixEventsTableTableManager get grandPrixEvents =>
      $$GrandPrixEventsTableTableManager(
        _db.attachedDatabase,
        _db.grandPrixEvents,
      );
  $$RaceResultsTableTableManager get raceResults =>
      $$RaceResultsTableTableManager(_db.attachedDatabase, _db.raceResults);
  $$DriversTableTableManager get drivers =>
      $$DriversTableTableManager(_db.attachedDatabase, _db.drivers);
  $$ConstructorsTableTableManager get constructors =>
      $$ConstructorsTableTableManager(_db.attachedDatabase, _db.constructors);
  $$RaceResultEntriesTableTableManager get raceResultEntries =>
      $$RaceResultEntriesTableTableManager(
        _db.attachedDatabase,
        _db.raceResultEntries,
      );
}
