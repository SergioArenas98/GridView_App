// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sync_metadata_dao.dart';

// ignore_for_file: type=lint
mixin _$SyncMetadataDaoMixin on DatabaseAccessor<GridViewDatabase> {
  $ResourceSyncMetadataTable get resourceSyncMetadata =>
      attachedDatabase.resourceSyncMetadata;
  SyncMetadataDaoManager get managers => SyncMetadataDaoManager(this);
}

class SyncMetadataDaoManager {
  final _$SyncMetadataDaoMixin _db;
  SyncMetadataDaoManager(this._db);
  $$ResourceSyncMetadataTableTableManager get resourceSyncMetadata =>
      $$ResourceSyncMetadataTableTableManager(
        _db.attachedDatabase,
        _db.resourceSyncMetadata,
      );
}
