/**
 * Resolves which season publication authority this Worker instance runs with
 * (ADR 0025 D6, D12), and nothing more.
 *
 * The default - and the only configuration any deployed environment uses - is
 * `legacy`: the existing Workers KV `active:{season}`/`previous:{season}`
 * pointers. The composition root then wires the exact `SnapshotPublisher` and
 * the exact public router path it wires today, and never constructs a sequencer
 * port or performs a Durable Object lookup.
 *
 * `sequencer` is selected only by `SEASON_PUBLICATION_AUTHORITY=sequencer`
 * together with a way to reach the sequencer - the test-only
 * `__SEASON_PUBLICATION_SEQUENCER` port, or a future `SEASON_PUBLICATION_SEQUENCER`
 * Durable Object namespace that no `wrangler.toml` declares yet. If the mode is
 * requested but neither is available, this **falls back to `legacy`**: an
 * unreachable mechanism is not a runtime lookup failure to fail closed on, it
 * is simply not being in sequencer mode at all. (The forbidden fallback in
 * ADR 0025 D6/D7 is a *post-activation* legacy KV read, which this never does.)
 */

import type { Env, RuntimeConfig } from '../config/environment';
import { DurableObjectSeasonPublicationSequencer } from './sequencer/durable-object';
import type { SeasonPublicationSequencerPort } from './sequencer/port';

export type PublicationAuthority =
  | { readonly mode: 'legacy' }
  | {
      readonly mode: 'sequencer';
      readonly port: SeasonPublicationSequencerPort;
    };

export const legacyPublicationAuthority: PublicationAuthority = {
  mode: 'legacy',
};

export function resolvePublicationAuthority(
  env: Env,
  config: RuntimeConfig,
): PublicationAuthority {
  if (config.publicationAuthorityMode !== 'sequencer') {
    return legacyPublicationAuthority;
  }
  if (env.__SEASON_PUBLICATION_SEQUENCER) {
    return { mode: 'sequencer', port: env.__SEASON_PUBLICATION_SEQUENCER };
  }
  if (env.SEASON_PUBLICATION_SEQUENCER) {
    return {
      mode: 'sequencer',
      port: new DurableObjectSeasonPublicationSequencer(
        env.SEASON_PUBLICATION_SEQUENCER,
      ),
    };
  }
  return legacyPublicationAuthority;
}
