// ignore_for_file: only_throw_errors, directives_ordering
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gridview/app/environment/app_environment.dart';
import 'package:gridview/core/api/errors/api_failure.dart';
import 'package:gridview/core/database/daos/competitor_dao.dart'
    show InvalidSeasonEntriesException;
import 'package:gridview/core/database/daos/media_dao.dart'
    show InvalidMediaOwnershipException;
import 'package:gridview/core/database/entity_validation.dart'
    show InvalidEntityException;
import 'package:gridview/core/api/envelope/meta_dto.dart';
import 'package:gridview/core/database/gridview_database.dart';
import 'package:gridview/core/observability/observed_failure.dart';
import 'package:gridview/features/shared/data/remote/remote_cancellation.dart';
import 'package:gridview/features/shared/data/remote/remote_result.dart';
import 'package:gridview/features/shared/data/repositories/synced_repository.dart';
import 'package:gridview/features/shared/data/sync/refresh_coordinator.dart';
import 'package:gridview/features/shared/data/sync/resource_snapshot.dart';
import 'package:gridview/features/shared/data/sync/resource_sync.dart';
import 'package:gridview/features/shared/data/sync/sync_observation.dart';
import 'package:gridview/features/shared/domain/refresh_result.dart';

import '../support/fake_api.dart';
import '../support/fake_observability.dart';

/// Exactly-once reporting, through the **real** pipeline.
///
/// This is the test the previous implementation did not have, and the one that
/// would have caught the duplicate. A typed validation exception travels
/// ResourceSync -> SyncedRepository -> RefreshCoordinator, and both observation
/// hooks are live, exactly as the composition root wires them. The assertion is
/// on the total number of reports, so a second owner anywhere on that path
/// fails here.
class _ProbeRepository extends SyncedRepository {
  _ProbeRepository({
    required super.remote,
    required super.sync,
    required super.coordinator,
    required super.now,
    required this.onWrite,
  });

  /// The domain write. Throwing from here is what a DAO rejection looks like
  /// from the pipeline's point of view.
  final Future<void> Function() onWrite;

  Future<RefreshResult> run(String key) => refreshResource<int>(
    key: key,
    scope: const ResourceScope(season: 2026),
    fetch: ({String? etag, RemoteCancellation? cancellation}) async =>
        const RemoteModified<int>(
          data: 1,
          etag: 'W/"probe"',
          meta: MetaDto(
            apiVersion: '1',
            generatedAt: '2026-07-18T11:00:00Z',
            requestId: 'gv-probe',
            sourceUpdatedAt: '2026-07-18T10:00:00Z',
          ),
        ),
    metaOf: (RemoteModified<int> m) =>
        RemoteSnapshotMeta.fromMeta(m.meta, etag: m.etag),
    writeDomain: (RemoteModified<int> m) => onWrite(),
    hasLocalRepresentation: collectionRepresentation,
  );
}

void main() {
  late GridViewDatabase db;
  late RecordingErrorReporter reporter;

  setUp(() {
    db = GridViewDatabase.forTesting(NativeDatabase.memory());
    reporter = RecordingErrorReporter();
  });

  tearDown(() => db.close());

  /// Wires both hooks exactly as `providers.dart` does.
  _ProbeRepository build(Future<void> Function() onWrite) {
    final ResourceSync sync = ResourceSync(
      db,
      onApplyError: observeSnapshotApplyErrors(
        reporter: reporter,
        environment: AppEnvironment.production,
      ),
    );
    final RefreshCoordinator coordinator = RefreshCoordinator(
      onOutcome: observeRefreshOutcomes(
        reporter: reporter,
        environment: AppEnvironment.production,
      ),
    );
    return _ProbeRepository(
      remote: FakeGridViewApi(),
      sync: sync,
      coordinator: coordinator,
      now: () => DateTime.utc(2026, 7, 18, 12),
      onWrite: onWrite,
    );
  }

  group('typed payload validation is reported exactly once', () {
    final Map<String, Object> exceptions = <String, Object>{
      'InvalidEntityException': const InvalidEntityException('bad row'),
      'InvalidSeasonEntriesException': const InvalidSeasonEntriesException(
        'bad entries',
      ),
      'InvalidMediaOwnershipException': const InvalidMediaOwnershipException(
        'two owners',
      ),
    };

    exceptions.forEach((String name, Object error) {
      test(
        '$name -> one invalidRemoteContract at the refresh boundary',
        () async {
          final _ProbeRepository repository = build(() async => throw error);

          final RefreshResult result = await repository.run(
            'driver:max-verstappen:2026',
          );

          expect(result, isA<RefreshFailure>());
          expect(
            (result as RefreshFailure).failure.kind,
            ApiFailureKind.invalidResponse,
          );

          expect(
            reporter.nonFatals,
            hasLength(1),
            reason: 'one fault must produce one report, not one per boundary',
          );
          final ObservedFailure failure = reporter.nonFatals.single;
          expect(failure.kind, ObservedFailureKind.invalidRemoteContract);
          expect(failure.feature, ObservedFeature.drivers);
          expect(failure.operation, ObservedOperation.resourceRefresh);

          // Nothing about the payload, the entity or the exception travels.
          final String serialized =
              '${failure.toAttributes().values.join('|')}|${failure.signature}';
          expect(serialized, isNot(contains('verstappen')));
          expect(serialized, isNot(contains('2026')));
          expect(serialized, isNot(contains('bad')));
          expect(serialized, isNot(contains('owners')));
        },
      );
    });
  });

  test('a genuine storage fault is reported once, at persistence', () async {
    final _ProbeRepository repository = build(
      () async => throw StateError('disk is on fire'),
    );

    await expectLater(
      repository.run('calendar:2026'),
      throwsStateError,
      reason: 'a storage fault is not a typed refresh failure',
    );

    expect(reporter.nonFatals, hasLength(1));
    final ObservedFailure failure = reporter.nonFatals.single;
    expect(failure.kind, ObservedFailureKind.localDatabaseFailure);
    expect(failure.feature, ObservedFeature.calendar);
    expect(failure.operation, ObservedOperation.snapshotApply);
    expect(failure.toAttributes().values.join('|'), isNot(contains('disk')));
  });

  test('a successful refresh reports nothing at either boundary', () async {
    final _ProbeRepository repository = build(() async {});

    final RefreshResult result = await repository.run('home:2026');

    expect(result, isA<RefreshSuccess>());
    expect(reporter.nonFatals, isEmpty);
  });
}
