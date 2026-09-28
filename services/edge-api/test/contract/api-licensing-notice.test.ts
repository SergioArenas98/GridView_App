/**
 * The public API documentation's licence notice (ADR 0019 decision 5;
 * GridView_Provider_Evaluation.md §7.6.2 and §7.6.4).
 *
 * The contract must carry attribution equivalent to the app's, taken from the
 * same repository record, and must not drift back to wording that claims
 * exclusive ownership of provider-derived data or labels the whole API with a
 * single licence.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..', '..');

interface OpenApiInfo {
  readonly description: string;
  readonly license: { readonly name: string; readonly url?: string };
}

interface AttributionSource {
  readonly name: string;
  readonly sourceUrl: string;
  readonly licenseName: string;
  readonly licenseTitle: string;
  readonly licenseUrl: string;
  readonly status: string;
}

const info = (
  yaml.load(
    readFileSync(join(repoRoot, 'docs', 'api', 'gridview-api-v1.yaml'), 'utf8'),
  ) as { info: OpenApiInfo }
).info;

const record = JSON.parse(
  readFileSync(
    join(repoRoot, 'content', 'attribution', 'data-sources.json'),
    'utf8',
  ),
) as { version: string; sources: readonly AttributionSource[] };

/** The description with line breaks folded, so phrases can span lines. */
const description = info.description.replace(/\s+/g, ' ');

describe('the API documentation licence notice', () => {
  it('credits every recorded source with its link and licence', () => {
    for (const source of record.sources) {
      expect(description).toContain(source.name);
      expect(description).toContain(source.sourceUrl);
      expect(description).toContain(source.licenseName);
      expect(description).toContain(source.licenseTitle);
      expect(description).toContain(source.licenseUrl);
    }
  });

  it('names the attribution version it documents', () => {
    expect(description).toContain(record.version);
  });

  it('states the modification, non-endorsement and unofficial notices', () => {
    expect(description).toContain(
      'transformed, normalized and combined that data with independently curated material',
    );
    expect(description).toContain('has not reviewed or endorsed GridView');
    expect(description).toContain(
      'not associated with, endorsed by or affiliated with Formula 1, the FIA or any team',
    );
  });

  it('disclaims exclusive ownership and keeps service controls apart from the licence', () => {
    expect(description).toContain('claims no exclusive ownership');
    expect(description).toContain(
      'imposes no restriction on any use the licence permits',
    );
    expect(description).toContain(
      'they do not restrict the licence that applies to the data',
    );
  });

  it('does not claim provider data is served while every source is dormant', () => {
    if (record.sources.every((source) => source.status === 'dormant')) {
      expect(description).toContain(
        'No GridView runtime retrieves data from Jolpica F1 yet',
      );
    }
  });

  it('never reverts to blanket ownership or a single blanket licence', () => {
    for (const phrase of [
      /GridView-owned (snapshots|data)/i,
      /\bproprietary\b/i,
      /all rights reserved/i,
      /owned by GridView/i,
    ]) {
      expect(description).not.toMatch(phrase);
      expect(info.license.name).not.toMatch(phrase);
    }
    // One licence label would either claim the data or license GridView's own
    // work under the data licence; the notice is per material instead.
    expect(info.license.name).toContain('Data sources and licensing');
    expect(info.license.url).toBeUndefined();
  });
});
