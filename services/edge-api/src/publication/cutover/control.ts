/**
 * The one explicit, typed, fail-closed cutover control
 * ([ADR 0025](../../../../../docs/adr/0025-season-publication-authority-and-rollback-republication.md)
 * D12) - **absent, and therefore disabled, in every committed environment.**
 *
 * D12 step 1 closes *new legacy mutation admission* for exactly one season
 * before a checkpoint is approved, and keeps it closed until the separate
 * activation confirmation resumes that season's mutators. This value is how
 * that closure is represented in the repository: one environment variable, read
 * once at the composition boundary, naming one season and one of the two
 * cutover phases.
 *
 * ```
 * SEASON_PUBLICATION_CUTOVER_CONTROL=seed:2026
 * SEASON_PUBLICATION_CUTOVER_CONTROL=activate:2026
 * ```
 *
 * The two phases are deliberately separate values rather than one "cutover"
 * flag. D12 forbids combining seed and activation, so a mode that permits both
 * would put the two transitions behind a single operator act - exactly the
 * conflation the two-state `seeded`/`active` lifecycle exists to prevent.
 *
 * **Absent is disabled, and disabled preserves today's behaviour
 * byte-for-byte**: the composition wires the exact publication commands it
 * wires today, no season is paused, and the internal cutover routes report
 * `disabled` without reading any authority.
 *
 * **A malformed non-empty value is a bounded configuration failure, never a
 * silent disable.** An operator who typed `seed:20261` or `sead:2026` believes
 * a season is paused; resolving that to "disabled" would leave the season
 * openly mutable underneath them. It therefore throws the same
 * `ConfigurationError` an unknown `PROVIDER_MODE` throws, which the Worker
 * already maps to a bounded 500 with no raw value in the response or the log.
 *
 * **This control never activates anything by itself.** It only decides which
 * season is paused and which single cutover operation is *permitted to be
 * attempted*; every operation additionally requires the sequencer authority
 * mode, a reachable port, admin authentication and - for activation - an
 * explicit confirmation bound to the seeded fingerprint.
 */

import { isSeason } from '../sequencer/store';

/**
 * The resolved control.
 *
 * `disabled` is the only value any committed environment produces. `seed` and
 * `activate` both close the named season's legacy mutation admission; they
 * differ only in which cutover operation they permit.
 */
export type CutoverControl =
  | { readonly kind: 'disabled' }
  | { readonly kind: 'seed'; readonly season: number }
  | { readonly kind: 'activate'; readonly season: number };

export const disabledCutoverControl: CutoverControl = { kind: 'disabled' };

/** The two phases, as the operator surface names them. */
export type CutoverPhase = 'seed' | 'activate';

/**
 * `seed:YYYY` or `activate:YYYY`, anchored, with no surrounding whitespace
 * tolerated - a value that needs trimming to be understood is a value the
 * operator did not write on purpose.
 */
const controlPattern = /^(seed|activate):(\d{4})$/;

/**
 * Parses the cutover control: the resolved value, or **`null` for a malformed
 * non-empty one**.
 *
 * An absent value and an empty string are both *disabled*: an unset Wrangler
 * variable and one set to `""` are the same statement, and neither is a
 * malformed attempt at naming a season. Everything else must parse exactly.
 *
 * `null` is deliberately a distinct answer from `disabled`, and the caller
 * (`resolveRuntimeConfig`) turns it into the same bounded `ConfigurationError`
 * an unknown `PROVIDER_MODE` produces. Collapsing the two here would be exactly
 * the silent disable D12 forbids. Parsing stays free of that error type so this
 * module has no import cycle with the configuration module that calls it.
 */
export function parseCutoverControl(
  value: string | undefined,
): CutoverControl | null {
  if (value === undefined || value === '') return disabledCutoverControl;
  const parts = controlPattern.exec(value);
  if (parts === null) return null;
  const season = Number(parts[2]);
  if (!isSeason(season)) return null;
  return parts[1] === 'seed'
    ? { kind: 'seed', season }
    : { kind: 'activate', season };
}

/** Whether this control closes legacy mutation admission for `season`. */
export function pausesSeason(control: CutoverControl, season: number): boolean {
  return control.kind !== 'disabled' && control.season === season;
}
