// Shared reporting helpers for the validation scripts.

/** ANSI-free, CI-friendly section header. */
export function heading(text) {
  console.log(`\n=== ${text} ===`);
}

/**
 * Prints Ajv errors for one file, each on its own line with the instance path,
 * message and the schema path that failed.
 */
export function printAjvErrors(fileLabel, errors) {
  console.error(`FAIL ${fileLabel}`);
  for (const err of errors ?? []) {
    const at = err.instancePath || '(root)';
    console.error(`  - ${at} ${err.message} [schema: ${err.schemaPath}]`);
  }
}

/** Exit helper that prints a summary and returns the process exit code. */
export function summarize(kind, checked, failures) {
  heading('summary');
  console.log(`${kind}: ${checked} checked, ${failures} failed`);
  return failures === 0 ? 0 : 1;
}
