import type {
  IdentityPort,
  IdentityCommand,
  ObserveResult,
  ListResult,
  InspectResult,
  HealthResult,
} from './port';
import { IdentityError } from './port';
import type { IdentityObservationDraft } from './discovery/model';
import { canonicalJson } from '../ingest/canonical-json';
import { exact, readBounded, requireValid, uuidPattern } from './wire-decoders';
import { decodeIdentityResponse } from './response-decoders';
export interface IdentityNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): {
    fetch(url: string, init: RequestInit): Promise<Response>;
  };
}
/** DO routing URL only; no global fetch or network transport is used. */
const identityRequestUrl = 'https://identity-catalog/call';
export class IdentityClient implements IdentityPort {
  constructor(
    private readonly namespace: IdentityNamespace,
    private readonly installation: string,
  ) {
    requireValid(uuidPattern.test(installation));
  }
  private async call(
    command: IdentityCommand,
    payload: unknown,
  ): Promise<unknown> {
    const stub = this.namespace.get(
      this.namespace.idFromName('identity:' + this.installation),
    );
    const response = await stub.fetch(identityRequestUrl, {
      method: 'POST',
      body: canonicalJson({
        schemaVersion: 1,
        installationId: this.installation,
        command,
        payload,
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const value = await readBounded(response);
    if (!response.ok) {
      if (
        exact(value, ['error']) &&
        [
          'invalid-request',
          'installation-mismatch',
          'schema-version',
          'capacity',
          'conflict',
          'not-found',
          'unavailable',
        ].includes(value.error as string)
      )
        throw new IdentityError(value.error as IdentityError['code']);
      throw new IdentityError('unavailable');
    }
    requireValid(
      exact(value, ['schemaVersion', 'installationId', 'command', 'data']) &&
        value.schemaVersion === 1 &&
        value.installationId === this.installation &&
        value.command === command,
    );
    return decodeIdentityResponse(command, value.data);
  }
  async observe(request: {
    observations: readonly IdentityObservationDraft[];
  }): Promise<ObserveResult> {
    return (await this.call('observe-batch', request)) as ObserveResult;
  }
  async list(
    request: Parameters<IdentityPort['list']>[0],
  ): Promise<ListResult> {
    return (await this.call('list', request)) as ListResult;
  }
  async inspect(
    request: Parameters<IdentityPort['inspect']>[0],
  ): Promise<InspectResult> {
    return (await this.call('inspect', request)) as InspectResult;
  }
  async health(): Promise<HealthResult> {
    return (await this.call('health', {})) as HealthResult;
  }
}
