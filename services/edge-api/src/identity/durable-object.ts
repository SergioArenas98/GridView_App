import { serveIdentityAdmin } from '../admin/identity/service';
import {
  handleRecoveryCommand,
  recoveryObjectPath,
  type RecoveryHost,
} from '../recovery/pitr';
import { CatalogOriginProof } from './catalog/origin-proof';
import { CatalogRunPins } from './catalog/pin';
import { CatalogBatchAdmissions } from './catalog/batch-admission';
import { CatalogValidationError } from './catalog/model';
import type { IdentityAdminEnvironment } from '../admin/identity/auth';
/** Dedicated installation-scoped SQLite object. Exporting this provisions nothing. */
import { IdentityStore } from './store';
import type { IdentityStorage } from './schema';
import {
  IdentityError,
  type IdentityCommand,
  type ReaderPrincipal,
} from './port';
import { exact, readBounded, requireValid, uuidPattern } from './wire-decoders';
export interface IdentityDurableState {
  storage: IdentityStorage & {
    setAlarm?(time: number): Promise<void>;
    getAlarm?(): Promise<number | null>;
  };
}
export type IdentityEnvironment = IdentityAdminEnvironment;
export class IdentityCatalog {
  private readonly store: IdentityStore;
  private readonly originProof = new CatalogOriginProof();
  constructor(
    private readonly state: IdentityDurableState,
    private readonly env: IdentityEnvironment,
    private readonly syntheticTests = false,
  ) {
    requireValid(
      typeof env.IDENTITY_INSTALLATION_ID === 'string' &&
        uuidPattern.test(env.IDENTITY_INSTALLATION_ID),
    );
    this.store = new IdentityStore(state.storage, env.IDENTITY_INSTALLATION_ID);
  }
  async fetch(request: Request): Promise<Response> {
    if (new URL(request.url).pathname === recoveryObjectPath)
      return handleRecoveryCommand(
        request,
        this.state as unknown as RecoveryHost,
      );
    if (
      ['/batch-admit', '/batch-transition'].includes(
        new URL(request.url).pathname,
      )
    ) {
      try {
        requireValid(request.method === 'POST');
        const authority = this.syntheticTests
          ? {
              isolatedLocalTests: true,
              verify: (): never => {
                throw Error('Read-only synthetic host');
              },
            }
          : undefined;
        const store = new CatalogBatchAdmissions(
          this.state.storage,
          this.store.installation,
          authority,
          Date.now,
          this.originProof,
        );
        const body = await readBounded(request);
        const result =
          new URL(request.url).pathname === '/batch-admit'
            ? await store.admitBatch(body)
            : await store.transitionBatch(body);
        return Response.json(result, {
          headers: { 'Cache-Control': 'no-store' },
        });
      } catch (error) {
        return Response.json(
          {
            error:
              error instanceof CatalogValidationError &&
              error.code === 'runtime-batch-requires-u7'
                ? 'runtime-batch-requires-u7'
                : 'catalog-admission-refused',
          },
          { status: error instanceof CatalogValidationError ? 422 : 503 },
        );
      }
    }
    if (new URL(request.url).pathname === '/run-pin') {
      try {
        requireValid(request.method === 'POST');
        const readerAuthority = this.syntheticTests
          ? {
              isolatedLocalTests: true,
              verify: (): never => {
                throw new Error('Read-only synthetic host');
              },
            }
          : undefined;
        const repository = new CatalogRunPins(
          this.state.storage,
          this.store.installation,
          readerAuthority,
          Date.now,
          this.originProof,
        );
        const result = await repository.pinRun(await readBounded(request));
        return Response.json(result, {
          headers: { 'Cache-Control': 'no-store' },
        });
      } catch (error) {
        const invalid = error instanceof CatalogValidationError;
        return Response.json(
          { error: invalid ? 'catalog-invalid' : 'catalog-unavailable' },
          {
            status: invalid ? 422 : 503,
            headers: { 'Cache-Control': 'no-store' },
          },
        );
      }
    }
    if (new URL(request.url).pathname.startsWith('/internal/admin/identity/')) {
      return serveIdentityAdmin(
        request,
        this.env,
        this.state.storage,
        this.syntheticTests,
        Date.now,
        this.originProof,
      );
    }
    try {
      requireValid(request.method === 'POST');
      const body = await readBounded(request);
      requireValid(
        exact(body, [
          'schemaVersion',
          'installationId',
          'command',
          'payload',
        ]) && body.schemaVersion === 1,
      );
      if (body.installationId !== this.store.installation)
        throw new IdentityError('installation-mismatch');
      const command = body.command as IdentityCommand;
      let data: unknown;
      switch (command) {
        case 'observe-batch':
          data = await this.store.observe(body.payload);
          // New sightings must not postpone an already scheduled retention sweep.
          if ((await this.state.storage.getAlarm?.()) == null)
            await this.state.storage.setAlarm?.(Date.now() + 86400000);
          break;
        case 'list':
          data = this.store.list(body.payload);
          break;
        case 'inspect':
          data = this.store.inspect(body.payload);
          break;
        case 'health':
          requireValid(exact(body.payload, []));
          data = this.store.health();
          break;
        case 'acknowledge':
          // Trusted namespace operation only. No shared-token HTTP route forwards it.
          requireValid(exact(body.payload, ['request', 'principal']));
          data = this.store.acknowledge(
            body.payload.request,
            body.payload.principal as ReaderPrincipal,
          );
          break;
        default:
          throw new IdentityError('invalid-request');
      }
      return Response.json(
        {
          schemaVersion: 1,
          installationId: this.store.installation,
          command,
          data,
        },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    } catch (error) {
      const code = error instanceof IdentityError ? error.code : 'unavailable';
      return Response.json(
        { error: code },
        {
          status: code === 'unavailable' ? 503 : 400,
          headers: { 'Cache-Control': 'no-store' },
        },
      );
    }
  }
  async alarm(): Promise<void> {
    const result = this.store.maintain();
    // Small persisted-cursor batches, never external notification scheduling.
    await this.state.storage.setAlarm?.(
      Date.now() + (result.more ? 60000 : 86400000),
    );
  }
}
