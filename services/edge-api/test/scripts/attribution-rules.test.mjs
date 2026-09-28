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
    expect(shipped.version).toBe('data-sources-v1');
    expect(validateAttributionDocument(shipped)).toEqual([]);
  });

  it('credits Jolpica F1, dormant, under CC BY-NC-SA 4.0', () => {
    expect(shipped.sources).toHaveLength(1);
    expect(shipped.sources[0]).toMatchObject({
      sourceId: 'jolpica',
      name: 'Jolpica F1',
      sourceUrl: 'https://github.com/jolpica/jolpica-f1',
      licenseName: 'CC BY-NC-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
      status: 'dormant',
    });
  });
});

describe('attribution versions', () => {
  it('refuses changed content under an issued version', () => {
    for (const changes of [
      { status: 'active' },
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
    const next = { ...withFirstSource({ status: 'active' }) };
    next.version = 'data-sources-v2';
    const [problem] = validateAttributionDocument(next);
    expect(problem).toContain('has not been issued');
    expect(problem).toContain(attributionContentDigest(next));
  });

  it('accepts new content once its version is issued', () => {
    const next = { ...withFirstSource({ status: 'active' }) };
    next.version = 'data-sources-v2';
    const issued = {
      ...ISSUED_ATTRIBUTION_VERSIONS,
      'data-sources-v2': attributionContentDigest(next),
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
