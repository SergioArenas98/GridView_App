import { validateLocalProposal } from './validator.mjs';
import { open, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import {
  validateMutation,
  operationFamily,
  check,
  uuidPattern,
  hashPattern,
  slug,
} from '../../src/admin/identity/guards.mjs';
import {
  identityClient,
  localConfiguration,
  OperatorError,
  secretFilter,
} from './client.mjs';

export const help = `GridView individual identity administration (U5)
Reads: status | candidates list | candidate inspect <hash> | evidence list <hash>
       evidence inspect <hash> | observations list <hash> | revisions list
       revision inspect <uuid> | history | notifications list
       operation inspect <uuid> --family <operation> [--principal <id>]
       export --revision <uuid> --out <new-file.json>
JSON-file mutations:
       evidence add | approve-existing | approve-new | approve-profile --driver <id>
       candidate disposition <hash> | candidate acknowledge <hash>
       validate <revision-uuid> | activate <revision-uuid> | abandon <revision-uuid>
       seed | import-base | correction report | admission
Every mutation uses --file <review.json>. Use --check to validate locally only.
Use --preview to inspect the exact proposal without submitting.
Writes require an interactive confirmation. --confirm-reviewed-operation deliberately
confirms the exact reviewed file for noninteractive use; no automatic retry.
Read filters: --season --source --state --entity --status --unread --limit --cursor
History: --candidate-id --revision-id --principal --after-sequence
Authentication: transient GRIDVIEW_IDENTITY_TOKEN environment only; no token arguments.
Configuration: GRIDVIEW_IDENTITY_URL and GRIDVIEW_IDENTITY_INSTALLATION_ID.
Approval creates a proposal. Activation is separate and updates only the catalog.
No provider requests, evidence URL retrieval, sync or publication commands exist.`;

export function parseArguments(argv) {
  const position = [],
    options = {};
  const booleans = [
    'check',
    'preview',
    'confirm-reviewed-operation',
    'retry-same-operation',
    'help',
  ];
  const values = [
    'file',
    'driver',
    'revision',
    'out',
    'family',
    'principal',
    'season',
    'source',
    'state',
    'entity',
    'status',
    'unread',
    'limit',
    'cursor',
    'candidate-id',
    'revision-id',
    'after-sequence',
  ];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const name = a.slice(2);
      if (
        Object.hasOwn(options, name) ||
        (!booleans.includes(name) && !values.includes(name))
      )
        throw new OperatorError(
          'Unknown or repeated option. Run npm run identity -- --help. Never pass credentials as arguments.',
        );
      if (booleans.includes(name)) options[name] = true;
      else {
        const value = argv[++i];
        if (value === undefined || value.startsWith('--'))
          throw new OperatorError(
            'An option is missing its value. Quote file paths containing spaces in PowerShell.',
          );
        options[name] = value;
      }
    } else position.push(a);
  }
  return { position, options };
}
export function commandFor(position, options) {
  const [a, b, c] = position;
  let operation,
    path,
    write = false;
  const hashId = (id) => {
    check(
      typeof id === 'string' && hashPattern.test(id),
      'candidate/evidence hash',
    );
    return id;
  };
  const revision = (id) => {
    check(typeof id === 'string' && uuidPattern.test(id), 'revision UUID');
    return id;
  };
  const exact = (n) => check(position.length === n, 'command arguments');
  if (a === 'status') {
    exact(1);
    operation = 'health';
    path = '/health';
  } else if (
    ['candidates', 'revisions', 'notifications'].includes(a) &&
    b === 'list'
  ) {
    exact(2);
    operation = a;
    path = '/' + a;
  } else if (a === 'history') {
    exact(1);
    operation = a;
    path = '/history';
  } else if (a === 'candidate' && b === 'inspect') {
    exact(3);
    operation = 'candidate';
    path = '/candidates/' + hashId(c);
  } else if (a === 'revision' && b === 'inspect') {
    exact(3);
    operation = 'revision';
    path = '/revisions/' + revision(c);
  } else if (a === 'evidence' && b === 'inspect') {
    exact(3);
    operation = 'evidence-detail';
    path = '/evidence/' + hashId(c);
  } else if (['evidence', 'observations'].includes(a) && b === 'list') {
    exact(3);
    operation = a;
    path = '/candidates/' + hashId(c) + '/' + a;
  } else if (a === 'operation' && b === 'inspect') {
    exact(3);
    operation = 'operation';
    path = '/operations/' + revision(c);
    check(typeof options.family === 'string', 'operation family');
  } else if (a === 'export') {
    exact(1);
    operation = 'export';
    path = '/revisions/' + revision(options.revision) + '/export';
    check(typeof options.out === 'string', 'export output');
  } else {
    write = true;
    if (a === 'evidence' && b === 'add') {
      exact(2);
      operation = 'evidence';
      path = '/evidence';
    } else if (a === 'approve-existing') {
      exact(1);
      operation = a;
      path = '/bindings/approve';
    } else if (a === 'approve-new') {
      exact(1);
      operation = a;
      path = '/drivers/approve';
    } else if (a === 'approve-profile') {
      exact(1);
      slug(options.driver);
      operation = a;
      path = '/drivers/' + options.driver + '/profiles';
    } else if (
      a === 'candidate' &&
      ['disposition', 'acknowledge'].includes(b)
    ) {
      exact(3);
      operation = b;
      path = '/candidates/' + hashId(c) + '/' + b;
    } else if (['validate', 'activate', 'abandon'].includes(a)) {
      exact(2);
      operation = a;
      path = '/revisions/' + revision(b) + '/' + a;
    } else if (['seed', 'import-base', 'admission'].includes(a)) {
      exact(1);
      operation = a;
      path = '/' + (a === 'import-base' ? 'base-imports' : a);
    } else if (a === 'correction' && b === 'report') {
      exact(2);
      operation = 'correction';
      path = '/corrections';
    } else
      throw new OperatorError(
        'Unknown command. Run npm run identity -- --help.',
      );
    check(typeof options.file === 'string', '--file');
  }
  const allowed = write
    ? [
        'file',
        'check',
        'preview',
        'confirm-reviewed-operation',
        'retry-same-operation',
        ...(operation === 'approve-profile' ? ['driver'] : []),
      ]
    : operation === 'export'
      ? ['revision', 'out']
      : operation === 'operation'
        ? ['family', 'principal']
        : operation === 'history'
          ? [
              'candidate-id',
              'revision-id',
              'principal',
              'after-sequence',
              'limit',
              'cursor',
            ]
          : [
                'candidates',
                'revisions',
                'notifications',
                'evidence',
                'observations',
              ].includes(operation)
            ? [
                'limit',
                'cursor',
                ...(operation === 'candidates'
                  ? ['season', 'source', 'state', 'entity', 'unread']
                  : operation === 'revisions'
                    ? ['status']
                    : []),
              ]
            : [];
  check(
    Object.keys(options).every((k) => allowed.includes(k)),
    'option not supported by this command',
  );
  return { operation, path, write };
}
export async function readProposal(path, operation) {
  const cap = ['seed', 'import-base'].includes(operation)
    ? 2 * 1024 * 1024
    : 256 * 1024;
  let file;
  try {
    file = await open(path, 'r');
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > cap) throw Error();
    const bytes = Buffer.alloc(cap + 1);
    let length = 0;
    while (length < bytes.length) {
      const { bytesRead } = await file.read(
        bytes,
        length,
        bytes.length - length,
        null,
      );
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > cap) throw Error();
    const text = new TextDecoder('utf-8', { fatal: true })
      .decode(bytes.subarray(0, length))
      .replace(/^\uFEFF/u, '');
    const request = validateMutation(JSON.parse(text), operation);
    await validateLocalProposal(request, operation);
    return {
      request,
      fileHash: createHash('sha256')
        .update(bytes.subarray(0, length))
        .digest('hex'),
    };
  } catch {
    throw new OperatorError(
      'Review file is unreadable, oversized, malformed JSON or fails the closed ' +
        operation +
        ' contract. Use the synthetic examples as templates; no request was sent.',
    );
  } finally {
    await file?.close();
  }
}
function queryFor(options) {
  const names = {
    'candidate-id': 'candidateId',
    'revision-id': 'revisionId',
    'after-sequence': 'afterSequence',
    principal: 'principalId',
  };
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(options))
    if (!['out', 'revision'].includes(key)) query.set(names[key] ?? key, value);
  return query.size ? '?' + query : '';
}
export async function run(argv, env = process.env, dependencies = {}) {
  const { position, options } = parseArguments(argv);
  const filter = secretFilter(env.GRIDVIEW_IDENTITY_TOKEN),
    output =
      dependencies.output ?? ((text) => process.stdout.write(text + '\n'));
  const print = (value) =>
    output(
      filter(
        typeof value === 'string' ? value : JSON.stringify(value, null, 2),
      ),
    );
  if (options.help || !position.length) {
    print(help);
    return;
  }
  const command = commandFor(position, options);
  const proposal = command.write
    ? await readProposal(options.file, command.operation)
    : null;
  if (proposal) {
    // Detect accidental credential pastes even inside otherwise valid rationale.
    const json = JSON.stringify(proposal.request),
      token = env.GRIDVIEW_IDENTITY_TOKEN;
    if (
      token &&
      (json.includes(token) ||
        json.includes(createHash('sha256').update(token).digest('hex')))
    )
      throw new OperatorError(
        'Review file contains credential material. Remove it before reviewing; nothing was sent.',
      );
    print('Exact reviewed file SHA-256: ' + proposal.fileHash);
    print({ path: command.path, request: proposal.request });
    if (options.check) {
      print('File contract valid. No HTTP request was made.');
      return;
    }
  }
  const config = localConfiguration(env),
    call = identityClient(config, dependencies.transport);
  if (proposal) {
    if (proposal.request.installationId !== config.installation)
      throw new OperatorError(
        'Review file installation differs from the configured installation.',
      );
    if (options['retry-same-operation']) {
      const receipt = await call(
        '/operations/' +
          proposal.request.operationId +
          '?family=' +
          command.operation,
      );
      if (receipt.data.state !== 'unknown') {
        print(receipt);
        print('Durable receipt found. No mutation was resubmitted.');
        return;
      }
      print(
        'Receipt is unknown. This does not prove the earlier request cannot still complete. Only this identical operation may be submitted again.',
      );
    }
    const status = (await call('/health')).data;
    if (status.installationId !== config.installation)
      throw new OperatorError('Server installation mismatch.');
    print({ currentCatalog: status });
    if (
      !options['retry-same-operation'] &&
      command.operation !== 'seed' &&
      (status.activeRevisionId !== proposal.request.expectedActiveRevisionId ||
        status.activationSequence !==
          proposal.request.expectedActivationSequence)
    )
      throw new OperatorError(
        'Catalog head changed. Inspect the head and prepare a newly reviewed file.',
      );
    const ref = proposal.request.payload.candidate;
    if (ref)
      print({ candidate: (await call('/candidates/' + ref.candidateId)).data });
    if (['validate', 'activate', 'abandon'].includes(command.operation)) {
      const revision = (await call('/revisions/' + position[1])).data;
      print({
        exactProposedCatalogDelta: revision.deltaFromParent,
        validation: revision.validation,
      });
      if (command.operation === 'activate')
        print(
          'Activation changes the catalog and affected season dataset versions shown above. Published race results remain unchanged.',
        );
    } else if (
      ['approve-existing', 'approve-new', 'approve-profile'].includes(
        command.operation,
      )
    ) {
      const parent = (await call('/revisions/' + status.activeRevisionId)).data
        .revision;
      const payload = proposal.request.payload;
      const target =
        payload.targetDriverId ?? payload.driverId ?? options.driver;
      print({
        exactProposedChange: {
          operation: command.operation,
          providerKey: ref
            ? (await call('/candidates/' + ref.candidateId)).data.candidate.key
            : null,
          targetDriverId: target,
          previousProfile:
            parent.snapshot.drivers.find((d) => d.anchor.driverId === target)
              ?.profile ?? null,
          proposedProfile: payload.profile ?? null,
        },
        evidence: payload.support,
      });
    } else if (command.operation === 'import-base') {
      const current = (await call('/revisions/' + status.activeRevisionId)).data
        .revision.snapshot;
      const incoming = proposal.request.payload.baseArtifact.snapshot;
      const ordered = (v) =>
        Array.isArray(v)
          ? v.map(ordered)
          : v && typeof v === 'object'
            ? Object.fromEntries(
                Object.entries(v)
                  .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
                  .map(([k, value]) => [k, ordered(value)]),
              )
            : v;
      const same = (a, b) =>
        JSON.stringify(ordered(a)) === JSON.stringify(ordered(b));
      const newBindings = incoming.bindings.filter(
        (b) => !current.bindings.some((old) => same(old.key, b.key)),
      );
      if (
        incoming.drivers.some(
          (d) =>
            !current.drivers.some(
              (old) => old.anchor.driverId === d.anchor.driverId,
            ),
        ) ||
        newBindings.some((b) => b.key.entity === 'driver') ||
        incoming.bindings.some((b) =>
          current.bindings.some(
            (old) => same(old.key, b.key) && old.targetId !== b.targetId,
          ),
        )
      )
        throw new OperatorError(
          'Base import attempts a driver creation, driver binding or binding retarget. Use the explicit identity review workflow.',
        );
      print({
        exactProposedBaseChanges: {
          baseArtifactHash: proposal.request.payload.baseArtifactHash,
          newBindings,
          constructors: incoming.constructors.filter(
            (v) =>
              !same(
                v,
                current.constructors.find((old) => old.id === v.id),
              ),
          ),
          circuits: incoming.circuits.filter(
            (v) =>
              !same(
                v,
                current.circuits.find((old) => old.id === v.id),
              ),
          ),
          events: incoming.events.filter(
            (v) =>
              !same(
                v,
                current.events.find((old) => old.id === v.id),
              ),
          ),
          sourceDocuments: incoming.sourceDocuments.filter(
            (v) =>
              !same(
                v,
                current.sourceDocuments.find((old) => old.path === v.path),
              ),
          ),
          retainedDriverIds: current.drivers.map((d) => d.anchor.driverId),
        },
      });
    }
    if (options.preview) {
      print('Preview complete. No mutation was submitted.');
      return;
    }
    if (!options['confirm-reviewed-operation']) {
      const expected =
        'CONFIRM ' + command.operation + ' ' + proposal.request.operationId;
      const confirm =
        dependencies.confirm ??
        (async (prompt) => {
          if (!process.stdin.isTTY)
            throw new OperatorError(
              'Interactive confirmation requires a terminal. After reviewing --preview, use --confirm-reviewed-operation deliberately for noninteractive submission.',
            );
          const rl = createInterface({
            input: process.stdin,
            output: process.stdout,
          });
          try {
            return await rl.question(prompt);
          } finally {
            rl.close();
          }
        });
      if (
        (await confirm('Type ' + expected + ' to submit this exact file: ')) !==
        expected
      )
        throw new OperatorError(
          'Confirmation did not match. No mutation was sent.',
        );
    }
    const result = await call(command.path, proposal.request);
    print(result);
    print(
      'Receipt: npm run identity -- operation inspect ' +
        proposal.request.operationId +
        ' --family ' +
        operationFamily(command.operation),
    );
    return;
  }
  const result = await call(command.path + queryFor(options));
  if (command.operation === 'export') {
    try {
      await writeFile(
        options.out,
        filter(JSON.stringify(result.data, null, 2)) + '\n',
        { flag: 'wx', mode: 0o600 },
      );
    } catch {
      throw new OperatorError(
        'Cannot write export. Choose a new output filename in a restricted local directory. Existing files are never overwritten.',
      );
    }
    print(
      'Export saved. Verify exportHash and retain it in restricted storage.',
    );
  } else print(result);
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  run(process.argv.slice(2)).catch((error) => {
    const safe = secretFilter(process.env.GRIDVIEW_IDENTITY_TOKEN);
    process.stderr.write(
      safe(
        error instanceof OperatorError
          ? error.message
          : error?.message?.startsWith('INVALID_REQUEST:')
            ? 'Invalid command or closed request shape. Run npm run identity -- --help.'
            : 'Identity operation failed. Inspect its receipt before retrying a mutation.',
      ) + '\n',
    );
    process.exitCode = 1;
  });
}
