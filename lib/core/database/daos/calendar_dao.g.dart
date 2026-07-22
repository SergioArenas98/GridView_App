// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'calendar_dao.dart';

// ignore_for_file: type=lint
mixin _$CalendarDaoMixin on DatabaseAccessor<GridViewDatabase> {
  $SeasonsTable get seasons => attachedDatabase.seasons;
  $CircuitsTable get circuits => attachedDatabase.circuits;
  $GrandPrixEventsTable get grandPrixEvents => attachedDatabase.grandPrixEvents;
  $SessionsTable get sessions => attachedDatabase.sessions;
  CalendarDaoManager get managers => CalendarDaoManager(this);
}

class CalendarDaoManager {
  final _$CalendarDaoMixin _db;
  CalendarDaoManager(this._db);
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
}
