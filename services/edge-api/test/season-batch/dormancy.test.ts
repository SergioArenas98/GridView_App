/**
 * The season-batch generator is dormant tooling: it is never part of the
 * Worker, and nothing in it can send a request or read a credential.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { readSource, sourceFiles } from '../sync/coordinated/source-graph';

const generatorDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'scripts',
  'season-batch',
);

function generatorSources(): { file: string; text: string }[] {
  return readdirSync(generatorDir)
    .filter((file) => file.endsWith('.ts') || file.endsWith('.mjs'))
    .map((file) => ({
      file,
      text: readFileSync(join(generatorDir, file), 'utf8'),
    }));
}

describe('season-batch generator: dormancy', () => {
  it('is reachable from no Worker source file', () => {
    // The Worker names the batch format (its guarded staging ingest reads
    // batches), but never imports the generator or any other script.
    const importers = sourceFiles().filter((file) =>
      /(?:from|import)\s*\(?\s*'[^']*scripts\//.test(readSource(file)),
    );
    expect(importers).toEqual([]);
  });

  it('never calls fetch or opens a network module', () => {
    for (const { file, text } of generatorSources()) {
      expect(text, file).not.toMatch(/\bfetch\s*\(/);
      expect(text, file).not.toMatch(
        /from\s+'node:(?:http|https|net|tls|dns|dgram)'/,
      );
    }
  });

  it('reads no environment variable and names no credential', () => {
    for (const { file, text } of generatorSources()) {
      expect(text, file).not.toMatch(
        /process\.env|Deno\.env|import\.meta\.env/,
      );
      expect(text, file).not.toMatch(/ADMIN_TOKEN|CLOUDFLARE_|API_TOKEN/);
    }
  });

  it('builds no publication, sequencer, storage or ledger client', () => {
    for (const { file, text } of generatorSources()) {
      expect(text, file).not.toMatch(
        /SequencedPublicationService|SnapshotPublisher|publishGuarded\(|resolveStorage|KvSnapshotStorage|ReconciliationLedger|DurableObject/,
      );
    }
  });
});
