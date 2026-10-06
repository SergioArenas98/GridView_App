/**
 * `resolveReconciliationLedger` reads the optional `RECONCILIATION_LEDGER`
 * Durable Object binding and fails closed: anything but a namespace answers
 * `null`, and resolving a namespace performs no lookup.
 */

import { describe, expect, it, vi } from 'vitest';

import type { Env } from '../../../../src/config/environment';
import {
  DurableObjectReconciliationLedger,
  ledgerClientFor,
} from '../../../../src/sync/coordinated/ledger';
import { resolveReconciliationLedger } from '../../../../src/sync/coordinated/ledger-port';

const asBinding = (value: unknown): Env['RECONCILIATION_LEDGER'] =>
  value as Env['RECONCILIATION_LEDGER'];

describe('resolveReconciliationLedger', () => {
  it('answers null without the binding, as in development and production', () => {
    expect(resolveReconciliationLedger({})).toBeNull();
    expect(
      resolveReconciliationLedger({ RECONCILIATION_LEDGER: undefined }),
    ).toBeNull();
  });

  /** Values under the binding's name that are not a namespace. */
  const notNamespaces: readonly (readonly [string, unknown])[] = [
    ['null', null],
    ['a string variable', 'reconciliation'],
    ['a number', 0],
    ['a boolean', true],
    ['a function', () => ({})],
    ['an empty object', {}],
    ['a KV namespace', { get: () => null, put: () => undefined }],
    ['a namespace without idFromName', { get: () => ({}) }],
    ['a namespace without get', { idFromName: (name: string) => name }],
    [
      'a namespace whose members are not functions',
      { idFromName: 'reconciliation', get: 'stub' },
    ],
  ];

  it.each(notNamespaces)('answers null for %s', (_label, value) => {
    expect(
      resolveReconciliationLedger({ RECONCILIATION_LEDGER: asBinding(value) }),
    ).toBeNull();
    expect(ledgerClientFor(value)).toBeNull();
  });

  it('answers the Durable Object client for a namespace, without looking anything up', () => {
    const idFromName = vi.fn((name: string) => name);
    const get = vi.fn();

    const ledger = resolveReconciliationLedger({
      RECONCILIATION_LEDGER: asBinding({ idFromName, get }),
    });

    expect(ledger).toBeInstanceOf(DurableObjectReconciliationLedger);
    expect(ledger?.ledger).toBe('reconciliation');
    expect(idFromName).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });

  it('accepts a namespace whose methods are inherited, as a runtime binding is', () => {
    class Namespace {
      idFromName(name: string): string {
        return name;
      }
      get(): never {
        throw new Error('not reached');
      }
    }

    expect(
      resolveReconciliationLedger({
        RECONCILIATION_LEDGER: asBinding(new Namespace()),
      }),
    ).toBeInstanceOf(DurableObjectReconciliationLedger);
  });

  it('answers a fresh client per resolution, as a fresh isolate would build', () => {
    const env = {
      RECONCILIATION_LEDGER: asBinding({
        idFromName: (name: string) => name,
        get: () => ({}),
      }),
    };

    expect(resolveReconciliationLedger(env)).not.toBe(
      resolveReconciliationLedger(env),
    );
  });
});
