/**
 * `PROVIDER_MODE` admission (runtime activation decision O-1): `coordinated`
 * is admitted in staging and production only, and admitting it selects it
 * nowhere but the isolated demonstration Worker (`[env.e2e]`, gate AU-3) and,
 * since gate AU-4, live staging.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import worker from '../../src/index';
import {
  ConfigurationError,
  resolveProviderMode,
  type EnvironmentName,
} from '../../src/config/environment';
import { CapturingLogger } from '../../src/logging/logger';
import {
  demonstrationSection,
  environmentSection,
  withoutAutomatic,
} from './demonstration-environment';

type Admission = 'mock' | 'none' | 'coordinated' | 'error';

const table: readonly [
  string | undefined,
  Record<EnvironmentName, Admission>,
][] = [
  [undefined, { development: 'mock', staging: 'error', production: 'none' }],
  ['mock', { development: 'mock', staging: 'mock', production: 'error' }],
  ['none', { development: 'none', staging: 'none', production: 'none' }],
  [
    'coordinated',
    { development: 'error', staging: 'coordinated', production: 'coordinated' },
  ],
  [
    'Coordinated',
    { development: 'error', staging: 'error', production: 'error' },
  ],
  [
    'coordinated ',
    { development: 'error', staging: 'error', production: 'error' },
  ],
  ['jolpica', { development: 'error', staging: 'error', production: 'error' }],
  ['openf1', { development: 'error', staging: 'error', production: 'error' }],
  ['', { development: 'error', staging: 'error', production: 'error' }],
];

const environments: readonly EnvironmentName[] = [
  'development',
  'staging',
  'production',
];

describe('PROVIDER_MODE admission', () => {
  for (const [value, expected] of table) {
    for (const environment of environments) {
      const outcome = expected[environment];
      it(`${JSON.stringify(value)} in ${environment} -> ${outcome}`, () => {
        if (outcome === 'error') {
          expect(() => resolveProviderMode(value, environment)).toThrow(
            ConfigurationError,
          );
        } else {
          expect(resolveProviderMode(value, environment)).toBe(outcome);
        }
      });
    }
  }

  it('answers an inadmissible mode with the bounded configuration failure, echoing nothing', async () => {
    for (const [ENVIRONMENT, PROVIDER_MODE] of [
      ['development', 'coordinated'],
      ['staging', 'jolpica-live-secret'],
    ] as const) {
      const logger = new CapturingLogger();
      const response = await worker.fetch(
        new Request('https://api.gridview.test/v1/status'),
        { ENVIRONMENT, PROVIDER_MODE, __LOGGER: logger },
      );
      const body = await response.text();

      expect(response.status).toBe(500);
      expect(body).toContain('The service is not correctly configured.');
      expect(body).not.toContain(PROVIDER_MODE);
      expect(logger.serialized()).not.toContain(PROVIDER_MODE);
      expect(logger.events.at(-1)).toMatchObject({
        operation: 'request.failed',
        failureCategory: 'configuration',
      });
    }
  });

  it('is selected by no committed environment but the demonstration Worker and staging', () => {
    const wrangler = readFileSync(
      join(__dirname, '..', '..', 'wrangler.toml'),
      'utf8',
    );
    const modesIn = (toml: string) =>
      [...toml.matchAll(/^PROVIDER_MODE = "([^"]*)"/gm)].map(
        (match) => match[1],
      );
    // Production `none`; development leaves it unset.
    const elsewhere = withoutAutomatic(wrangler);
    expect(modesIn(elsewhere)).toEqual(['none']);
    expect(elsewhere).not.toContain('coordinated');
    // The demonstration Worker (AU-2) selects it, with its controlled source,
    // and staging (AU-4) against the network.
    expect(modesIn(demonstrationSection(wrangler))).toEqual(['coordinated']);
    expect(modesIn(environmentSection(wrangler, 'staging'))).toEqual([
      'coordinated',
    ]);
  });
});
