/**
 * The Worker source files and the modules each one imports, with every
 * relative specifier **resolved** to a source path. Matching specifier text
 * instead would miss an import spelled from a sibling directory (`../policy`).
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

export const sourceDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'src',
);

/** Every `.ts` source file, relative to `src/`, with `/` separators. */
export function sourceFiles(): string[] {
  return (readdirSync(sourceDir, { recursive: true }) as string[])
    .map((entry) => entry.toString().split('\\').join('/'))
    .filter((file) => file.endsWith('.ts'))
    .sort();
}

export function readSource(file: string): string {
  return readFileSync(join(sourceDir, file), 'utf8');
}

function exists(file: string): boolean {
  try {
    return statSync(join(sourceDir, file)).isFile();
  } catch {
    return false;
  }
}

/** Every module `file` imports or re-exports, type-only ones included. */
export function importsOf(file: string): string[] {
  const specifiers = [
    ...readSource(file).matchAll(/\bfrom\s+'([^']+)'|\bimport\s+'([^']+)'/g),
  ].map((match) => (match[1] ?? match[2])!);
  const resolved: string[] = [];
  for (const specifier of specifiers) {
    if (!specifier.startsWith('.')) {
      resolved.push(specifier);
      continue;
    }
    const base = posix.normalize(posix.join(posix.dirname(file), specifier));
    const candidate = [`${base}.ts`, `${base}/index.ts`].find(exists);
    resolved.push(candidate ?? base);
  }
  return resolved;
}

/** Source files outside `directory` that import a module inside it. */
export function importersOf(directory: string): string[] {
  return sourceFiles()
    .filter((file) => !file.startsWith(directory))
    .filter((file) =>
      importsOf(file).some((imported) => imported.startsWith(directory)),
    );
}
