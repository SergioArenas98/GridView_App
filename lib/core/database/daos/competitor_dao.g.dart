// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'competitor_dao.dart';

// ignore_for_file: type=lint
mixin _$CompetitorDaoMixin on DatabaseAccessor<GridViewDatabase> {
  $DriversTable get drivers => attachedDatabase.drivers;
  $ConstructorsTable get constructors => attachedDatabase.constructors;
  $SeasonsTable get seasons => attachedDatabase.seasons;
  $DriverSeasonEntriesTable get driverSeasonEntries =>
      attachedDatabase.driverSeasonEntries;
  $ConstructorSeasonEntriesTable get constructorSeasonEntries =>
      attachedDatabase.constructorSeasonEntries;
  CompetitorDaoManager get managers => CompetitorDaoManager(this);
}

class CompetitorDaoManager {
  final _$CompetitorDaoMixin _db;
  CompetitorDaoManager(this._db);
  $$DriversTableTableManager get drivers =>
      $$DriversTableTableManager(_db.attachedDatabase, _db.drivers);
  $$ConstructorsTableTableManager get constructors =>
      $$ConstructorsTableTableManager(_db.attachedDatabase, _db.constructors);
  $$SeasonsTableTableManager get seasons =>
      $$SeasonsTableTableManager(_db.attachedDatabase, _db.seasons);
  $$DriverSeasonEntriesTableTableManager get driverSeasonEntries =>
      $$DriverSeasonEntriesTableTableManager(
        _db.attachedDatabase,
        _db.driverSeasonEntries,
      );
  $$ConstructorSeasonEntriesTableTableManager get constructorSeasonEntries =>
      $$ConstructorSeasonEntriesTableTableManager(
        _db.attachedDatabase,
        _db.constructorSeasonEntries,
      );
}
