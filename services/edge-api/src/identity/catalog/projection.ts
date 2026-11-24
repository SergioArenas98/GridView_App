import { compareUtf8 } from '../../publication/canonical/ordering';
import { canonicalKey } from '../../providers/mappings/mapping-key';
import { hashIdentityProjection } from '../discovery/keys';
import {
  type CatalogSnapshot,
  type CatalogBinding,
  type DriverMember,
  type Document,
  requireCatalog,
} from './model';
import { records } from './sources';

/** Effective content of one season from an already validated complete snapshot.
 * Source bytes, evidence, decisions and version labels remain covered by full
 * catalog/export integrity; they are not inputs to public dataset allocation. */
export function seasonProjection(
  snapshot: Omit<
    Pick<
      CatalogSnapshot,
      | 'drivers'
      | 'constructors'
      | 'circuits'
      | 'events'
      | 'bindings'
      | 'sourceDocuments'
    >,
    'drivers' | 'bindings'
  > & {
    drivers: Pick<DriverMember, 'profile'>[];
    bindings: Pick<CatalogBinding, 'key' | 'targetId'>[];
  },
  season: number,
) {
  const documents = snapshot.sourceDocuments.map((s) => s.document);
  const scoped = (kind: string) =>
    documents.filter((d) => d.kind === kind && d.season === season);
  const metadata = scoped('season-metadata');
  requireCatalog(metadata.length === 1, 'projection-season-metadata');
  const entries = (kind: string) =>
    scoped(kind).flatMap((d) =>
      records(d.entries).filter((row) => row.season === season),
    );
  const driverEntries = entries('driver-season-entries');
  const constructorEntries = entries('constructor-season-entries');
  const overrides = documents
    .filter(
      (d) =>
        d.kind === 'overrides' &&
        (d.season === season || d.season === null || d.season === undefined),
    )
    .map((d) => ({
      drivers: records(d.drivers ?? []),
      constructors: records(d.constructors ?? []),
      circuits: records(d.circuits ?? []),
    }));
  const bindings = snapshot.bindings
    .filter((b) => b.key.season === season)
    .map((b) => ({ key: b.key, targetId: b.targetId }))
    .sort((a, b) => compareUtf8(canonicalKey(a.key), canonicalKey(b.key)));
  const ids = (entity: string) =>
    new Set(
      bindings.filter((b) => b.key.entity === entity).map((b) => b.targetId),
    );
  const driverIds = ids('driver'),
    constructorIds = ids('constructor'),
    circuitIds = ids('circuit'),
    eventIds = ids('event');
  const reference = (set: Set<string>, row: Document, field: string) => {
    if (typeof row[field] === 'string') set.add(row[field]);
  };
  for (const row of driverEntries) {
    reference(driverIds, row, 'driverId');
    reference(constructorIds, row, 'constructorId');
  }
  for (const row of constructorEntries) {
    reference(constructorIds, row, 'constructorId');
    if (Array.isArray(row.driverLineup))
      for (const id of row.driverLineup)
        if (typeof id === 'string') driverIds.add(id);
  }
  for (const o of overrides) {
    o.drivers.forEach((row) => reference(driverIds, row, 'id'));
    o.constructors.forEach((row) => reference(constructorIds, row, 'id'));
    o.circuits.forEach((row) => reference(circuitIds, row, 'id'));
  }
  const byId = <T extends { id: string }>(values: T[], selected: Set<string>) =>
    values
      .filter((v) => selected.has(v.id))
      .sort((a, b) => compareUtf8(a.id, b.id));
  return {
    season,
    drivers: byId(
      snapshot.drivers.map((d) => d.profile),
      driverIds,
    ),
    constructors: byId(snapshot.constructors, constructorIds),
    circuits: byId(snapshot.circuits, circuitIds),
    events: byId(snapshot.events, eventIds),
    bindings,
    baseContent: {
      seasonLabel: metadata[0]!.seasonLabel,
      driverEntries,
      constructorEntries,
      overrides,
    },
  };
}

export const hashSeasonProjection = (
  snapshot: Parameters<typeof seasonProjection>[0],
  season: number,
) => hashIdentityProjection(seasonProjection(snapshot, season));
