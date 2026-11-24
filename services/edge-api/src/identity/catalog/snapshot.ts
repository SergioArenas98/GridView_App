import { canonicalJson, utf8 } from '../../ingest/canonical-json';
import { compareUtf8 } from '../../publication/canonical/ordering';
import {
  canonicalKey,
  decodeProviderMappingKey,
} from '../../providers/mappings/mapping-key';
import {
  curatedParticipantsFrom,
  type CuratedDriverRow,
  type CuratedConstructorRow,
} from '../../providers/jolpica/curated-participants';
import {
  curatedCircuitsFrom,
  type CuratedCircuitRow,
} from '../../providers/jolpica/curated-circuits';
import {
  validateDriver,
  validateConstructor,
  validateCircuit,
} from '../../contract/normalized';
import { hashIdentityProjection } from '../discovery/keys';
import {
  requireCatalog,
  catalogLimits,
  type CatalogSnapshot,
  type RepositorySource,
  type Document,
  type RepositoryReference,
  type ImportDecision,
  type CatalogEvidence,
} from './model';
import { corpusProfileFor, records } from './sources';
import { hashSeasonProjection } from './projection';

export const novemberKeys = [
  'rafael_camara',
  'gabriele_mini',
  'freddie_slater',
  'nikola_tsolov',
] as const;
export async function deriveSnapshot(
  sources: RepositorySource[],
  documents: Map<string, Document>,
): Promise<CatalogSnapshot> {
  // R0 keeps all four November keys pending; P0 maps the reviewed one.
  const pendingKeys = corpusProfileFor(documents).pendingKeys;
  const get = (kind: string) => documents.get(kind)!;
  const reference = (kind: string, pointer: string): RepositoryReference => {
    const source = sources.find((s) => JSON.parse(s.text).kind === kind)!;
    return { path: source.path, fileHash: source.fileHash, pointer };
  };
  const decisions: ImportDecision[] = [];
  const decision = async (kind: string, pointer: string) => {
    const ref = reference(kind, pointer);
    const value = {
      kind: 'historical-repository-import' as const,
      reference: ref,
      historicalReviewer: null,
      historicalApprovedAt: null,
    };
    const d = {
      ...value,
      decisionId: await hashIdentityProjection(value),
      evidenceId: await hashIdentityProjection({
        kind: 'repository-record',
        reference: ref,
      }),
    };
    decisions.push(d);
    return d;
  };
  const key = (row: Document) => {
    const k = decodeProviderMappingKey({
      season: 2026,
      source: row.source,
      entity: row.entity,
      providerField: row.providerField,
      providerValue: row.providerValue,
    });
    requireCatalog(k.ok, 'provider-key');
    return k.key;
  };
  const mappingRows = records(get('provider-mappings').mappings);
  const mapped = new Set(mappingRows.map((r) => canonicalKey(key(r))));
  const evidence: CatalogEvidence[] = [];
  for (const [i, row] of records(
    get('provider-evidence').identities,
  ).entries()) {
    const k = key(row),
      text = row.evidence as string;
    requireCatalog(
      [...text].length <= 2000 && !/\bsynthetic\b/i.test(text),
      'historical-evidence',
    );
    const pending =
      k.source === 'jolpica' && pendingKeys.includes(k.providerValue as string);
    requireCatalog(
      !pending ||
        (!mapped.has(canonicalKey(k)) && text.includes('operator-reported')),
      'pending-identity',
    );
    const value = {
      key: k,
      reference: reference('provider-evidence', '/identities/' + i),
      originalProvenance: text,
      status: pending
        ? ('pending-operator-report' as const)
        : mapped.has(canonicalKey(k))
          ? ('historical-mapped' as const)
          : ('historical-unresolved' as const),
      origin: 'repository-import' as const,
    };
    evidence.push({
      ...value,
      evidenceId: await hashIdentityProjection(value),
    });
  }
  evidence.sort((a, b) =>
    compareUtf8(canonicalKey(a.key), canonicalKey(b.key)),
  );
  const bindings: CatalogSnapshot['bindings'] = [];
  for (const [i, row] of mappingRows.entries()) {
    const k = key(row),
      e = evidence.find((e) => canonicalKey(e.key) === canonicalKey(k));
    requireCatalog(e?.status === 'historical-mapped', 'binding-evidence');
    const d = await decision('provider-mappings', '/mappings/' + i);
    const value = {
      key: k,
      targetEntity: k.entity,
      targetId: row.gridviewId as string,
      decisionId: d.decisionId,
      evidenceIds: [e.evidenceId],
      createdAt: null,
    };
    bindings.push({ ...value, bindingId: await hashIdentityProjection(value) });
  }
  bindings.sort((a, b) =>
    compareUtf8(canonicalKey(a.key), canonicalKey(b.key)),
  );
  const driverRows = records(
    get('driver-registry').drivers,
  ) as unknown as CuratedDriverRow[];
  const constructorRows = records(
    get('constructor-registry').constructors,
  ) as unknown as CuratedConstructorRow[];
  const participants = curatedParticipantsFrom(driverRows, constructorRows);
  const drivers: CatalogSnapshot['drivers'] = [];
  for (const [i, row] of driverRows.entries()) {
    const profile = participants.driverById(row.id)!;
    requireCatalog(
      validateDriver({ ...profile, media: null }, 'driver').length === 0,
      'driver-contract',
    );
    for (const [field, v] of Object.entries(profile))
      if (typeof v === 'string')
        requireCatalog(
          [...v].length <=
            (field === 'biography' ? 8000 : field === 'shortCode' ? 16 : 200),
          'profile-bound',
        );
    requireCatalog(
      profile.permanentNumber === null ||
        Number.isSafeInteger(profile.permanentNumber),
      'profile-number',
    );
    const d = await decision('driver-registry', '/drivers/' + i);
    drivers.push({
      anchor: {
        driverId: row.id,
        origin: 'repository-import',
        createdDecisionId: d.decisionId,
        createdAt: null,
      },
      profileVersion: 1,
      profile,
      profileHash: await hashIdentityProjection(profile),
      decisionId: d.decisionId,
      evidenceIds: [d.evidenceId],
    });
  }
  drivers.sort((a, b) => compareUtf8(a.anchor.driverId, b.anchor.driverId));
  const constructors = constructorRows
    .map((r) => participants.constructorById(r.id)!)
    .sort((a, b) => compareUtf8(a.id, b.id));
  for (const c of constructors)
    requireCatalog(
      validateConstructor({ ...c, media: null }, 'constructor').length === 0,
      'constructor-contract',
    );
  const circuitRows = records(
    get('circuit-registry').circuits,
  ) as unknown as CuratedCircuitRow[];
  const circuitLookup = curatedCircuitsFrom(circuitRows);
  const circuits = circuitRows
    .map((r) => circuitLookup.get(r.id)!)
    .sort((a, b) => compareUtf8(a.id, b.id));
  for (const c of circuits)
    requireCatalog(
      validateCircuit({ ...c, media: null }, 'circuit').length === 0,
      'circuit-contract',
    );
  const events = records(get('event-registry').events)
    .map((r) => ({ id: r.id as string, name: r.name as string }))
    .sort((a, b) => compareUtf8(a.id, b.id));
  const unresolved = records(get('provider-evidence').acknowledgedUnmapped)
    .map((r, i) => {
      const k = key(r),
        e = evidence.find((e) => canonicalKey(e.key) === canonicalKey(k));
      requireCatalog(e && !mapped.has(canonicalKey(k)), 'unresolved');
      return {
        key: k,
        reason: r.reason as string,
        detail: r.detail as string,
        evidenceId: e.evidenceId,
        reference: reference('provider-evidence', '/acknowledgedUnmapped/' + i),
      };
    })
    .sort((a, b) => compareUtf8(canonicalKey(a.key), canonicalKey(b.key)));
  requireCatalog(
    pendingKeys.every((v) =>
      unresolved.some(
        (u) => u.key.source === 'jolpica' && u.key.providerValue === v,
      ),
    ),
    'november-unresolved',
  );
  const sourceDocuments = sources.map((s) => ({
    path: s.path,
    document: get(JSON.parse(s.text).kind),
  }));
  const baseContentDigest = await hashIdentityProjection(sourceDocuments);
  const meta = get('season-metadata');
  const seasonProjectionHash = await hashSeasonProjection(
    {
      drivers,
      constructors,
      circuits,
      events,
      bindings,
      sourceDocuments,
    },
    2026,
  );
  const snapshot: CatalogSnapshot = {
    format: 'gridview-identity-catalog/1',
    drivers,
    constructors,
    circuits,
    events,
    bindings,
    evidence,
    importDecisions: decisions.sort((a, b) =>
      compareUtf8(a.decisionId, b.decisionId),
    ),
    unresolved,
    seasonContent: [
      {
        season: 2026,
        datasetVersion: meta.datasetVersion as string,
        seasonLabel: meta.seasonLabel as string,
        seasonProjectionHash,
        baseContentDigest,
      },
    ],
    sourceDocuments,
  };
  requireCatalog(
    drivers.length <= catalogLimits.drivers &&
      bindings.length <= catalogLimits.bindings &&
      utf8(canonicalJson(snapshot)).length <= catalogLimits.snapshotBytes,
    'snapshot-capacity',
  );
  return snapshot;
}
