// Types for run.mjs (used by the TypeScript tests).
export interface RunOptions {
  readonly mode: 'scheduled' | 'bootstrap';
  readonly submit: boolean;
  readonly state: string;
}

export declare function parseArguments(
  argv: readonly string[],
): RunOptions | null;
