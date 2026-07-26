import 'dart:async';

import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/features/sync/application/app_sync_coordinator.dart';
import 'package:gridview/features/sync/data/resource_refresh_dispatcher.dart';

import 'repository_harness.dart';
import 'scripted_api.dart';

/// Builds a real [AppSyncCoordinator] over the in-memory database, the scripted
/// remote API and the full Phase 6B1 repository set.
///
/// Everything is deterministic: the clock is fixed, the concurrency limit is
/// injected, and no network, device or timer is involved.
class SyncHarness {
  SyncHarness(
    this.db,
    this.api, {
    DateTime? now,
    int maxConcurrency = kDefaultSyncConcurrency,
  }) : repositories = RepositoryHarness(db, api, now: now) {
    coordinator = AppSyncCoordinator(
      dispatcher: ResourceRefreshDispatcher(
        bootstrap: repositories.bootstrap,
        season: repositories.season,
        home: repositories.home,
        calendar: repositories.calendar,
        standings: repositories.standings,
        drivers: repositories.drivers,
        constructors: repositories.constructors,
        circuits: repositories.circuits,
        content: repositories.content,
        grandPrix: repositories.grandPrix,
        results: repositories.results,
      ),
      seasons: repositories.season,
      home: repositories.home,
      bootstrap: repositories.bootstrap,
      metadata: db.syncMetadataDao,
      now: repositories.now,
      maxConcurrency: maxConcurrency,
    );
  }

  final GridViewDatabase db;
  final ScriptedGridViewApi api;
  final RepositoryHarness repositories;
  late final AppSyncCoordinator coordinator;

  Future<void> dispose() => coordinator.dispose();
}

/// Tracks how many scripted responders are in flight at once, so a test can
/// assert the coordinator's concurrency bound directly.
class ConcurrencyProbe {
  int _current = 0;
  int peak = 0;

  /// Wraps a responder body, recording overlap while it runs.
  Future<T> track<T>(Future<T> Function() body) async {
    _current++;
    if (_current > peak) peak = _current;
    try {
      // Yield so genuinely concurrent responders overlap observably.
      await Future<void>.delayed(Duration.zero);
      return await body();
    } finally {
      _current--;
    }
  }
}
