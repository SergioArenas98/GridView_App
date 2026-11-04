// A mocked Jolpica built from the season-batch fixture capture. No network.
import { fixtureCapture, type FixtureCapture } from '../season-batch/support';

export interface MockCall {
  readonly url: string;
  readonly init: RequestInit;
}

export interface MockJolpica {
  readonly transport: (url: string, init: RequestInit) => Promise<Response>;
  readonly calls: MockCall[];
}

/**
 * Serves `capture`'s recorded bodies by URL. `override(url, index)` may answer
 * instead (a 429, a timeout...). An unknown URL is a 404 and fails a test.
 */
export function mockJolpica(
  capture: FixtureCapture = fixtureCapture(),
  override?: (url: string, index: number) => Response | Error | undefined,
): MockJolpica {
  const byUrl = new Map(capture.responses.map((entry) => [entry.url, entry]));
  const calls: MockCall[] = [];
  return {
    calls,
    async transport(url, init) {
      calls.push({ url, init });
      const replaced = override?.(url, calls.length);
      if (replaced instanceof Error) throw replaced;
      if (replaced) return replaced;
      const entry = byUrl.get(url);
      if (!entry)
        return new Response('{}', {
          status: 404,
          headers: { 'content-type': 'application/json' },
        });
      return new Response(entry.body, {
        status: entry.status,
        headers: { 'content-type': entry.contentType, server: 'cloudflare' },
      });
    },
  };
}

export const tooMany = (headers: Record<string, string> = {}) =>
  new Response('error code: 1015', {
    status: 429,
    headers: { 'content-type': 'text/plain', server: 'cloudflare', ...headers },
  });

export const noSleep = async () => {};
