import { canonicalJson, utf8 } from '../../ingest/canonical-json';
import type { CatalogPrincipal } from '../../identity/catalog/review';
import { IdentityAdminWorkflow } from '../../identity/catalog/admin-workflow';
import type { IdentityHash } from '../../identity/discovery/model';
import type { Route } from './requests';
import { AdminError, ordinaryLimit } from './responses';
import { mutationNames, operationFamily } from './guards.mjs';
import { administrativeExport } from '../../identity/catalog/admin-export';

export async function readIdentity(
  w: IdentityAdminWorkflow,
  route: Route,
  q: Record<string, string>,
  principal: CatalogPrincipal,
  mode: string,
): Promise<unknown> {
  const id = route.id!;
  switch (route.operation) {
    case 'health': {
      const h = w.head();
      const r = h.activeRevisionId
        ? await w.readRevision(h.activeRevisionId)
        : null;
      return {
        schemaVersion: 1,
        installationId: w.installation,
        mode,
        admissionState: h.admissionState,
        activeRevisionId: h.activeRevisionId,
        activationSequence: h.activationSequence,
        catalogHash: r?.contentHash ?? null,
        capacity: w.discoveryHealth(),
        storageSchemaVersion: 1,
      };
    }
    case 'candidates-detail': {
      const c = w.candidateFor(id as IdentityHash);
      const r = w.head().activeRevisionId;
      return {
        schemaVersion: 1,
        candidate: c,
        evidenceIds: w
          .query(
            'SELECT id FROM identity_evidence WHERE candidate=? ORDER BY id LIMIT 32',
            id,
          )
          .map((r) => r.id),
        dossierIds: w
          .query(
            'SELECT id FROM identity_admin_navigation WHERE kind=? ORDER BY sequence LIMIT 100',
            'dossier:' + id,
          )
          .map((r) => r.id),
        decisions: w.decisionSummaries(id as IdentityHash),
        activeBinding: r
          ? (w
              .query(
                'SELECT body FROM identity_catalog_bindings WHERE revision=? AND exact_key=(SELECT exact_key FROM identity_candidates WHERE id=?)',
                r,
                id,
              )
              .map((r) => JSON.parse(String(r.body)) as unknown)[0] ?? null)
          : null,
      };
    }
    case 'evidence-detail': {
      const dossier = w.query(
        'SELECT body FROM identity_catalog_dossiers WHERE id=?',
        id,
      )[0];
      const evidence =
        dossier ??
        w.query(
          'SELECT body FROM identity_evidence WHERE id=? ORDER BY candidate LIMIT 1',
          id,
        )[0];
      if (!evidence) throw new AdminError(404, 'EVIDENCE_NOT_FOUND');
      return {
        schemaVersion: 1,
        evidence: JSON.parse(String(evidence.body)) as unknown,
      };
    }
    case 'revisions-detail':
      return { schemaVersion: 1, ...(await w.revisionInfo(id)) };
    case 'export': {
      const bundle = JSON.parse(await w.exportRevision(id)) as Record<
        string,
        unknown
      >;
      const imports = w.query(
        "SELECT i.revision,d.body FROM identity_admin_imports i JOIN identity_catalog_dossiers d ON d.id=json_extract(i.body,'$.evidenceId')",
      );
      const wrapper = await administrativeExport(
        w.installation,
        bundle,
        imports.map((r) => ({
          revision: String(r.revision),
          evidence: JSON.parse(String(r.body)) as unknown,
        })),
      );
      const exportHash = wrapper.exportHash;
      // Reader exports are individually audited without storing export contents.
      await w.auditExport(principal, id, exportHash);
      return wrapper;
    }
    case 'operations-detail': {
      if (
        !q.family ||
        (!mutationNames.includes(q.family) && q.family !== 'review')
      )
        throw new AdminError(400, 'INVALID_REQUEST');
      const target = q.principalId ?? principal.principalId;
      if (
        target !== principal.principalId &&
        !principal.roles.includes('activator')
      )
        throw new AdminError(403, 'ROLE_REQUIRED');
      const receipt = w.receiptFor(target, operationFamily(q.family), id);
      return {
        schemaVersion: 1,
        state: receipt
          ? receipt.status >= 400
            ? 'rejected'
            : 'committed'
          : 'unknown',
        requestHash: receipt?.requestHash ?? null,
        result: receipt
          ? {
              status: receipt.status,
              data: receipt.data,
              auditEventSequence: receipt.auditEventSequence,
            }
          : null,
      };
    }
    default:
      return page(w, route, q);
  }
}
interface Cursor {
  v: 1;
  installation: string;
  scope: string;
  filters: string;
  upper: number;
  last: number;
}
function page(
  w: IdentityAdminWorkflow,
  route: Route,
  q: Record<string, string>,
) {
  const filters = canonicalJson(
    Object.fromEntries(
      Object.entries(q)
        .filter(([k]) => !['cursor', 'limit'].includes(k))
        .sort(),
    ),
  );
  const scope = route.operation + ':' + (route.id ?? '');
  let source: string,
    where = '1=1',
    args: (string | number | null)[] = [],
    projection = 't.body';
  const kind = scope;
  switch (route.operation) {
    case 'candidates':
      source = 'identity_candidates';
      for (const key of ['season', 'source', 'state', 'entity'])
        if (q[key]) {
          where +=
            " AND json_extract(t.body,'$." +
            (key === 'season' || key === 'source' || key === 'entity'
              ? 'key.'
              : '') +
            key +
            "')=?";
          args.push(key === 'season' ? Number(q[key]) : q[key]!);
        }
      if (q.unread === 'true')
        where +=
          " AND json_extract(t.body,'$.notificationGeneration')>json_extract(t.body,'$.acknowledgedNotificationGeneration')";
      projection =
        "json_object('candidateId',t.id,'key',json(json_extract(t.body,'$.key')),'state',json_extract(t.body,'$.state'),'recordVersion',json_extract(t.body,'$.recordVersion'),'evidenceHead',json_extract(t.body,'$.evidenceHead'),'firstSeenAt',json_extract(t.body,'$.firstSeenAt'),'lastSeenAt',json_extract(t.body,'$.lastSeenAt'),'latestDecisionId',json_extract(t.body,'$.latestDecisionId'),'notificationGeneration',json_extract(t.body,'$.notificationGeneration'))";
      break;
    case 'revisions':
      source = 'identity_catalog_revisions';
      if (q.status) {
        where +=
          ' AND (SELECT status FROM identity_catalog_statuses s WHERE s.id=t.id)=?';
        args.push(q.status);
      }
      projection =
        "json_object('revisionId',t.id,'parentRevisionId',t.parent,'catalogHash',t.hash,'status',(SELECT status FROM identity_catalog_statuses s WHERE s.id=t.id),'datasetVersions',json(json_extract(t.body,'$.snapshot.seasonContent')),'validation',(SELECT json(body) FROM identity_catalog_certificates c WHERE c.revision=t.id ORDER BY rowid DESC LIMIT 1))";
      break;
    case 'candidate-evidence':
    case 'candidate-observations':
      w.candidateFor(route.id as IdentityHash);
      source =
        route.operation === 'candidate-evidence'
          ? 'identity_evidence'
          : 'identity_observations';
      where = 't.candidate=?';
      args = [route.id!];
      break;
    case 'notifications':
      source = 'identity_notifications';
      projection = 't.body';
      where =
        "json_extract(t.body,'$.acknowledgedAt') IS NULL AND EXISTS (SELECT 1 FROM identity_candidates c WHERE c.id=t.candidate AND t.generation=json_extract(c.body,'$.notificationGeneration'))";
      break;
    case 'history':
      return history(w, q, filters, scope);
    default:
      throw new AdminError(404, 'NOT_FOUND');
  }
  // First sight of an immutable ID obtains a permanent monotonic navigation
  // sequence. Later insertions can never enter an earlier cursor's upper bound.
  const uniqueId =
    source === 'identity_notifications'
      ? "t.candidate||':'||t.generation"
      : 't.id';
  w.indexNavigation(
    'INSERT INTO identity_admin_navigation(kind,id) SELECT ?, ' +
      uniqueId +
      ' FROM ' +
      source +
      ' t WHERE NOT EXISTS (SELECT 1 FROM identity_admin_navigation n WHERE n.kind=? AND n.id=' +
      uniqueId +
      ')',
    kind,
    kind,
  );
  const max = Number(
    w.query(
      'SELECT COALESCE(MAX(sequence),0) n FROM identity_admin_navigation WHERE kind=?',
      kind,
    )[0]!.n,
  );
  const cursor = parseCursor(q.cursor, w.installation, scope, filters, max);
  const rows = w.query(
    'SELECT n.sequence,' +
      projection +
      ' body FROM ' +
      source +
      ' t JOIN identity_admin_navigation n ON n.kind=? AND n.id=' +
      uniqueId +
      ' WHERE ' +
      where +
      ' AND n.sequence>? AND n.sequence<=? ORDER BY n.sequence LIMIT ?',
    kind,
    ...args,
    cursor.last,
    cursor.upper,
    Number(q.limit ?? 50) + 1,
  );
  return makePage(rows, cursor, Number(q.limit ?? 50));
}
function history(
  w: IdentityAdminWorkflow,
  q: Record<string, string>,
  filters: string,
  scope: string,
) {
  const max = Number(
    w.query(
      'SELECT COALESCE(MAX(sequence),0) n FROM identity_catalog_audit',
    )[0]!.n,
  );
  const c = parseCursor(q.cursor, w.installation, scope, filters, max);
  let where = 'sequence>? AND sequence<=?';
  const args: (string | number | null)[] = [
    Math.max(c.last, Number(q.afterSequence ?? 0)),
    c.upper,
  ];
  for (const [field, path] of [
    ['principalId', '$.principalId'],
    ['candidateId', '$.subject.candidateId'],
    ['revisionId', '$.subject.revisionId'],
  ] as const)
    if (q[field]) {
      where += " AND json_extract(body,'" + path + "')=?";
      args.push(q[field]!);
    }
  return makePage(
    w.query(
      "SELECT a.sequence,json_set(a.body,'$.decision',(SELECT json(d.body) FROM identity_catalog_decisions d WHERE json_extract(d.body,'$.operationId')=json_extract(a.body,'$.operationId') AND json_extract(d.body,'$.principalId')=json_extract(a.body,'$.principalId') LIMIT 1)) body FROM identity_catalog_audit a WHERE " +
        where +
        ' ORDER BY sequence LIMIT ?',
      ...args,
      Number(q.limit ?? 50) + 1,
    ),
    c,
    Number(q.limit ?? 50),
  );
}
function parseCursor(
  raw: string | undefined,
  installation: string,
  scope: string,
  filters: string,
  max: number,
): Cursor {
  if (!raw) return { v: 1, installation, scope, filters, upper: max, last: 0 };
  try {
    if (raw.length > 2048 || !/^[A-Za-z0-9+/]+=*$/.test(raw)) throw Error();
    const c = JSON.parse(atob(raw)) as Cursor;
    if (
      Object.keys(c).sort().join() !==
        'filters,installation,last,scope,upper,v' ||
      c.v !== 1 ||
      c.installation !== installation ||
      c.scope !== scope ||
      c.filters !== filters ||
      !Number.isSafeInteger(c.last) ||
      !Number.isSafeInteger(c.upper) ||
      c.last < 0 ||
      c.upper < c.last ||
      c.upper > max
    )
      throw Error();
    return c;
  } catch {
    throw new AdminError(400, 'INVALID_CURSOR');
  }
}
function makePage(
  rows: Record<string, unknown>[],
  cursor: Cursor,
  limit: number,
) {
  const items: unknown[] = [];
  let bytes = 1024,
    last = cursor.last;
  for (const row of rows.slice(0, limit)) {
    const size = utf8(String(row.body)).length;
    if (bytes + size > ordinaryLimit - 2048) break;
    items.push(JSON.parse(String(row.body)));
    bytes += size;
    last = Number(row.sequence);
  }
  if (rows.length && !items.length)
    throw new AdminError(503, 'RESPONSE_TOO_LARGE');
  return {
    schemaVersion: 1,
    items,
    nextCursor:
      rows.length > items.length
        ? btoa(canonicalJson({ ...cursor, last }))
        : null,
    asOfSequence: cursor.upper,
  };
}
