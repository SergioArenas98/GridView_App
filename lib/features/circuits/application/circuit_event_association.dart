import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../calendar/application/calendar_state.dart';
import '../../shared/application/entity_detail_scope.dart';
import '../../shared/application/providers.dart';
import '../../shared/domain/entities/entity_profile.dart';
import '../../shared/domain/entities/resource_key.dart';
import '../../shared/domain/entities/sync_state.dart';
import 'circuit_detail_providers.dart';

/// What Circuit Detail may say about the circuit's Grand Prix in the
/// resolved season (CR-04 / PD-14 / CIR-02, Step 55C.11C; C-R1).
enum CircuitEventAssociation {
  /// A. A related event is stored for (season, circuit): show it. It came
  /// from the authoritative calendar or from a snapshot of that very event,
  /// so no calendar completeness is needed.
  linked,

  /// B. No related event, and that exact season's calendar is materialized
  /// (`hasMaterializedCalendar`): "No Grand Prix this season" is supported,
  /// as of the last authoritative snapshot (stale included, CD-2).
  confirmedNone,

  /// C. No related event, and the season's calendar is not materialized:
  /// the association is unknown; the related section is omitted.
  unknown,

  /// The profile, the season or a metadata read is not available yet:
  /// assert nothing (the related section is omitted, never the absence).
  resolving,
}

/// The pure CR-04 decision.
///
/// Completeness is exactly [hasMaterializedCalendar] — the rule the
/// Calendar and Home already use — for [season], the screen's **resolved**
/// season: the season's own `calendar:<season>` record has synchronised
/// successfully at least once, or an accepted bootstrap whose own season
/// scope is [season] applied it. It is never inferred from the number of
/// stored events, an empty list, the circuit's own refresh, a single Home or
/// Grand Prix snapshot, or another season's calendar.
///
/// Staleness never removes completeness (CD-2): a materialized calendar
/// stays materialized after a failed refresh or once it is stale.
CircuitEventAssociation circuitEventAssociation({
  required int? season,
  required bool profileReady,
  required bool hasRelatedEvent,
  required bool calendarMetadataReady,
  required ResourceSyncState? calendarMetadata,
  required bool bootstrapMetadataReady,
  required ResourceSyncState? bootstrapMetadata,
}) {
  if (!profileReady) return CircuitEventAssociation.resolving;
  if (hasRelatedEvent) return CircuitEventAssociation.linked;
  if (season == null || !calendarMetadataReady || !bootstrapMetadataReady) {
    return CircuitEventAssociation.resolving;
  }
  return hasMaterializedCalendar(
        season: season,
        metadata: calendarMetadata,
        bootstrapMetadata: bootstrapMetadata,
      )
      ? CircuitEventAssociation.confirmedNone
      : CircuitEventAssociation.unknown;
}

/// The reactive CR-04 association for one Circuit Detail scope.
///
/// Combines the watched circuit profile (its related event for the resolved
/// season, unchanged selection: the earliest round), that season's
/// `calendar:<season>` metadata and the bootstrap record. Every input is a
/// Drift stream, so a calendar sync that adds or removes the event, or that
/// materializes the calendar, changes the answer while the screen is open.
///
/// It only reads persisted state: opening Circuit Detail never requests the
/// calendar, and the circuit-scoped refresh is unchanged.
final circuitEventAssociationProvider = Provider.autoDispose
    .family<CircuitEventAssociation, EntityDetailScope>((
      Ref ref,
      EntityDetailScope scope,
    ) {
      final int? season = ref.watch(entityDetailSeasonProvider(scope)).value;
      final AsyncValue<CircuitProfile?> profile = ref.watch(
        circuitProfileProvider(scope),
      );
      final AsyncValue<ResourceSyncState?>? calendar = season == null
          ? null
          : ref.watch(resourceSyncStateProvider(ResourceKey.calendar(season)));
      final AsyncValue<ResourceSyncState?> bootstrap = ref.watch(
        resourceSyncStateProvider(ResourceKey.bootstrap()),
      );
      return circuitEventAssociation(
        season: season,
        profileReady: profile.hasValue && profile.value != null,
        hasRelatedEvent: profile.value?.relatedGrandPrix != null,
        calendarMetadataReady: calendar?.hasValue ?? false,
        calendarMetadata: calendar?.value,
        bootstrapMetadataReady: bootstrap.hasValue,
        bootstrapMetadata: bootstrap.value,
      );
    });
