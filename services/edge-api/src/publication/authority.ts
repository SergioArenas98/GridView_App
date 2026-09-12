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
 * `__SEASON_PUBLICATION_SEQUENCER` port, or a bound `SEASON_PUBLICATION_SEQUENCER`
 * Durable Object namespace (declared for `env.staging` only). Default-off
 * depends on that configuration value, not on whether the namespace is
 * provisioned: while the value is absent, a bound namespace is never looked up.
 *
 * If that exact mode is selected and **neither** is available, the resolution is
 * `sequencer-unavailable`, never `legacy`. Silently falling back would discard
 * the operator's explicit authority selection: after a season has been cut over,
 * a deployment that renamed or dropped the binding would resume reading and
 * mutating stale KV pointers, which ADR 0025 D6/D7 forbid outright. The
 * unavailable state instead produces the same bounded failures a failed
 * authority lookup does - no `SnapshotPublisher` for a mutating command, no
 * `active:{season}` or `previous:{season}` read for a public request.
 *
 * An **absent** or unrecognised configuration is a different fact and keeps the
 * documented default-off behaviour: legacy mode, unchanged, with no sequencer
 * lookup anywhere.
 */

import type { Env, RuntimeConfig } from '../config/environment';
import { DurableObjectSeasonPublicationSequencer } from './sequencer/durable-object';
import type { SeasonPublicationSequencerPort } from './sequencer/port';

export type PublicationAuthority =
  | { readonly mode: 'legacy' }
  | {
      readonly mode: 'sequencer';
      readonly port: SeasonPublicationSequencerPort;
    }
  /** Sequencer mode was explicitly selected and no port is reachable. */
  | { readonly mode: 'sequencer-unavailable' };

export const legacyPublicationAuthority: PublicationAuthority = {
  mode: 'legacy',
};

export const unavailableSequencerAuthority: PublicationAuthority = {
  mode: 'sequencer-unavailable',
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
  return unavailableSequencerAuthority;
}
