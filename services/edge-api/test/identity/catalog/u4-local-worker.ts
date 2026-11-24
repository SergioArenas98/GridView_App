/** Isolated local test adapter. Never exported by the production Worker. */
import {
  IdentityCatalog,
  type IdentityDurableState,
  type IdentityEnvironment,
} from '../../../src/identity/durable-object';
import { CatalogWorkflow } from '../../../src/identity/catalog/workflow';
import { localAuthority } from './u4-authority';
import type { ReviewRequest } from '../../../src/identity/catalog/review';
import type {
  ActivationRequest,
  RevisionOperation,
} from '../../../src/identity/catalog/activation';
export class U4TestHost extends IdentityCatalog {
  private readonly workflow: CatalogWorkflow | null;
  private readonly cap: object;
  constructor(
    state: IdentityDurableState,
    env: IdentityEnvironment & {
      TEST_U2_ONLY?: boolean;
      TEST_FAIL_WRITE?: number;
      TEST_NOW?: string;
    },
  ) {
    super(state, env, true);
    const a = localAuthority();
    this.cap = a.issue();
    let writes = 0;
    const storage = {
      transactionSync: <T>(fn: () => T) => state.storage.transactionSync(fn),
      sql: {
        exec(q: string, ...args: (string | number | null)[]) {
          if (
            /^(INSERT|UPDATE|DELETE)/.test(q) &&
            ++writes === env.TEST_FAIL_WRITE
          )
            throw Error('synthetic-u4-interruption');
          return state.storage.sql.exec(q, ...args);
        },
      },
    };
    this.workflow = env.TEST_U2_ONLY
      ? null
      : new CatalogWorkflow(
          storage,
          env.IDENTITY_INSTALLATION_ID!,
          a.authority,
          // A P0 (2026.11.22.1) seed needs a later fixed instant.
          () => Date.parse(env.TEST_NOW ?? '2026-11-14T12:00:00.000Z'),
        );
  }
  override async fetch(request: Request): Promise<Response> {
    if (new URL(request.url).pathname !== '/u4') return super.fetch(request);
    try {
      if (!this.workflow) throw Error('U2 only');
      const v = (await request.json()) as {
        method: string;
        input: unknown;
        command: unknown;
      };
      let result: unknown;
      switch (v.method) {
        case 'seed':
          result = await this.workflow.proposeSeed(
            v.input,
            v.command as Parameters<CatalogWorkflow['proposeSeed']>[1],
            this.cap,
          );
          break;
        case 'evidence':
          result = await this.workflow.recordEvidence(
            v.input as Parameters<CatalogWorkflow['recordEvidence']>[0],
            this.cap,
          );
          break;
        case 'review':
          result = await this.workflow.review(
            v.input as ReviewRequest,
            this.cap,
          );
          break;
        case 'validate':
          result = await this.workflow.validate(
            v.input as RevisionOperation,
            this.cap,
          );
          break;
        case 'activate':
          result = await this.workflow.activate(
            v.input as ActivationRequest,
            this.cap,
          );
          break;
        case 'abandon':
          result = await this.workflow.abandon(
            v.input as RevisionOperation,
            this.cap,
          );
          break;
        case 'export':
          result = await this.workflow.exportRevision(String(v.input));
          break;
        case 'head':
          result = this.workflow.head();
          break;
        case 'operation': {
          const r = v.input as {
            principalId: string;
            family: string;
            operationId: string;
          };
          result = await this.workflow.readOperation(
            r.principalId,
            r.family,
            r.operationId,
          );
          break;
        }
        default:
          throw Error('unsupported-test-method');
      }
      return Response.json({ result });
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : 'refused' },
        { status: 409 },
      );
    }
  }
}
export default {
  fetch(request: Request, env: { IDENTITY_CATALOG: DurableObjectNamespace }) {
    return env.IDENTITY_CATALOG.get(
      env.IDENTITY_CATALOG.idFromName('isolated-u4'),
    ).fetch(request);
  },
};
