/** Isolated synthetic test host only; no production export or route. */
import worker from '../../../src/index';
import type { Env } from '../../../src/config/environment';
import { MemoryCachePurgeAdapter } from '../../../src/cache/purge';
import { CapturingLogger } from '../../../src/logging/logger';
import { DurableObjectSeasonPublicationSequencer } from '../../../src/publication/sequencer/durable-object';
import { genesisFingerprint } from '../../../src/publication/cutover/genesis';
export { SeasonPublicationSequencer } from '../../../src/publication/sequencer/durable-object';
export { ReconciliationLedger } from '../../../src/sync/coordinated/ledger/durable-object';
export { U4TestHost } from './u4-local-worker';
export default {
  async fetch(request: Request, env: Env) {
    const path = new URL(request.url).pathname;
    if (path === '/u4')
      return env
        .IDENTITY_CATALOG!.get(
          env.IDENTITY_CATALOG!.idFromName(
            'identity:' + env.IDENTITY_INSTALLATION_ID,
          ),
        )
        .fetch(request.url, { method: 'POST', body: await request.text() });
    if (path === '/test-genesis') {
      const port = new DurableObjectSeasonPublicationSequencer(
        env.SEASON_PUBLICATION_SEQUENCER!,
      );
      return Response.json(
        await port.commitGenesis({
          season: 2026,
          genesisFingerprint: await genesisFingerprint(
            2026,
            'isolated-synthetic-u7',
          ),
        }),
      );
    }
    return worker.fetch(request, {
      ...env,
      __CACHE_PURGER: new MemoryCachePurgeAdapter(),
      __LOGGER: new CapturingLogger(),
    });
  },
};
