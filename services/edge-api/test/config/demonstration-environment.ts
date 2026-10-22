/**
 * The isolated demonstration Worker's section of `wrangler.toml`
 * (`[env.e2e]`, release gate AU-3; `docs/release/automatic-updates.md` §8.1).
 *
 * It is the one environment allowed to select the automatic path, bind the
 * reconciliation ledger and read a controlled provider source. The dormancy
 * pins that forbid those everywhere else read the file through
 * `withoutDemonstration`, so a declaration can be excused only by sitting
 * inside this section, never by a whole-file match.
 */

export const DEMONSTRATION_ENVIRONMENT = 'e2e';

const header = `[env.${DEMONSTRATION_ENVIRONMENT}]`;

/** Whether a table header line belongs to the demonstration environment. */
function isDemonstrationHeader(line: string): boolean {
  return /^\[\[?env\.e2e[.\]]/.test(line.trim());
}

/** Whether a line opens any TOML table or array of tables. */
function isHeader(line: string): boolean {
  return /^\[/.test(line.trim());
}

/** `[start, end)` line indexes of the section; it must appear exactly once. */
function sectionBounds(lines: readonly string[]): [number, number] {
  const starts = lines.flatMap((line, index) =>
    line.trim() === header ? [index] : [],
  );
  if (starts.length !== 1 || starts[0] === undefined) {
    throw new Error(`expected exactly one ${header}, found ${starts.length}`);
  }
  const start = starts[0];
  const after = lines.findIndex(
    (line, index) =>
      index > start && isHeader(line) && !isDemonstrationHeader(line),
  );
  return [start, after === -1 ? lines.length : after];
}

/** The demonstration section: its header up to the next foreign table. */
export function demonstrationSection(toml: string): string {
  const lines = toml.split('\n');
  const [start, end] = sectionBounds(lines);
  return lines.slice(start, end).join('\n');
}

/** Every line of the file except the demonstration section. */
export function withoutDemonstration(toml: string): string {
  const lines = toml.split('\n');
  const [start, end] = sectionBounds(lines);
  return [...lines.slice(0, start), ...lines.slice(end)].join('\n');
}
