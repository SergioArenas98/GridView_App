/* global URL */
// Shared, dependency-free closed wire validation for the CLI and Worker.
export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const hashPattern = /^sha256:[0-9a-f]{64}$/;
export const reasons = [
  'no-canonical-gridview-identity',
  'no-approved-provider-mapping',
  'insufficient-evidence',
  'conflicting-evidence',
  'ambiguous-person',
  'invalid-association',
  'invalid-provider-record',
  'duplicate-candidate',
  'new-evidence',
  'capacity-review-required',
];
export function check(ok, path = 'request') {
  if (!ok) throw Error('INVALID_REQUEST: ' + path);
}
export function object(v, keys, path = 'request') {
  check(
    v !== null &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      Object.keys(v).length === keys.length &&
      keys.every((k) => Object.hasOwn(v, k)),
    path,
  );
}
export function text(v, max = 2000) {
  check(
    typeof v === 'string' &&
      [...v].length > 0 &&
      [...v].length <= max &&
      [...v].every((c) => c.codePointAt(0) >= 32 && c.codePointAt(0) !== 127),
    'text',
  );
}
export const hash = (v) =>
  check(typeof v === 'string' && hashPattern.test(v), 'hash');
export const uuid = (v) =>
  check(typeof v === 'string' && uuidPattern.test(v), 'UUID');
export const integer = (v, min = 0, max = Number.MAX_SAFE_INTEGER) =>
  check(Number.isSafeInteger(v) && v >= min && v <= max, 'integer');
export const slug = (v) =>
  check(
    typeof v === 'string' &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) &&
      v.length <= 64,
    'canonical ID',
  );
function list(v, fn, min = 0, max = 100) {
  check(
    Array.isArray(v) &&
      v.length >= min &&
      v.length <= max &&
      new Set(v.map((x) => JSON.stringify(x))).size === v.length,
    'list',
  );
  v.forEach(fn);
}
function candidate(v) {
  object(
    v,
    ['candidateId', 'expectedCandidateVersion', 'expectedEvidenceHead'],
    'candidate',
  );
  hash(v.candidateId);
  integer(v.expectedCandidateVersion, 1);
  hash(v.expectedEvidenceHead);
}
function support(v) {
  object(v, ['evidenceIds', 'dossierId', 'rationale'], 'support');
  list(v.evidenceIds, hash, 1, 32);
  hash(v.dossierId);
  check(v.evidenceIds.includes(v.dossierId), 'support.dossierId');
  text(v.rationale);
}
function key(v) {
  object(
    v,
    ['season', 'source', 'entity', 'providerField', 'providerValue'],
    'key',
  );
  integer(v.season, 1950, 2100);
  const fields = {
    jolpica: {
      driver: 'driverId',
      constructor: 'constructorId',
      circuit: 'circuitId',
      event: 'eventLocator',
    },
    openf1: {
      driver: 'driver_number',
      constructor: 'team_name',
      circuit: 'circuit_key',
    },
  };
  check(fields[v.source]?.[v.entity] === v.providerField, 'key scope');
  if (v.providerField === 'eventLocator') {
    object(v.providerValue, ['round', 'raceName', 'circuitId']);
    integer(v.providerValue.round, 1);
    text(v.providerValue.raceName, 200);
    text(v.providerValue.circuitId, 200);
  } else if (['driver_number', 'circuit_key'].includes(v.providerField))
    integer(v.providerValue);
  else text(v.providerValue, 200);
}
function duplicate(v) {
  object(
    v,
    [
      'catalogHashReviewed',
      'inspectedCanonicalIds',
      'evidenceIds',
      'fullCatalogChecked',
      'idExplicitlyReviewed',
      'sameNameDistinction',
    ],
    'duplicateReview',
  );
  hash(v.catalogHashReviewed);
  list(v.inspectedCanonicalIds, slug, 0, 10000);
  list(v.evidenceIds, hash, 1, 32);
  check(
    v.fullCatalogChecked === true && v.idExplicitlyReviewed === true,
    'duplicate attestation',
  );
  if (v.sameNameDistinction !== null) text(v.sameNameDistinction);
}
function profile(v) {
  object(
    v,
    [
      'fullName',
      'givenName',
      'familyName',
      'shortCode',
      'permanentNumber',
      'nationality',
      'countryCode',
      'dateOfBirth',
      'placeOfBirth',
      'biography',
    ],
    'profile',
  );
  text(v.fullName, 200);
  for (const f of [
    'givenName',
    'familyName',
    'shortCode',
    'nationality',
    'countryCode',
    'placeOfBirth',
    'biography',
  ])
    if (v[f] !== null)
      text(v[f], f === 'biography' ? 8000 : f === 'shortCode' ? 16 : 200);
  if (v.countryCode !== null)
    check(/^[A-Z]{2}$/.test(v.countryCode), 'countryCode');
  if (v.permanentNumber !== null) integer(v.permanentNumber);
  if (v.dateOfBirth !== null)
    check(
      typeof v.dateOfBirth === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(v.dateOfBirth) &&
        Number.isFinite(Date.parse(v.dateOfBirth)) &&
        new Date(v.dateOfBirth).toISOString().slice(0, 10) === v.dateOfBirth,
      'dateOfBirth',
    );
}
function claims(v) {
  check(Array.isArray(v) && v.length >= 1 && v.length <= 32, 'claims');
  for (const c of v) {
    object(c, ['field', 'value', 'sourceField']);
    check(c.sourceField === null, 'sourceField');
    if (c.field === 'provider-key') key(c.value);
    else if (c.field === 'canonical-association') {
      object(c.value, ['key', 'targetId']);
      key(c.value.key);
      slug(c.value.targetId);
    } else {
      check(
        [
          'fullName',
          'givenName',
          'familyName',
          'dateOfBirth',
          'nationality',
          'shortCode',
          'permanentNumber',
        ].includes(c.field),
        'claim field',
      );
      if (c.field === 'permanentNumber') {
        if (typeof c.value === 'number') integer(c.value);
        else
          check(typeof c.value === 'string' && /^[0-9]{1,16}$/.test(c.value));
      } else text(c.value, c.field === 'shortCode' ? 16 : 200);
    }
  }
}
function references(v) {
  list(
    v,
    (r) => {
      if (r.kind === 'observation') {
        object(r, ['kind', 'observationId']);
        hash(r.observationId);
      } else if (r.kind === 'repository') {
        object(r, ['kind', 'path', 'fileSha256', 'recordPointer']);
        text(r.path, 512);
        hash(r.fileSha256);
        text(r.recordPointer, 512);
        check(
          !r.path.includes('..') &&
            !/[:\\]/.test(r.path) &&
            !r.path.startsWith('/') &&
            r.recordPointer.startsWith('/'),
        );
      } else {
        object(r, ['kind', 'httpsUrl', 'claimSummary']);
        check(r.kind === 'citation');
        text(r.httpsUrl, 1000);
        text(r.claimSummary);
        let u;
        try {
          u = new URL(r.httpsUrl);
        } catch {
          check(false, 'citation');
        }
        check(
          u.protocol === 'https:' &&
            !u.username &&
            !u.password &&
            !u.search &&
            !u.hash &&
            !/[?#]/.test(r.httpsUrl),
          'citation',
        );
      }
    },
    1,
    32,
  );
}
export const mutationNames = [
  'evidence',
  'approve-existing',
  'approve-new',
  'approve-profile',
  'disposition',
  'acknowledge',
  'validate',
  'activate',
  'abandon',
  'seed',
  'import-base',
  'correction',
  'admission',
];
export const operationFamily = (operation) =>
  [
    'approve-existing',
    'approve-new',
    'approve-profile',
    'disposition',
  ].includes(operation)
    ? 'review'
    : operation;
export function validateMutation(v, operation) {
  object(v, [
    'schemaVersion',
    'installationId',
    'operationId',
    'expectedActiveRevisionId',
    'expectedActivationSequence',
    'reason',
    'payload',
  ]);
  check(v.schemaVersion === 1, 'schemaVersion');
  uuid(v.installationId);
  uuid(v.operationId);
  if (v.expectedActiveRevisionId !== null) uuid(v.expectedActiveRevisionId);
  integer(v.expectedActivationSequence);
  text(v.reason);
  const p = v.payload;
  switch (operation) {
    case 'evidence':
      object(p, [
        'candidate',
        'kind',
        'claims',
        'references',
        'duplicateReview',
      ]);
      candidate(p.candidate);
      check(p.kind === 'review-dossier');
      claims(p.claims);
      references(p.references);
      if (p.duplicateReview !== null) duplicate(p.duplicateReview);
      break;
    case 'approve-existing':
      object(p, ['candidate', 'targetDriverId', 'support']);
      candidate(p.candidate);
      slug(p.targetDriverId);
      support(p.support);
      break;
    case 'approve-new':
      object(p, [
        'candidate',
        'driverId',
        'profile',
        'support',
        'duplicateReview',
      ]);
      candidate(p.candidate);
      slug(p.driverId);
      profile(p.profile);
      support(p.support);
      duplicate(p.duplicateReview);
      break;
    case 'approve-profile':
      object(p, ['expectedProfileHash', 'profile', 'support']);
      hash(p.expectedProfileHash);
      profile(p.profile);
      support(p.support);
      break;
    case 'disposition':
      object(p, [
        'expectedCandidateVersion',
        'expectedEvidenceHead',
        'action',
        'reasonCode',
        'evidenceIds',
      ]);
      integer(p.expectedCandidateVersion, 1);
      hash(p.expectedEvidenceHead);
      check(['reject', 'quarantine', 'reopen'].includes(p.action));
      check(reasons.includes(p.reasonCode));
      list(p.evidenceIds, hash, 0, 32);
      break;
    case 'acknowledge':
      object(p, ['notificationGeneration']);
      integer(p.notificationGeneration, 1);
      break;
    case 'validate':
      object(p, ['catalogHash', 'expectedValidatorVersion']);
      hash(p.catalogHash);
      text(p.expectedValidatorVersion, 100);
      break;
    case 'activate':
      object(p, ['catalogHash', 'validationReportHash']);
      hash(p.catalogHash);
      hash(p.validationReportHash);
      break;
    case 'abandon':
      object(p, ['catalogHash']);
      hash(p.catalogHash);
      break;
    case 'seed':
      object(p, [
        'seedArtifact',
        'seedArtifactHash',
        'approvedImportDossierId',
      ]);
      object(p.seedArtifact, ['format', 'seed', 'dossier']);
      check(p.seedArtifact.format === 'gridview-reviewed-seed/1');
      object(p.seedArtifact.dossier, [
        'claims',
        'references',
        'rationale',
        'synthetic',
      ]);
      claims(p.seedArtifact.dossier.claims);
      references(p.seedArtifact.dossier.references);
      text(p.seedArtifact.dossier.rationale);
      check(typeof p.seedArtifact.dossier.synthetic === 'boolean');
      hash(p.seedArtifactHash);
      hash(p.approvedImportDossierId);
      check(
        v.expectedActiveRevisionId === null &&
          v.expectedActivationSequence === 0,
      );
      break;
    case 'import-base':
      object(p, ['baseArtifact', 'baseArtifactHash', 'support']);
      hash(p.baseArtifactHash);
      support(p.support);
      break;
    case 'correction':
      object(p, [
        'candidate',
        'affectedDriverIds',
        'affectedBindingIds',
        'affectedRevisionIds',
        'affectedSeasons',
        'publishedVersions',
        'reasonCode',
        'evidenceIds',
      ]);
      candidate(p.candidate);
      list(p.affectedDriverIds, slug);
      list(p.affectedBindingIds, hash);
      list(p.affectedRevisionIds, uuid);
      list(p.affectedSeasons, (x) => integer(x, 1950, 2100));
      list(p.publishedVersions, (x) => text(x, 200));
      check(reasons.includes(p.reasonCode));
      list(p.evidenceIds, hash, 1, 32);
      break;
    case 'admission':
      object(p, ['expectedAdmissionState', 'state']);
      check(
        ['open', 'paused'].includes(p.expectedAdmissionState) &&
          ['open', 'paused'].includes(p.state),
      );
      break;
    default:
      check(false, 'operation');
  }
  if (
    [
      'approve-existing',
      'approve-new',
      'approve-profile',
      'disposition',
      'correction',
      'import-base',
    ].includes(operation)
  )
    check(v.expectedActiveRevisionId !== null, 'expectedActiveRevisionId');
  return v;
}
