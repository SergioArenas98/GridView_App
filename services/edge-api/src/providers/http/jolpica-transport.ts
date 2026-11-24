import type { JolpicaTransportConfig } from '../../config/environment';
import {
  buildProviderUrl,
  providerEndpointFor,
  type ProviderTransport,
} from './provider-http-client';

/**
 * Optional egress after the hardened client has constructed and reserved its
 * canonical request. No retry, fallback, buffering or response transformation.
 * The same transport still sends other providers directly without proxy auth.
 */
export function jolpicaTransport(
  config: JolpicaTransportConfig,
  transport: ProviderTransport,
): ProviderTransport {
  if (config.mode === 'direct') return transport;
  const endpoint = providerEndpointFor('jolpica');
  return async (request) => {
    const url = new URL(request.url);
    if (url.origin !== endpoint.origin) return transport(request);
    if (
      request.method !== 'GET' ||
      request.body !== null ||
      url.username !== '' ||
      url.password !== '' ||
      url.hash !== '' ||
      buildProviderUrl('jolpica', url.pathname) === null ||
      (endpoint.diagnosticPaths.includes(url.pathname) && url.search !== '')
    ) {
      throw new Error('Invalid canonical Jolpica transport request.');
    }
    const headers = new Headers(request.headers);
    headers.set('Authorization', `Bearer ${config.token}`);
    const forwarded = new Request(
      `${config.origin}${url.pathname}${url.search}`,
      {
        method: request.method,
        headers,
        signal: request.signal,
        // Workers may forward sensitive headers on redirects. Never follow one;
        // the existing HTTP client will classify the untouched 3xx response.
        redirect: 'manual',
      },
    );
    try {
      return await transport(forwarded);
    } catch {
      // A transport exception can include its authenticated request. Preserve
      // failure, but never propagate that detail. The client owns abort/timeout
      // classification through the linked signal and its existing deadline.
      throw new Error('Jolpica proxy transport failed.');
    }
  };
}
