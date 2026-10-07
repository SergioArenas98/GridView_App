import { describe, expect, it } from 'vitest';

import {
  CanonicalJsonError,
  canonicalJson,
} from '../../scripts/season-batch/canonical-json';
import {
  decodeCaptureManifest,
  maximumCapturedResponses,
} from '../../scripts/season-batch/capture';
import { generateSeasonBatch } from '../../scripts/season-batch/generate';
import { replayTransport } from '../../scripts/season-batch/replay';
import { captureFiles, fixtureCapture, inputFor } from './support';

const URL_A = 'https://api.jolpi.ca/ergast/f1/2026/races/?limit=100';
const URL_B = 'https://api.jolpi.ca/ergast/f1/2026/circuits/?limit=100';

function recording(url: string) {
  return {
    url,
    status: 200,
    contentType: 'application/json',
    body: new TextEncoder().encode('{}'),
  };
}

describe('replay transport', () => {
  it('answers each recording once and counts every misuse', async () => {
    const replay = replayTransport([recording(URL_A), recording(URL_B)]);
    const first = await replay.transport(new Request(URL_A));
    expect(first.status).toBe(200);
    expect(await first.text()).toBe('{}');
    await expect(replay.transport(new Request(URL_A))).rejects.toThrow();
    await expect(
      replay.transport(
        new Request('https://api.jolpi.ca/ergast/f1/2026/drivers/'),
      ),
    ).rejects.toThrow();
    await expect(
      replay.transport(new Request(URL_A, { method: 'POST', body: '{}' })),
    ).rejects.toThrow();
    expect(replay.usage()).toEqual({
      served: 1,
      unrecorded: 1,
      repeated: 1,
      unexpectedMethod: 1,
      unrequested: 1,
    });
  });

  it('refuses two recordings for one URL', () => {
    expect(() =>
      replayTransport([recording(URL_A), recording(URL_A)]),
    ).toThrow();
  });
});

describe('capture manifest decoding', () => {
  const valid = () => captureFiles(fixtureCapture()).manifest;

  it('accepts the fixture manifest', () => {
    expect(decodeCaptureManifest(valid()).ok).toBe(true);
  });

  it.each([
    ['not-an-object', () => []],
    ['invalid-responses', () => ({ ...valid(), responses: [] })],
    [
      'too-many-responses',
      () => ({
        ...valid(),
        responses: Array.from(
          { length: maximumCapturedResponses + 1 },
          () => (valid().responses as unknown[])[0],
        ),
      }),
    ],
    [
      'invalid-response-entry',
      () => {
        const manifest = valid();
        const responses = manifest.responses as Record<string, unknown>[];
        responses[0] = { ...responses[0], file: '../calendar.json' };
        return manifest;
      },
    ],
    [
      'invalid-response-entry',
      () => {
        const manifest = valid();
        const responses = manifest.responses as Record<string, unknown>[];
        responses[0] = { ...responses[0], sha256: 'ABC' };
        return manifest;
      },
    ],
    [
      'duplicate-file',
      () => {
        const manifest = valid();
        const responses = manifest.responses as Record<string, unknown>[];
        responses[1] = { ...responses[1], file: responses[0]!.file };
        return manifest;
      },
    ],
  ])('refuses %s', (reason, build) => {
    expect(decodeCaptureManifest(build())).toEqual({ ok: false, reason });
  });
});

describe('season-batch generator: curated metadata gate', () => {
  it('refuses a season with no curated season record', async () => {
    const capture = fixtureCapture();
    capture.season = 2025;
    capture.responses = capture.responses.map((entry) => ({
      ...entry,
      url: entry.url.replace('/f1/2026/', '/f1/2025/'),
    }));
    const result = await generateSeasonBatch(inputFor(capture));
    expect(result).toEqual({
      ok: false,
      failure: 'metadata-unavailable',
      detail: null,
    });
  });
});

describe('canonical JSON', () => {
  it('sorts keys by UTF-8 byte order and ends with one newline', () => {
    expect(canonicalJson({ b: 1, a: [true, null], é: 'x', Z: {} })).toBe(
      '{\n  "Z": {},\n  "a": [\n    true,\n    null\n  ],\n  "b": 1,\n  "é": "x"\n}\n',
    );
  });

  it('omits undefined members and writes -0 as 0', () => {
    expect(canonicalJson({ a: undefined, b: -0 })).toBe('{\n  "b": 0\n}\n');
  });

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['undefined in an array', [undefined]],
    ['a bigint', 1n],
    ['a function', () => 1],
    ['a Date', new Date(0)],
    ['a Map', new Map()],
  ])('refuses %s', (_label, value) => {
    expect(() => canonicalJson({ value })).toThrow(CanonicalJsonError);
  });
});
