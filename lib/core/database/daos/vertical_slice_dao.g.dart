// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'vertical_slice_dao.dart';

// ignore_for_file: type=lint
mixin _$VerticalSliceDaoMixin on DatabaseAccessor<GridViewDatabase> {
  $SeasonsTable get seasons => attachedDatabase.seasons;
  $CircuitsTable get circuits => attachedDatabase.circuits;
  $GrandPrixEventsTable get grandPrixEvents => attachedDatabase.grandPrixEvents;
  $SessionsTable get sessions => attachedDatabase.sessions;
  $SnapshotsTable get snapshots => attachedDatabase.snapshots;
  VerticalSliceDaoManager get managers => VerticalSliceDaoManager(this);
}

class VerticalSliceDaoManager {
  final _$VerticalSliceDaoMixin _db;
  VerticalSliceDaoManager(this._db);
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
  $$SnapshotsTableTableManager get snapshots =>
      $$SnapshotsTableTableManager(_db.attachedDatabase, _db.snapshots);
}
