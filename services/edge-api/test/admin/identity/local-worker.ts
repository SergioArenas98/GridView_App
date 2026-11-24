/** Test bundle only: synthetic admission and evidence injection are never
 * exported by the production Worker. No test capability issuer is imported. */
import {
  IdentityCatalog as RuntimeCatalog,
  type IdentityDurableState,
  type IdentityEnvironment,
} from '../../../src/identity/durable-object';
import type { Env } from '../../../src/config/environment';
import { handleIdentityRequest } from '../../../src/admin/identity/routes';
import { IdentityClient } from '../../../src/identity/client';
export class IdentityCatalog extends RuntimeCatalog {
  constructor(state: IdentityDurableState, env: IdentityEnvironment) {
    super(state, env, true);
  }
}
export default {
  async fetch(request: Request, env: Env) {
    if (new URL(request.url).pathname === '/__test/observe') {
      const client = new IdentityClient(
        env.IDENTITY_CATALOG!,
        env.IDENTITY_INSTALLATION_ID!,
      );
      return Response.json(await client.observe(await request.json()));
    }
    const response = await handleIdentityRequest(
      request,
      env,
      crypto.randomUUID(),
    );
    // Test transport fault after the real DO transaction and HTTP receipt commit.
    // This adapter is never included in the production Worker.
    if (
      request.headers.get('X-Test-Lose-Response') === '1' &&
      response.status === 200
    ) {
      await response.body?.cancel();
      return Response.json(
        { error: { code: 'TEST_RESPONSE_LOST' } },
        { status: 503 },
      );
    }
    return response;
  },
};
