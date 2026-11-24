import {
  hashPattern,
  uuidPattern,
  validateMutation,
  type Mutation,
} from './guards.mjs';
import {
  AdminError,
  artifactLimit,
  boundedBody,
  ordinaryLimit,
} from './responses';
export interface Route {
  operation: string;
  role: 'reader' | 'reviewer' | 'activator';
  id: string | null;
}
export function routeFor(path: string, method: string): Route {
  const root = '/internal/admin/identity/';
  if (!path.startsWith(root)) throw new AdminError(404, 'NOT_FOUND');
  const p = path.slice(root.length).split('/');
  let operation: string | undefined;
  let role: Route['role'] = 'reader';
  let id: string | null = null;
  if (method === 'GET') {
    if (
      p.length === 1 &&
      [
        'health',
        'candidates',
        'revisions',
        'history',
        'notifications',
      ].includes(p[0]!)
    )
      operation = p[0];
    else if (
      p.length === 2 &&
      ['candidates', 'evidence', 'revisions', 'operations'].includes(p[0]!)
    ) {
      operation = p[0] + '-detail';
      id = p[1]!;
    } else if (
      p.length === 3 &&
      p[0] === 'candidates' &&
      ['evidence', 'observations'].includes(p[2]!)
    ) {
      operation = 'candidate-' + p[2];
      id = p[1]!;
    } else if (p.length === 3 && p[0] === 'revisions' && p[2] === 'export') {
      operation = 'export';
      id = p[1]!;
    }
  } else if (method === 'POST') {
    role = 'reviewer';
    if (
      p.length === 1 &&
      ['evidence', 'seed', 'base-imports', 'corrections', 'admission'].includes(
        p[0]!,
      )
    )
      operation =
        (
          {
            'base-imports': 'import-base',
            corrections: 'correction',
          } as Record<string, string>
        )[p[0]!] ?? p[0];
    else if (
      p.length === 2 &&
      p[1] === 'approve' &&
      ['bindings', 'drivers'].includes(p[0]!)
    )
      operation = p[0] === 'bindings' ? 'approve-existing' : 'approve-new';
    else if (p.length === 3 && p[0] === 'drivers' && p[2] === 'profiles') {
      operation = 'approve-profile';
      id = p[1]!;
    } else if (
      p.length === 3 &&
      p[0] === 'candidates' &&
      ['disposition', 'acknowledge'].includes(p[2]!)
    ) {
      operation = p[2];
      id = p[1]!;
    } else if (
      p.length === 3 &&
      p[0] === 'revisions' &&
      ['validate', 'activate', 'abandon'].includes(p[2]!)
    ) {
      operation = p[2];
      id = p[1]!;
    }
    if (
      ['seed', 'import-base', 'validate', 'activate', 'admission'].includes(
        operation ?? '',
      )
    )
      role = 'activator';
    if (operation === 'acknowledge') role = 'reader';
  } else throw new AdminError(405, 'METHOD_NOT_ALLOWED');
  if (!operation) throw new AdminError(404, 'NOT_FOUND');
  if (id !== null) {
    const pattern =
      p[0] === 'candidates' || p[0] === 'evidence'
        ? hashPattern
        : p[0] === 'drivers'
          ? /^[a-z0-9]+(?:-[a-z0-9]+)*$/
          : uuidPattern;
    if (!pattern.test(id) || id.length > 200)
      throw new AdminError(400, 'INVALID_REQUEST');
  }
  return { operation, role, id };
}
export async function mutationFor(
  request: Request,
  route: Route,
): Promise<Mutation> {
  if (
    !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(
      request.headers.get('Content-Type') ?? '',
    )
  )
    throw new AdminError(400, 'INVALID_REQUEST');
  const raw = await boundedBody(
    request,
    ['seed', 'import-base'].includes(route.operation)
      ? artifactLimit
      : ordinaryLimit,
  );
  const body = validateMutation(JSON.parse(raw), route.operation);
  if (request.headers.get('Idempotency-Key') !== body.operationId)
    throw new AdminError(400, 'INVALID_REQUEST');
  return body;
}
export function queries(url: URL, operation: string): Record<string, string> {
  const allowed: Record<string, string[]> = {
    health: [],
    candidates: [
      'season',
      'source',
      'state',
      'entity',
      'cursor',
      'limit',
      'unread',
    ],
    revisions: ['status', 'cursor', 'limit'],
    history: [
      'candidateId',
      'revisionId',
      'principalId',
      'afterSequence',
      'cursor',
      'limit',
    ],
    notifications: ['cursor', 'limit'],
    'candidate-evidence': ['cursor', 'limit'],
    'candidate-observations': ['cursor', 'limit'],
    'operations-detail': ['family', 'principalId'],
  };
  const q: Record<string, string> = {};
  for (const [k, v] of url.searchParams) {
    if (
      !(allowed[operation] ?? []).includes(k) ||
      Object.hasOwn(q, k) ||
      v.length > 2048
    )
      throw new AdminError(400, 'INVALID_REQUEST');
    q[k] = v;
  }
  if (
    q.limit !== undefined &&
    (!/^[1-9]\d*$/.test(q.limit) || Number(q.limit) > 100)
  )
    throw new AdminError(400, 'INVALID_REQUEST');
  if (q.season !== undefined && !/^(19[5-9]\d|20\d\d|2100)$/.test(q.season))
    throw new AdminError(400, 'INVALID_REQUEST');
  const enums: Record<string, string[]> = {
    source: ['jolpica', 'openf1'],
    entity: ['driver', 'constructor', 'circuit', 'event'],
    state: [
      'unresolved',
      'quarantined',
      'rejected',
      'approved-pending',
      'resolved',
      'archived',
    ],
    status: ['proposed', 'validated', 'activated', 'abandoned', 'stale'],
    unread: ['true', 'false'],
  };
  for (const [k, values] of Object.entries(enums))
    if (q[k] !== undefined && !values.includes(q[k]!))
      throw new AdminError(400, 'INVALID_REQUEST');
  if (
    q.afterSequence !== undefined &&
    (!/^\d+$/.test(q.afterSequence) ||
      !Number.isSafeInteger(Number(q.afterSequence)))
  )
    throw new AdminError(400, 'INVALID_REQUEST');
  if (q.candidateId !== undefined && !hashPattern.test(q.candidateId))
    throw new AdminError(400, 'INVALID_REQUEST');
  if (q.revisionId !== undefined && !uuidPattern.test(q.revisionId))
    throw new AdminError(400, 'INVALID_REQUEST');
  if (
    q.principalId !== undefined &&
    !/^[A-Za-z0-9][A-Za-z0-9._:@-]{0,199}$/.test(q.principalId)
  )
    throw new AdminError(400, 'INVALID_REQUEST');
  return q;
}
