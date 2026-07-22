// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'standings_dao.dart';

// ignore_for_file: type=lint
mixin _$StandingsDaoMixin on DatabaseAccessor<GridViewDatabase> {
  $SeasonsTable get seasons => attachedDatabase.seasons;
  $DriversTable get drivers => attachedDatabase.drivers;
  $ConstructorsTable get constructors => attachedDatabase.constructors;
  $DriverStandingsTable get driverStandings => attachedDatabase.driverStandings;
  $ConstructorStandingsTable get constructorStandings =>
      attachedDatabase.constructorStandings;
  StandingsDaoManager get managers => StandingsDaoManager(this);
}

class StandingsDaoManager {
  final _$StandingsDaoMixin _db;
  StandingsDaoManager(this._db);
  $$SeasonsTableTableManager get seasons =>
      $$SeasonsTableTableManager(_db.attachedDatabase, _db.seasons);
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
}
