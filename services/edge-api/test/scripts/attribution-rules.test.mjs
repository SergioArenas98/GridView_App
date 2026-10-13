/**
 * The content-validation rules for the data-source attribution record
 * (ADR 0019 decision 5): each licensor appears once, and an attribution version
 * always identifies the same content. They run inside
 * `npm run validate:content`.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  ISSUED_ATTRIBUTION_VERSIONS,
  attributionContentDigest,
  validateAttributionDocument,
} from '../../scripts/lib/attribution-rules.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..', '..');
const shipped = JSON.parse(
  readFileSync(
    join(repoRoot, 'content', 'attribution', 'data-sources.json'),
    'utf8',
  ),
);

const withFirstSource = (changes) => ({
  ...shipped,
  sources: [{ ...shipped.sources[0], ...changes }, ...shipped.sources.slice(1)],
});

describe('the shipped attribution record', () => {
  it('satisfies every rule at its issued version', () => {
    expect(shipped.version).toBe('data-sources-v2');
    expect(validateAttributionDocument(shipped)).toEqual([]);
  });

  // O-9 / DP-7: the only change from data-sources-v1 is the status.
  it('credits Jolpica F1, active, under CC BY-NC-SA 4.0', () => {
    expect(shipped.sources).toHaveLength(1);
    expect(shipped.sources[0]).toMatchObject({
      sourceId: 'jolpica',
      name: 'Jolpica F1',
      sourceUrl: 'https://github.com/jolpica/jolpica-f1',
      licenseName: 'CC BY-NC-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
      status: 'active',
    });
  });

  it('differs from data-sources-v1 in the status alone', () => {
    // v1 stays issued, unchanged: it still names the dormant record.
    const v1 = { ...withFirstSource({ status: 'dormant' }) };
    v1.version = 'data-sources-v1';
    expect(ISSUED_ATTRIBUTION_VERSIONS['data-sources-v1']).toBe(
      'cda4922b7de59cc86ebdb1f23994429c0c3b6cd8eac3971c3f8e140cb61c8621',
    );
    expect(validateAttributionDocument(v1)).toEqual([]);
  });
});

describe('attribution versions', () => {
  it('refuses changed content under an issued version', () => {
    for (const changes of [
      { status: 'dormant' },
      { licenseUrl: 'https://example.org/licence' },
      { copyrightNotice: '(c) Example' },
    ]) {
      const problems = validateAttributionDocument(withFirstSource(changes));
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain('identifies different content');
    }
  });

  it('refuses removing a source under an issued version', () => {
    const problems = validateAttributionDocument({ ...shipped, sources: [] });
    expect(problems[0]).toContain('identifies different content');
  });

  it('refuses a version that was never issued, naming the digest to pin', () => {
    const next = { ...withFirstSource({ status: 'dormant' }) };
    next.version = 'data-sources-v3';
    const [problem] = validateAttributionDocument(next);
    expect(problem).toContain('has not been issued');
    expect(problem).toContain(attributionContentDigest(next));
  });

  it('accepts new content once its version is issued', () => {
    const next = { ...withFirstSource({ copyrightNotice: '(c) Example' }) };
    next.version = 'data-sources-v3';
    const issued = {
      ...ISSUED_ATTRIBUTION_VERSIONS,
      'data-sources-v3': attributionContentDigest(next),
    };
    expect(validateAttributionDocument(next, issued)).toEqual([]);
  });

  it('ignores key order but not source order', () => {
    const reordered = {
      ...shipped,
      sources: shipped.sources.map((source) =>
        Object.fromEntries(Object.entries(source).reverse()),
      ),
    };
    expect(attributionContentDigest(reordered)).toBe(
      attributionContentDigest(shipped),
    );
    const two = {
      ...shipped,
      sources: [
        shipped.sources[0],
        { ...shipped.sources[0], sourceId: 'other', name: 'Other' },
      ],
    };
    const swapped = { ...two, sources: [...two.sources].reverse() };
    expect(attributionContentDigest(swapped)).not.toBe(
      attributionContentDigest(two),
    );
  });

  it('never lets an issued version be inherited from the prototype', () => {
    const [problem] = validateAttributionDocument({
      ...shipped,
      version: 'constructor',
    });
    expect(problem).toContain('has not been issued');
  });
});

describe('per-source uniqueness', () => {
  it('refuses a licensor credited twice', () => {
    const duplicated = {
      ...shipped,
      sources: [
        shipped.sources[0],
        { ...shipped.sources[0], name: 'JOLPICA F1 ' },
      ],
    };
    const problems = validateAttributionDocument(duplicated);
    expect(problems).toContain('sources[1]: duplicate sourceId "jolpica"');
    expect(problems).toContain(
      'sources[1]: duplicate source name "JOLPICA F1 "',
    );
  });
});
