/**
 * U9 operational gate: `IDENTITY_INVENTORY_MODE=optional-drivers` is closed
 * vocabulary but unavailable before U10. A Worker configured with it refuses
 * the coordinated run as a bounded configuration failure, before any lease,
 * provider request, preparation or storage write. Strict, explicit or absent,
 * keeps the existing behaviour.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ReconciliationLedgerPort } from '../../../../src/sync/coordinated/ledger-port';
import { PRE_SEASON } from '../observation/support';
import { EntryPointHarness, type LedgerBinding } from './support';

const injected = vi.hoisted(() => ({ ledger: null as LedgerBinding }));
vi.mock(
  '../../../../src/sync/coordinated/ledger-port',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('../../../../src/sync/coordinated/ledger-port')
      >();
    return {
      ...actual,
      resolveReconciliationLedger: (): ReconciliationLedgerPort | null =>
        injected.ledger?.() ?? null,
    };
  },
);
const bind = (binding: LedgerBinding) => {
  injected.ledger = binding;
};

beforeEach(() => {
  injected.ledger = null;
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('U9 network forbidden');
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('U9 inventory mode cannot be enabled operationally before U10', () => {
  it('refuses optional-drivers before any provider request or publication', async () => {
    const harness = await EntryPointHarness.create('local', bind, {
      env: { IDENTITY_INVENTORY_MODE: 'optional-drivers' },
    });
    const answer = await harness.manual(PRE_SEASON);
    expect(answer.status).toBe(500);
    expect(answer.requests).toEqual([]);
    expect(answer.reservations).toBe(0);
    expect([answer.prepares, answer.finalizes, answer.storageWrites]).toEqual([
      0, 0, 0,
    ]);
    expect(answer.logs).toContainEqual(
      expect.objectContaining({ failureCategory: 'configuration' }),
    );
    expect(JSON.stringify(answer.logs)).not.toContain('optional-drivers');
  });

  it('refuses an unknown inventory value the same way', async () => {
    const harness = await EntryPointHarness.create('local', bind, {
      env: { IDENTITY_INVENTORY_MODE: 'permissive' },
    });
    const answer = await harness.manual(PRE_SEASON);
    expect(answer.status).toBe(500);
    expect(answer.requests).toEqual([]);
  });

  it('keeps explicit strict identical to the default', async () => {
    const strict = await EntryPointHarness.create('local', bind, {
      env: { IDENTITY_INVENTORY_MODE: 'strict' },
    });
    const unset = await EntryPointHarness.create('local', bind);
    const explicit = await strict.manual(PRE_SEASON);
    const absent = await unset.manual(PRE_SEASON);
    expect(explicit.status).toBe(absent.status);
    expect(explicit.requests).toEqual(absent.requests);
    expect(explicit.body.data).toEqual(absent.body.data);
  });
});

/**
 * U10 replaced U9's blanket refusal: `optional-drivers` is accepted only with
 * runtime catalog authority, a UUID installation and a catalog binding. Every
 * incomplete runtime configuration is still the same bounded configuration
 * refusal before any lease, limiter reservation or provider request. (The
 * complete runtime path is exercised against a real SQLite catalog in
 * `test/identity/integration/optional-inventory.test.mjs`.)
 */
describe('U10 optional inventory needs a complete runtime catalog authority', () => {
  it.each([
    [
      'runtime without installation or binding',
      { IDENTITY_CATALOG_MODE: 'runtime' },
    ],
    [
      'runtime with an installation but no binding',
      {
        IDENTITY_CATALOG_MODE: 'runtime',
        IDENTITY_INSTALLATION_ID: '44444444-4444-4444-8444-444444444444',
      },
    ],
    ['compare', { IDENTITY_CATALOG_MODE: 'compare' }],
  ])('refuses %s before any provider request', async (_, env) => {
    const harness = await EntryPointHarness.create('local', bind, {
      env: { ...env, IDENTITY_INVENTORY_MODE: 'optional-drivers' },
    });
    const answer = await harness.manual(PRE_SEASON);
    expect(answer.status).toBe(500);
    expect(answer.requests).toEqual([]);
    expect(answer.reservations).toBe(0);
    expect([answer.prepares, answer.finalizes, answer.storageWrites]).toEqual([
      0, 0, 0,
    ]);
  });
});
