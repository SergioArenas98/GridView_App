/**
 * Environment sections of `wrangler.toml`, for the pins that allow a
 * declaration in named environments only.
 *
 * Two environments are allowed to select the automatic path and bind the
 * reconciliation ledger: the isolated demonstration Worker (`[env.e2e]`,
 * release gate AU-3; `docs/release/automatic-updates.md` §8.1) and, since
 * gate AU-4, live staging (`[env.staging]`, §8.3). Only the demonstration
 * Worker may read a controlled provider source. The dormancy pins that forbid
 * those everywhere else read the file through `withoutDemonstration` or
 * `withoutAutomatic`, so a declaration can be excused only by sitting inside
 * an allowed section, never by a whole-file match.
 */

export const DEMONSTRATION_ENVIRONMENT = 'e2e';

/** The environments that select `coordinated` and bind the ledger. */
export const AUTOMATIC_ENVIRONMENTS = ['staging', DEMONSTRATION_ENVIRONMENT];

/** Whether a table header line belongs to the named environment. */
function isEnvironmentHeader(line: string, name: string): boolean {
  return new RegExp(`^\\[\\[?env\\.${name}[.\\]]`).test(line.trim());
}

/** Whether a line opens any TOML table or array of tables. */
function isHeader(line: string): boolean {
  return /^\[/.test(line.trim());
}

/**
 * `[start, end)` line indexes of one environment's section: its header up to
 * the next table of another environment. The header must appear exactly once.
 */
function sectionBounds(
  lines: readonly string[],
  name: string,
): [number, number] {
  const header = `[env.${name}]`;
  const starts = lines.flatMap((line, index) =>
    line.trim() === header ? [index] : [],
  );
  if (starts.length !== 1 || starts[0] === undefined) {
    throw new Error(`expected exactly one ${header}, found ${starts.length}`);
  }
  const start = starts[0];
  const after = lines.findIndex(
    (line, index) =>
      index > start && isHeader(line) && !isEnvironmentHeader(line, name),
  );
  return [start, after === -1 ? lines.length : after];
}

/** One environment's section: its header up to the next foreign table. */
export function environmentSection(toml: string, name: string): string {
  const lines = toml.split('\n');
  const [start, end] = sectionBounds(lines, name);
  return lines.slice(start, end).join('\n');
}

/** Every line of the file except the named environments' sections. */
export function withoutEnvironments(
  toml: string,
  names: readonly string[],
): string {
  const lines = toml.split('\n');
  const excluded = new Set<number>();
  for (const name of names) {
    const [start, end] = sectionBounds(lines, name);
    for (let index = start; index < end; index += 1) excluded.add(index);
  }
  return lines.filter((_line, index) => !excluded.has(index)).join('\n');
}

/** The demonstration section: its header up to the next foreign table. */
export function demonstrationSection(toml: string): string {
  return environmentSection(toml, DEMONSTRATION_ENVIRONMENT);
}

/** Every line of the file except the demonstration section. */
export function withoutDemonstration(toml: string): string {
  return withoutEnvironments(toml, [DEMONSTRATION_ENVIRONMENT]);
}

/**
 * The one committed schedule: live staging, hourly at minute 17 (gate AU-4
 * step 3, `docs/release/automatic-updates.md` §8.3). Production, the
 * demonstration Worker and development schedule nothing.
 */
export const STAGING_CRONS: readonly string[] = ['17 * * * *'];

/** The committed staging line, exactly. */
export const STAGING_CRONS_LINE = `crons = ["${STAGING_CRONS.join('", "')}"]`;

/** Every line of the file except the staging section. */
export function withoutStaging(toml: string): string {
  return withoutEnvironments(toml, ['staging']);
}

/** Every line of the file except the sections allowed the automatic path. */
export function withoutAutomatic(toml: string): string {
  return withoutEnvironments(toml, AUTOMATIC_ENVIRONMENTS);
}
