import '../../../../core/api/envelope/meta_dto.dart';

/// Whether [meta] satisfies the snapshot contract.
///
/// `SnapshotMeta` (and `SeasonSnapshotMeta`, used by every snapshot response —
/// bootstrap, home, seasons, calendar, Grand Prix, results, standings, drivers,
/// constructors, circuits and the content manifest) **requires**
/// `sourceUpdatedAt` — the source revision the conflict rule orders by. A
/// snapshot response missing it is contract-invalid: the remote layer maps it to
/// a typed invalid-response failure **before** it can reach the repository, the
/// database or the conflict rule, and it must never fall back to `generatedAt`.
///
/// Only `GET /v1/status` uses `BaseMeta` (no snapshot provenance); it is the one
/// response that does not require this.
bool snapshotMetaIsValid(MetaDto meta) => meta.sourceUpdatedAt != null;
