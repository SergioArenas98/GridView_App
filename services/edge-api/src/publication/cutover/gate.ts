/**
 * The one gate every cutover operation passes
 * ([ADR 0025](../../../../../docs/adr/0025-season-publication-authority-and-rollback-republication.md)
 * D12): seed, activation, genesis and the read-only status.
 *
 * Every refusal here is taken **before** any storage read and any sequencer
 * call, in the order that reveals the least.
 */

import type { EnvironmentName } from '../../config/environment';
import type { PublicationAuthority } from '../authority';
import type { SeasonPublicationSequencerPort } from '../sequencer/port';
import type { CutoverControl, CutoverPhase } from './control';

/**
 * Why an operation could not even be attempted.
 *
 * Every value here is a refusal taken **before** any storage read.
 */
export const cutoverGateRefusals = [
  /** No cutover control is set at all. */
  'disabled',
  /** The control names a different season. */
  'season-not-paused',
  /** Each phase permits only its own operation. */
  'phase-not-permitted',
  /** Only staging is an authorized seed or activation target. */
  'environment-not-staging',
  /** Genesis runs in production or staging, never in development. */
  'environment-not-permitted',
  /** `SEASON_PUBLICATION_AUTHORITY` is not the exact string `sequencer`. */
  'authority-mode-not-sequencer',
  /** Sequencer mode is selected and no port is reachable. */
  'sequencer-unavailable',
] as const;

export type CutoverGateRefusal = (typeof cutoverGateRefusals)[number];

export type CutoverGate =
  | { readonly kind: 'ok'; readonly port: SeasonPublicationSequencerPort }
  | { readonly kind: 'refused'; readonly refusal: CutoverGateRefusal };

/**
 * All conditions are required together:
 *
 * - a control naming exactly this season, in exactly this phase - `seed:`
 *   cannot activate, `activate:` cannot seed, and neither runs a genesis, so
 *   no single operator act performs two transitions;
 * - the environment the phase permits: staging for a seed or an activation
 *   (a migration from legacy pointers), production or staging for a genesis
 *   (a season with no legacy release, which is what production's seasons are);
 * - `SEASON_PUBLICATION_AUTHORITY=sequencer` with a reachable port.
 */
export function cutoverGate(
  control: CutoverControl,
  environment: EnvironmentName,
  authority: PublicationAuthority,
  season: number,
  phase: CutoverPhase,
): CutoverGate {
  if (control.kind === 'disabled') {
    return { kind: 'refused', refusal: 'disabled' };
  }
  if (control.season !== season) {
    return { kind: 'refused', refusal: 'season-not-paused' };
  }
  if (control.kind !== phase) {
    return { kind: 'refused', refusal: 'phase-not-permitted' };
  }
  if (phase === 'genesis') {
    if (environment !== 'production' && environment !== 'staging') {
      return { kind: 'refused', refusal: 'environment-not-permitted' };
    }
  } else if (environment !== 'staging') {
    return { kind: 'refused', refusal: 'environment-not-staging' };
  }
  if (authority.mode === 'legacy') {
    return { kind: 'refused', refusal: 'authority-mode-not-sequencer' };
  }
  if (authority.mode === 'sequencer-unavailable') {
    return { kind: 'refused', refusal: 'sequencer-unavailable' };
  }
  return { kind: 'ok', port: authority.port };
}
