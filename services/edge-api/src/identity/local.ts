/** Local harness entry point only; never imported by the deployed Worker. */
export { IdentityCatalog } from './durable-object';
import type { IdentityNamespace } from './client';
export default {
  fetch(
    request: Request,
    env: {
      IDENTITY_CATALOG: IdentityNamespace;
      IDENTITY_INSTALLATION_ID: string;
    },
  ): Promise<Response> {
    return env.IDENTITY_CATALOG.get(
      env.IDENTITY_CATALOG.idFromName(
        'identity:' + env.IDENTITY_INSTALLATION_ID,
      ),
    ).fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
  },
};
