// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'media_dao.dart';

// ignore_for_file: type=lint
mixin _$MediaDaoMixin on DatabaseAccessor<GridViewDatabase> {
  $MediaAssetsTable get mediaAssets => attachedDatabase.mediaAssets;
  $MediaAssetVariantsTable get mediaAssetVariants =>
      attachedDatabase.mediaAssetVariants;
  $DriversTable get drivers => attachedDatabase.drivers;
  $DriverMediaTable get driverMedia => attachedDatabase.driverMedia;
  $ConstructorsTable get constructors => attachedDatabase.constructors;
  $ConstructorMediaTable get constructorMedia =>
      attachedDatabase.constructorMedia;
  $CircuitsTable get circuits => attachedDatabase.circuits;
  $CircuitMediaTable get circuitMedia => attachedDatabase.circuitMedia;
  $SeasonsTable get seasons => attachedDatabase.seasons;
  $GrandPrixEventsTable get grandPrixEvents => attachedDatabase.grandPrixEvents;
  $GrandPrixMediaTable get grandPrixMedia => attachedDatabase.grandPrixMedia;
  MediaDaoManager get managers => MediaDaoManager(this);
}

class MediaDaoManager {
  final _$MediaDaoMixin _db;
  MediaDaoManager(this._db);
  $$MediaAssetsTableTableManager get mediaAssets =>
      $$MediaAssetsTableTableManager(_db.attachedDatabase, _db.mediaAssets);
  $$MediaAssetVariantsTableTableManager get mediaAssetVariants =>
      $$MediaAssetVariantsTableTableManager(
        _db.attachedDatabase,
        _db.mediaAssetVariants,
      );
  $$DriversTableTableManager get drivers =>
      $$DriversTableTableManager(_db.attachedDatabase, _db.drivers);
  $$DriverMediaTableTableManager get driverMedia =>
      $$DriverMediaTableTableManager(_db.attachedDatabase, _db.driverMedia);
  $$ConstructorsTableTableManager get constructors =>
      $$ConstructorsTableTableManager(_db.attachedDatabase, _db.constructors);
  $$ConstructorMediaTableTableManager get constructorMedia =>
      $$ConstructorMediaTableTableManager(
        _db.attachedDatabase,
        _db.constructorMedia,
      );
  $$CircuitsTableTableManager get circuits =>
      $$CircuitsTableTableManager(_db.attachedDatabase, _db.circuits);
  $$CircuitMediaTableTableManager get circuitMedia =>
      $$CircuitMediaTableTableManager(_db.attachedDatabase, _db.circuitMedia);
  $$SeasonsTableTableManager get seasons =>
      $$SeasonsTableTableManager(_db.attachedDatabase, _db.seasons);
  $$GrandPrixEventsTableTableManager get grandPrixEvents =>
      $$GrandPrixEventsTableTableManager(
        _db.attachedDatabase,
        _db.grandPrixEvents,
      );
  $$GrandPrixMediaTableTableManager get grandPrixMedia =>
      $$GrandPrixMediaTableTableManager(
        _db.attachedDatabase,
        _db.grandPrixMedia,
      );
}
