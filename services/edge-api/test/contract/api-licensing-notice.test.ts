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

import { quotaPolicyFor } from '../../src/providers/provider-source';

import {
  demonstrationSection,
  environmentSection,
  withoutDemonstration,
} from '../config/demonstration-environment';

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

/** The `PROVIDER_MODE` values a TOML fragment assigns, comments excluded. */
const modesIn = (toml: string) =>
  [...toml.matchAll(/^\s*PROVIDER_MODE\s*=\s*["']([^"']*)["']/gm)].map(
    (match) => match[1],
  );

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
      switch (source.status) {
        case 'dormant':
          expect(description).toContain(
            `No GridView runtime retrieves data from ${source.name} yet`,
          );
          break;
        case 'active':
          // O-9, DP-7 (2026-10-13): operator-run batches only, never
          // retrieved by a Worker. Superseded for Jolpica F1 by `automatic`.
          expect(description).toContain(
            `No GridView Worker retrieves data from ${source.name} automatically`,
          );
          expect(description).toContain(
            `${source.name}-derived data reaches this service only as an operator-run batch`,
          );
          expect(description).toContain('can lag behind');
          break;
        case 'automatic':
          // Owner decision 2026-11-03 (gate AU-4): a Worker requests the
          // source itself on a schedule, and a batch is still possible. The
          // wording must hold for either path, wherever it is enabled.
          expect(description).toContain(
            `Where automatic updates are enabled, a GridView Worker requests data from ${source.name} itself, without an operator`,
          );
          expect(description).toContain(
            'An hourly schedule decides what is due',
          );
          expect(description).toContain(
            `enforces ${source.name}'s published rate limits as GridView recorded them (4 requests a second, 500 an hour)`,
          );
          expect(description).toContain(
            'published only if it passes verification and the publication guard',
          );
          expect(description).toContain(
            `Where automatic updates are not enabled, ${source.name}-derived data reaches this service only as an operator-run batch`,
          );
          expect(description).toContain('Neither path updates in real time');
          expect(description).toContain('can lag behind');
          expect(description).toContain('a published result can be corrected');
          break;
        default:
          throw new Error(`unknown status ${source.status}`);
      }
    }
  });

  it('cites the Jolpica F1 limits the limiter enforces', () => {
    // The notice names the published limits GridView recorded; the limiter
    // must enforce exactly those, so the sentence stays true.
    expect(
      quotaPolicyFor('jolpica').windows.map(({ window, limit }) => ({
        window,
        limit,
      })),
    ).toEqual([
      { window: 'second', limit: 4 },
      { window: 'hour', limit: 500 },
    ]);
  });

  it('credits Jolpica F1 as automatic, so the automatic wording above is exercised', () => {
    expect(
      record.sources.find((source) => source.name === 'Jolpica F1')?.status,
    ).toBe('automatic');
  });

  it('tells a reader which releases carry provider-derived data', () => {
    // A release carries Jolpica F1-derived data only when its manifest names
    // an attribution version that credits it; the per-release version is what
    // keeps the notice true before an environment's first publication.
    expect(description).toContain(
      '`GET /v1/content/manifest`, `attributionVersion`',
    );
    expect(description).toContain('`data-sources-v2` or later');
    expect(description).toContain(
      'A release with any other value contains no Jolpica F1-derived data',
    );
    expect(description).toContain("GridView's mock dataset carries `1`");
    expect(mockAttributionVersion).toBe('1');
  });

  it('never claims live provider data, and claims retrieval only while a source is automatic', () => {
    expect(description).not.toMatch(/\b(live|real-time) (provider )?data\b/i);
    const retrieves =
      /\bGridView (Worker )?(retrieves|fetches|polls|downloads|synchroni[sz]es|requests)\b/i;
    if (record.sources.some((source) => source.status === 'automatic')) {
      expect(description).toMatch(retrieves);
    } else {
      expect(description).not.toMatch(retrieves);
    }
  });

  it('keeps the record true to the committed configuration: a source is automatic exactly when an environment other than the demonstration Worker selects coordinated mode against the network', () => {
    // The coordinated runtime is the only Worker path that requests Jolpica
    // F1. The notice and the app may say a Worker retrieves it only if a
    // committed environment does, and must say so once one does. The
    // demonstration Worker (gate AU-3) is not such an environment: its
    // Jolpica transport reads controlled documents from its own KV
    // namespace, never the network.
    const elsewhere = withoutDemonstration(wrangler);
    expect(modesIn(elsewhere).length).toBeGreaterThan(0);
    expect(elsewhere).not.toMatch(/^\s*CONTROLLED_PROVIDER_SOURCE\s*=/m);
    const automatic = record.sources.some(
      (source) => source.status === 'automatic',
    );
    expect(modesIn(elsewhere).includes('coordinated')).toBe(automatic);
    const demonstration = demonstrationSection(wrangler);
    expect(modesIn(demonstration)).toEqual(['coordinated']);
    expect(demonstration).toMatch(/^CONTROLLED_PROVIDER_SOURCE = "kv"$/m);
  });

  it('keeps production off the automatic path until its own gate (AU-7)', () => {
    // The notice covers an environment without automatic updates; production
    // is one until AU-7 commits its own coordinated configuration.
    expect(modesIn(environmentSection(wrangler, 'production'))).toEqual([
      'none',
    ]);
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
