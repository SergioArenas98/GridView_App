// U11 G4 request accounting (comparison policy §3.3, first bullet). Skipped
// unless GRIDVIEW_U11_PARITY_EXPORT and GRIDVIEW_U11_CAPTURES are set.
//
//   GRIDVIEW_U11_PARITY_EXPORT=<verified staging export file>
//   GRIDVIEW_U11_CAPTURES=<dir containing 2026-10-07/capture, ...>
//   GRIDVIEW_U11_ACCOUNTING_OUT=<new result file>   (optional)
//
// Runs the generator in-process for side A (bundled) and side B (runtime from
// the export) over the same verified recordings, with the real replay
// transport and limiter wrapped only to record the request sequence and the
// limiter reservations. No network: the replay transport never calls fetch,
// and fetch is replaced with a throwing stub for the whole test.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { RecordedResponse } from '../../scripts/season-batch/replay';

const log = vi.hoisted(() => ({
  urls: [] as string[],
  reservations: [] as string[],
}));
vi.mock('../../scripts/season-batch/replay', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../scripts/season-batch/replay')>();
  return {
    ...actual,
    replayTransport(recordings: readonly RecordedResponse[]) {
      const replay = actual.replayTransport(recordings);
      return {
        ...replay,
        transport: (async (request) => {
          log.urls.push(`${request.method} ${request.url}`);
          return replay.transport(request);
        }) as typeof replay.transport,
      };
    },
    replayLimiter: {
      async reserve(
        sourceId: Parameters<typeof actual.replayLimiter.reserve>[0],
      ) {
        log.reservations.push(sourceId);
        return actual.replayLimiter.reserve(sourceId);
      },
    },
  };
});

import { decodeCaptureManifest } from '../../scripts/season-batch/capture';
import { generateSeasonBatch } from '../../scripts/season-batch/generate';
import { verifyCatalogFile } from '../../scripts/identity/catalog-file';

const exportPath = process.env.GRIDVIEW_U11_PARITY_EXPORT;
const capturesRoot = process.env.GRIDVIEW_U11_CAPTURES;
const outPath = process.env.GRIDVIEW_U11_ACCOUNTING_OUT;
const installationId = 'c45d60b8-a723-4b6e-8530-750592af2b94';
const captures = ['2026-10-07', '2026-10-13', '2026-10-19'];
const provenance = { gitCommit: '0'.repeat(40), treeClean: true };

async function readCapture(directory: string) {
  const capture: unknown = JSON.parse(
    await readFile(join(directory, 'capture.json'), 'utf8'),
  );
  const decoded = decodeCaptureManifest(capture);
  if (!decoded.ok) throw new Error('capture-malformed');
  const bodies = new Map<string, Uint8Array>();
  for (const entry of decoded.manifest.responses)
    bodies.set(
      entry.file,
      new Uint8Array(await readFile(join(directory, entry.file))),
    );
  return { capture, bodies };
}

async function side(input: Parameters<typeof generateSeasonBatch>[0]) {
  log.urls.length = 0;
  log.reservations.length = 0;
  const result = await generateSeasonBatch(input);
  return { result, urls: [...log.urls], reservations: [...log.reservations] };
}

describe.skipIf(!exportPath || !capturesRoot)(
  'U11 G4 request accounting',
  () => {
    const results: unknown[] = [];
    let catalogExport: Uint8Array;
    let reference: unknown;
    const originalFetch = globalThis.fetch;

    beforeAll(async () => {
      globalThis.fetch = (() => {
        throw new Error('U11 accounting never sends a request');
      }) as typeof fetch;
      catalogExport = new Uint8Array(await readFile(exportPath!));
      reference = (
        await verifyCatalogFile(catalogExport, { installationId, season: 2026 })
      ).reference;
    });
    afterAll(async () => {
      globalThis.fetch = originalFetch;
      if (outPath)
        await writeFile(outPath, JSON.stringify(results, null, 2), {
          flag: 'wx',
        });
    });

    for (const date of captures)
      it(`capture ${date}: identical requests, reservations and eligibility`, async () => {
        const input = await readCapture(join(capturesRoot!, date, 'capture'));
        const a = await side({ ...input, provenance, identityMode: 'bundled' });
        const b = await side({
          ...input,
          provenance,
          identityMode: 'runtime',
          installationId,
          catalogExport,
          inventoryPolicy: 'strict-v1',
        });
        expect(a.result.ok, JSON.stringify(a.result).slice(0, 300)).toBe(true);
        expect(b.result.ok, JSON.stringify(b.result).slice(0, 300)).toBe(true);
        if (!a.result.ok || !b.result.ok) return;
        expect(b.urls).toEqual(a.urls);
        expect(b.reservations).toEqual(a.reservations);
        expect(a.urls.length).toBeGreaterThan(0);
        expect(b.result.summary).toEqual(a.result.summary);
        const bArtifact = JSON.parse(b.result.artifact.text) as {
          identityCatalog: unknown;
        };
        expect(bArtifact.identityCatalog).toEqual(reference);
        const perSource = (list: string[]) =>
          Object.fromEntries(
            [...new Set(list)].map((s) => [
              s,
              list.filter((x) => x === s).length,
            ]),
          );
        results.push({
          capture: date,
          requests: a.urls.length,
          requestSequenceSha256: await sha256(a.urls.join('\n')),
          reservations: perSource(a.reservations),
          summaryEqual: true,
          referenceEqualsVerifiedExport: true,
          eligible: { a: a.result.ok, b: b.result.ok },
        });
      });
  },
);

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}
