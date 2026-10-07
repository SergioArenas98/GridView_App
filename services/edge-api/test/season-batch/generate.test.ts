import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  artifactKind,
  generateSeasonBatch,
  manifestKind,
  seasonBatchFailures,
  type SeasonBatchResult,
} from '../../scripts/season-batch/generate';
import { generateSnapshotSet } from '../../src/snapshots/generator';
import { deriveParticipationGuard } from '../../src/publication/guard/participation-guard';
import type { StoredSnapshot } from '../../src/storage/types';
import {
  circuitRow,
  circuitsEnvelope,
  fullSeasonCircuitRows,
} from '../providers/jolpica/circuits-support';
import {
  COMMIT,
  fixtureCapture,
  inputFor,
  OBSERVED_AT,
  sha256,
  urls,
  type FixtureCapture,
} from './support';

type Success = Extract<SeasonBatchResult, { readonly ok: true }>;

async function generated(capture?: FixtureCapture): Promise<Success> {
  const result = await generateSeasonBatch(inputFor(capture));
  if (!result.ok) {
    throw new Error(`refused: ${result.failure} (${String(result.detail)})`);
  }
  return result;
}

async function refusal(
  input: Parameters<typeof generateSeasonBatch>[0],
): Promise<{ failure: string; detail: string | null }> {
  const result = await generateSeasonBatch(input);
  if (result.ok) throw new Error('expected a refusal');
  return { failure: result.failure, detail: result.detail };
}

function edited(edit: (capture: FixtureCapture) => void): FixtureCapture {
  const capture = fixtureCapture();
  edit(capture);
  return capture;
}

function utf8Text(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

function parsed(text: string): Record<string, unknown> {
  return JSON.parse(text) as Record<string, unknown>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('season-batch generator: a complete capture', () => {
  it('generates an artifact and a manifest that describe each other', async () => {
    const result = await generated();
    const artifact = parsed(result.artifact.text);
    const manifest = parsed(result.manifest.text);

    expect(result.summary).toEqual({
      season: 2026,
      observedAt: OBSERVED_AT,
      version: '20260316120000000-batch',
      documentCount: 103,
      calendarRounds: 23,
      classifiedRounds: [1, 2, 3],
      participationFacts: 24,
      captureDigest: (manifest.capture as { digest: string }).digest,
    });
    expect(artifact).toMatchObject({
      kind: artifactKind,
      schemaVersion: 1,
      season: 2026,
      observedAt: OBSERVED_AT,
      release: {
        version: '20260316120000000-batch',
        generatedAt: OBSERVED_AT,
        sourceUpdatedAt: OBSERVED_AT,
        mediaVersion: null,
        attributionVersion: 'data-sources-v1',
      },
    });
    expect(manifest).toMatchObject({
      kind: manifestKind,
      schemaVersion: 1,
      season: 2026,
      use: 'review-only',
      review: { status: 'unreviewed' },
      generator: { gitCommit: COMMIT, treeClean: true },
      artifact: {
        file: 'artifact.json',
        byteLength: result.artifact.byteLength,
        sha256: result.artifact.sha256,
      },
      attribution: {
        name: 'Jolpica F1',
        licenseName: 'CC BY-NC-SA 4.0',
        recordVersion: 'data-sources-v1',
      },
    });
    expect(sha256(new TextEncoder().encode(result.artifact.text))).toBe(
      result.artifact.sha256,
    );
  });

  it('records every replayed response by URL, status, size and digest', async () => {
    const capture = fixtureCapture();
    const manifest = parsed((await generated(capture)).manifest.text);
    const recorded = (manifest.capture as { responses: unknown[] }).responses;
    const expected = capture.responses
      .map((entry) => ({
        url: entry.url,
        status: 200,
        contentType: entry.contentType,
        byteLength: entry.body.byteLength,
        sha256: sha256(entry.body),
      }))
      .sort((left, right) => (left.url < right.url ? -1 : 1));
    expect(recorded).toEqual(expected);
  });

  it('carries a source that regenerates exactly the published documents', async () => {
    const artifact = parsed((await generated()).artifact.text) as {
      source: Parameters<typeof generateSnapshotSet>[0];
      release: { version: string; generatedAt: string };
      documents: StoredSnapshot[];
    };
    const regenerated = generateSnapshotSet(
      artifact.source,
      artifact.release.generatedAt,
      artifact.release.version,
    );
    const normalize = (documents: readonly StoredSnapshot[]) =>
      JSON.parse(
        JSON.stringify(
          [...documents]
            .map((document) => ({
              documentName: String(document.documentName),
              resourceIdentity: document.resourceIdentity,
              meta: document.meta,
              data: document.data,
            }))
            .sort((left, right) =>
              left.documentName < right.documentName ? -1 : 1,
            ),
        ),
      ) as unknown;
    expect(normalize(artifact.documents)).toEqual(
      normalize(regenerated.documents),
    );
  });

  it('lists one digest per document, matching the artifact', async () => {
    const result = await generated();
    const artifact = parsed(result.artifact.text) as {
      documents: { documentName: string }[];
    };
    const summary = parsed(result.manifest.text).summary as {
      documents: { documentName: string; sha256: string }[];
    };
    expect(summary.documents.map((entry) => entry.documentName)).toEqual(
      artifact.documents.map((document) => document.documentName),
    );
    expect(new Set(summary.documents.map((entry) => entry.sha256)).size).toBe(
      summary.documents.length,
    );
  });

  it('derives the same D14/D15 guard facts the sequenced service would', async () => {
    const artifact = parsed((await generated()).artifact.text) as {
      documents: StoredSnapshot[];
    };
    const guard = deriveParticipationGuard(2026, artifact.documents);
    expect(guard.kind).toBe('valid');
    if (guard.kind === 'valid') {
      expect(guard.guard.classifiedRounds).toEqual([1, 2, 3]);
      expect(guard.guard.facts).toHaveLength(24);
    }
  });

  it('exposes no provider identifier in any document', async () => {
    const artifact = parsed((await generated()).artifact.text) as {
      documents: unknown[];
    };
    expect(JSON.stringify(artifact.documents)).not.toContain('providerId');
  });
});

describe('season-batch generator: determinism', () => {
  it('produces byte-identical files for the same capture', async () => {
    const first = await generated();
    const second = await generated();
    expect(second.artifact.text).toBe(first.artifact.text);
    expect(second.manifest.text).toBe(first.manifest.text);
  });

  it('does not depend on the order responses are recorded or read', async () => {
    const first = await generated();
    const reordered = fixtureCapture();
    reordered.responses.reverse();
    const second = await generated(reordered);
    expect(second.artifact.sha256).toBe(first.artifact.sha256);
    expect(second.manifest.sha256).toBe(first.manifest.sha256);
  });

  it('keeps provenance out of the artifact and in the manifest', async () => {
    const first = await generated();
    const other = await generateSeasonBatch({
      ...inputFor(),
      provenance: { gitCommit: 'b'.repeat(40), treeClean: false },
    });
    expect(other.ok).toBe(true);
    if (!other.ok) return;
    expect(other.artifact.sha256).toBe(first.artifact.sha256);
    expect(other.manifest.sha256).not.toBe(first.manifest.sha256);
  });

  it('writes LF-only text with exactly one trailing newline', async () => {
    const result = await generated();
    for (const text of [result.artifact.text, result.manifest.text]) {
      expect(text).not.toContain('\r');
      expect(text.endsWith('}\n')).toBe(true);
      expect(text.endsWith('\n\n')).toBe(false);
    }
  });
});

describe('season-batch generator: offline by construction', () => {
  it('never calls fetch', async () => {
    const fetch = vi.fn(() => Promise.reject(new Error('network')));
    vi.stubGlobal('fetch', fetch);
    await generated();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('season-batch generator: fails closed', () => {
  it('refuses provenance that does not name a full commit', async () => {
    expect(
      await refusal({
        ...inputFor(),
        provenance: { gitCommit: 'HEAD', treeClean: true },
      }),
    ).toEqual({ failure: 'invalid-provenance', detail: null });
  });

  it.each([
    ['wrong-kind', { kind: 'other' }],
    ['wrong-schema-version', { schemaVersion: 2 }],
    ['unexpected-field', { extra: true }],
    ['invalid-observed-at', { observedAt: '2026-03-16T12:00:00Z' }],
    ['invalid-classification-rounds', { classificationRounds: [2, 1] }],
    ['invalid-season', { season: 26 }],
  ])('refuses a malformed capture manifest (%s)', async (detail, change) => {
    const input = inputFor();
    expect(
      await refusal({ ...input, capture: { ...input.capture, ...change } }),
    ).toEqual({ failure: 'capture-malformed', detail });
  });

  it('refuses a URL outside the season and a repeated URL', async () => {
    const outside = inputFor(
      edited((capture) => {
        capture.responses[0] = {
          ...capture.responses[0]!,
          url: 'https://api.jolpi.ca/ergast/f1/2025/races/?limit=100',
        };
      }),
    );
    expect(await refusal(outside)).toEqual({
      failure: 'capture-malformed',
      detail: 'url-outside-season',
    });

    const repeated = inputFor(
      edited((capture) => {
        capture.responses[1] = {
          ...capture.responses[1]!,
          url: capture.responses[0]!.url,
        };
      }),
    );
    expect(await refusal(repeated)).toEqual({
      failure: 'capture-malformed',
      detail: 'duplicate-url',
    });
  });

  it('refuses a body file that is missing or not named by the manifest', async () => {
    const missing = inputFor();
    missing.bodies.delete('circuits.json');
    expect((await refusal(missing)).failure).toBe('capture-body-missing');

    const extra = inputFor();
    extra.bodies.set('unexpected.json', utf8Text({}));
    expect((await refusal(extra)).failure).toBe('capture-body-unexpected');
  });

  it('refuses a body that does not match its recorded digest or size', async () => {
    const tampered = inputFor();
    const body = tampered.bodies.get('drivers.json')!.slice();
    body[body.length - 2] = body[body.length - 2]! ^ 1;
    tampered.bodies.set('drivers.json', body);
    expect((await refusal(tampered)).failure).toBe('capture-digest-mismatch');
  });

  it('refuses a recorded response that is not a complete 200 answer', async () => {
    const capture = edited((value) => {
      value.responses[1]!.status = 503;
    });
    expect((await refusal(inputFor(capture))).failure).toBe(
      'capture-response-not-ok',
    );
  });

  it('refuses a capture missing a planned response', async () => {
    const capture = edited((value) => {
      value.responses = value.responses.filter(
        (entry) => entry.url !== urls.results(2),
      );
    });
    expect((await refusal(inputFor(capture))).failure).toBe(
      'capture-response-missing',
    );
  });

  it('refuses a capture holding a response the plan never requests', async () => {
    const capture = edited((value) => {
      const round3 = value.responses.find(
        (entry) => entry.url === urls.results(3),
      )!;
      value.responses.push({
        ...round3,
        url: urls.results(4),
        file: 'results-04.json',
      });
    });
    expect((await refusal(inputFor(capture))).failure).toBe(
      'capture-response-unrequested',
    );
  });

  it('refuses a capture missing an eligible round', async () => {
    // Rounds 1-2 only, with standings bound to round 2, at an instant when
    // round 3 is already eligible: internally consistent, but behind.
    const capture = fixtureCapture([1, 2], OBSERVED_AT);
    expect(await refusal(inputFor(capture))).toEqual({
      failure: 'classification-rounds-mismatch',
      detail: null,
    });
  });

  it('refuses a capture holding a round that was not yet eligible', async () => {
    // Round 3's anchor is 2026-03-15T12:00Z; four hours later it is not
    // eligible, so its recorded result predates any result Jolpica could have.
    const capture = fixtureCapture([1, 2, 3], '2026-03-15T16:00:00.000Z');
    expect((await refusal(inputFor(capture))).failure).toBe(
      'classification-rounds-mismatch',
    );
  });

  it('withholds a season whose standings are behind its classifications', async () => {
    const capture = fixtureCapture();
    const behind = fixtureCapture([1, 2]);
    for (const url of [urls.driverStandings, urls.constructorStandings]) {
      const index = capture.responses.findIndex((entry) => entry.url === url);
      capture.responses[index] = behind.responses.find(
        (entry) => entry.url === url,
      )!;
    }
    expect(await refusal(inputFor(capture))).toEqual({
      failure: 'assembly-withheld',
      detail: 'standings-round-incoherent',
    });
  });

  it('withholds a season when a payload fails provider validation', async () => {
    const capture = edited((value) => {
      value.responses[0]!.body = utf8Text({ MRData: {} });
    });
    expect(await refusal(inputFor(capture))).toEqual({
      failure: 'assembly-withheld',
      detail: 'resource-unavailable',
    });
  });

  it('withholds a season when a response is not JSON content', async () => {
    const capture = edited((value) => {
      value.responses[2]!.contentType = 'text/html';
    });
    expect(await refusal(inputFor(capture))).toEqual({
      failure: 'assembly-withheld',
      detail: 'resource-unavailable',
    });
  });

  it('withholds a season with an identity the curated mappings do not resolve', async () => {
    const capture = edited((value) => {
      const entry = value.responses.find(
        (response) => response.url === urls.results(2),
      )!;
      const text = new TextDecoder().decode(entry.body);
      const body = JSON.parse(text) as {
        MRData: {
          RaceTable: {
            Races: { Results: { Driver: { driverId: string } }[] }[];
          };
        };
      };
      body.MRData.RaceTable.Races[0]!.Results[0]!.Driver.driverId =
        'unmapped_driver';
      entry.body = utf8Text(body);
    });
    expect(await refusal(inputFor(capture))).toEqual({
      failure: 'assembly-withheld',
      detail: 'resource-unavailable',
    });
  });

  it('carries the off-calendar jeddah circuit as a circuit, never as an event', async () => {
    // Gap M8: the circuit resource has 24 rows for a 23-race calendar. The
    // 24th is curated as a circuit identity only, so it is published as a
    // circuit and invents no race, round or season entry.
    const artifact = parsed((await generated()).artifact.text) as {
      source: {
        circuits: { id: string }[];
        calendar: { circuitId: string }[];
      };
    };
    const circuitIds = artifact.source.circuits.map((circuit) => circuit.id);

    expect(circuitIds).toHaveLength(24);
    expect(circuitIds).toContain('jeddah-corniche');
    expect(artifact.source.calendar).toHaveLength(23);
    expect(
      artifact.source.calendar.map((event) => event.circuitId),
    ).not.toContain('jeddah-corniche');
  });

  it('still withholds the whole season when an extra circuit row is unmapped', async () => {
    // ADR 0022 D10 is unchanged: curating jeddah resolves that one row, and
    // any other unmapped row still fails the whole circuit resource.
    const capture = edited((value) => {
      const entry = value.responses.find(
        (response) => response.url === urls.circuits,
      )!;
      entry.body = utf8Text(
        circuitsEnvelope([
          ...fullSeasonCircuitRows(),
          circuitRow('synthetic_unmapped_venue'),
        ]),
      );
    });
    expect(await refusal(inputFor(capture))).toEqual({
      failure: 'assembly-withheld',
      detail: 'resource-unavailable',
    });
  });

  it('reports only closed reasons', async () => {
    const results = await Promise.all([
      refusal(inputFor(fixtureCapture([1, 2]))),
      refusal(
        inputFor(
          edited((value) => {
            value.responses[0]!.status = 404;
          }),
        ),
      ),
    ]);
    for (const result of results) {
      expect(seasonBatchFailures).toContain(result.failure);
    }
  });
});
