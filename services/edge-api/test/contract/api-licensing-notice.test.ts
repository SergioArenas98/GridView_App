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

const wrangler = readFileSync(
  join(repoRoot, 'services', 'edge-api', 'wrangler.toml'),
  'utf8',
);

/** The mock provider's content manifest, as the API serves it. */
const mockAttributionVersion = (
  JSON.parse(
    readFileSync(
      join(here, '..', 'fixtures', 'api', 'v1', 'content', 'manifest.json'),
      'utf8',
    ),
  ) as { data: { attributionVersion: string } }
).data.attributionVersion;

/**
 * Every data source GridView has evaluated (Provider Evaluation §6-§7). The
 * notice may name one only while the record credits it.
 */
const knownSourceNames: readonly string[] = [
  'Jolpica',
  'OpenF1',
  'Ergast',
  'Sportmonks',
  'API-Sports',
];

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

  it('credits no source the record does not hold', () => {
    // A licensor may ask to be removed (CC BY-NC-SA 4.0 §3(a)(3)); its entry
    // then leaves the record, and the notice must drop it too.
    const recorded = record.sources.map((source) => source.name.toLowerCase());
    for (const name of knownSourceNames) {
      if (recorded.some((held) => held.includes(name.toLowerCase()))) continue;
      expect(description.toLowerCase()).not.toContain(name.toLowerCase());
    }
  });

  it('states the modification and non-endorsement notices for each source', () => {
    for (const source of record.sources) {
      expect(description).toContain(
        `carries data derived from ${source.name}, GridView has transformed, normalized and combined that data with independently curated material`,
      );
      expect(description).toContain(
        `${source.name} has not reviewed or endorsed GridView`,
      );
    }
  });

  it('states the unofficial notice', () => {
    expect(description).toContain(
      'not associated with, endorsed by or affiliated with Formula 1, the FIA or any team',
    );
  });

  it('disclaims exclusive ownership and keeps service controls apart from the licence', () => {
    // The disclaimer is about licensed provider-derived data, so it is owed
    // while any source is credited; the service-control statement always is.
    if (record.sources.length > 0) {
      expect(description).toContain('claims no exclusive ownership');
      expect(description).toContain(
        'imposes no restriction on any use the licence permits',
      );
    }
    expect(description).toContain(
      'they do not restrict the licence that applies to the data',
    );
  });

  it("states each source's status as the record does", () => {
    for (const source of record.sources) {
      if (source.status === 'dormant') {
        expect(description).toContain(
          `No GridView runtime retrieves data from ${source.name} yet`,
        );
        continue;
      }
      // `active` (O-9, DP-7): published through operator-run batches only,
      // never retrieved by a Worker.
      expect(source.status).toBe('active');
      expect(description).toContain(
        `No GridView Worker retrieves data from ${source.name} automatically`,
      );
      expect(description).toContain(
        `${source.name}-derived data reaches this service only as an operator-run batch`,
      );
      expect(description).toContain(
        'Production accepts no batch and serves no provider data',
      );
      expect(description).toContain('can lag behind');
    }
  });

  it('credits Jolpica F1 as active, so the batch wording above is exercised', () => {
    expect(
      record.sources.find((source) => source.name === 'Jolpica F1')?.status,
    ).toBe('active');
  });

  it('tells a reader which releases carry provider-derived data', () => {
    // Before the first batch staging serves the mock dataset under an active
    // record; the per-release attribution version is what makes the notice
    // true in that window as well as after it.
    expect(description).toContain(
      '`GET /v1/content/manifest`, `attributionVersion`',
    );
    expect(description).toContain(`\`${record.version}\` or later`);
    expect(description).toContain(
      'A release with any other value contains no Jolpica F1-derived data',
    );
    expect(description).toContain(
      "GridView's mock dataset carries `1`, and staging serves it until a first batch is published",
    );
    expect(mockAttributionVersion).toBe('1');
  });

  it('never claims that GridView retrieves provider data itself', () => {
    expect(description).not.toMatch(
      /\bGridView (retrieves|fetches|polls|downloads|synchroni[sz]es)\b/i,
    );
    expect(description).not.toMatch(/\b(live|real-time) (provider )?data\b/i);
  });

  it('keeps "not automatically" true: no committed environment selects coordinated mode', () => {
    // The coordinated runtime is the only Worker path that could request
    // Jolpica F1. While any source is active the notice and the app say no
    // Worker retrieves it, so selecting that mode needs new wording first.
    if (!record.sources.some((source) => source.status === 'active')) return;
    const modes = [
      ...wrangler.matchAll(/^\s*PROVIDER_MODE\s*=\s*["']([^"']*)["']/gm),
    ].map((match) => match[1]);
    expect(modes.length).toBeGreaterThan(0);
    expect(modes).not.toContain('coordinated');
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
