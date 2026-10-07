/**
 * No captured provider response, season batch, converted fixture, frozen
 * dataset descriptor or APK may enter the tracked repository.
 *
 * `git ls-files` lists the index, so a file only staged for commit is caught
 * too. The rules are pure and are also run against simulated listings, which
 * are the negative controls.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
);

/** The committed sample fixtures, hand-written mock data, and nothing else. */
const sampleFixtures = [
  'assets/dev_fixtures/grand-prix-2026-12.json',
  'assets/dev_fixtures/grand-prix-2026-13.json',
  'assets/dev_fixtures/home.json',
];

const privateKinds =
  /"kind"\s*:\s*"gridview-(?:jolpica-capture|season-batch|season-batch-manifest|frozen-dataset|frozen-apk-build)"/;
/** A Jolpica (Ergast-format) response body. */
const providerBody = /"MRData"\s*:/;
/** The fixed request id every converted envelope carries. */
const convertedEnvelope = /"requestId"\s*:\s*"frozen-/;

export function trackedDataViolations(
  paths: readonly string[],
  read: (path: string) => string,
): string[] {
  const violations: string[] = [];
  for (const path of paths) {
    const name = path.slice(path.lastIndexOf('/') + 1);
    if (/\.(?:apk|aab)$/i.test(name)) violations.push(`${path}: package`);
    if (name === 'frozen-dataset.json' || name === 'build-record.json') {
      violations.push(`${path}: frozen build output`);
    }
    if (
      path.startsWith('assets/dev_fixtures/') &&
      !sampleFixtures.includes(path)
    ) {
      violations.push(`${path}: not a committed sample fixture`);
    }
    if (!name.endsWith('.json')) continue;
    const text = read(path);
    if (privateKinds.test(text)) violations.push(`${path}: private batch kind`);
    if (providerBody.test(text)) violations.push(`${path}: provider response`);
    if (convertedEnvelope.test(text)) {
      violations.push(`${path}: converted envelope`);
    }
  }
  return violations;
}

function trackedFiles(): string[] {
  const result = spawnSync('git', ['ls-files', '-z'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error('git ls-files failed');
  return result.stdout.split('\0').filter((path) => path.length > 0);
}

function readTracked(path: string): string {
  try {
    return readFileSync(join(repositoryRoot, path), 'utf8');
  } catch {
    // Staged for deletion, or not checked out: nothing to inspect.
    return '';
  }
}

describe('tracked repository: no real or converted data', () => {
  it('tracks only the committed sample fixtures and no private data', () => {
    const tracked = trackedFiles();
    expect(tracked).toEqual(expect.arrayContaining(sampleFixtures));
    expect(trackedDataViolations(tracked, readTracked)).toEqual([]);
  });

  describe('negative controls', () => {
    const files: Record<string, string> = {
      'assets/dev_fixtures/home.json':
        '{"data":{},"meta":{"requestId":"req-mock-0001"}}',
      'assets/dev_fixtures/calendar-2026.json':
        '{"data":[],"meta":{"requestId":"frozen-0123456789abcdef"}}',
      'assets/dev_fixtures/frozen-dataset.json':
        '{"kind": "gridview-frozen-dataset"}',
      'private/capture.json': '{"kind": "gridview-jolpica-capture"}',
      'private/races.json': '{"MRData": {"RaceTable": {}}}',
      'private/manifest.json': '{"kind":"gridview-season-batch-manifest"}',
      'docs/notes.json': '{"requestId": "frozen-abc"}',
      'out/gridview-staging-frozen.apk': '',
    };
    const read = (path: string): string => files[path] ?? '';

    it('passes the committed sample fixture', () => {
      expect(
        trackedDataViolations(['assets/dev_fixtures/home.json'], read),
      ).toEqual([]);
    });

    it.each([
      [
        'assets/dev_fixtures/calendar-2026.json',
        [
          'assets/dev_fixtures/calendar-2026.json: not a committed sample fixture',
          'assets/dev_fixtures/calendar-2026.json: converted envelope',
        ],
      ],
      [
        'assets/dev_fixtures/frozen-dataset.json',
        [
          'assets/dev_fixtures/frozen-dataset.json: frozen build output',
          'assets/dev_fixtures/frozen-dataset.json: not a committed sample fixture',
          'assets/dev_fixtures/frozen-dataset.json: private batch kind',
        ],
      ],
      ['private/capture.json', ['private/capture.json: private batch kind']],
      ['private/races.json', ['private/races.json: provider response']],
      ['private/manifest.json', ['private/manifest.json: private batch kind']],
      ['docs/notes.json', ['docs/notes.json: converted envelope']],
      [
        'out/gridview-staging-frozen.apk',
        ['out/gridview-staging-frozen.apk: package'],
      ],
    ])('flags %s', (path, expected) => {
      expect(trackedDataViolations([path], read)).toEqual(expected);
    });
  });
});
