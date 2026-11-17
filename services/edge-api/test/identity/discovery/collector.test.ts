import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createIdentityObservationCollector,
  inertIdentityObservationCollector,
} from '../../../src/identity/discovery/collector';
import { extractJolpicaObservations } from '../../../src/identity/discovery/extract-jolpica';
import { providerMappingRegistry } from '../../../src/providers/mappings';
import { canonicalJson, utf8 } from '../../../src/ingest/canonical-json';
import {
  context,
  driverInput,
  driversEnvelope,
  forbidNetwork,
} from './support';

beforeEach(forbidNetwork);
afterEach(() => vi.unstubAllGlobals());
async function observation(id = 'synthetic_driver') {
  const body = driversEnvelope([{ driverId: id }]);
  return (
    await extractJolpicaObservations(
      driverInput(body),
      body,
      context,
      providerMappingRegistry(),
    )
  ).observations[0]!;
}
describe('bounded isolated collector', () => {
  it('refuses unsealed input without invoking its properties', () => {
    const getter = vi.fn(() => {
      throw Error('untrusted observation');
    });
    const unsealed = Object.defineProperty({}, 'observationId', {
      get: getter,
    });
    expect(
      createIdentityObservationCollector().collect(unsealed as never),
    ).toBe('invalid');
    expect(getter).not.toHaveBeenCalled();
  });
  it('reports same-ID/different-content conflicts and preserves the original', async () => {
    const body = driversEnvelope([{ driverId: 'synthetic_driver' }]);
    const input = driverInput(body);
    const first = (
      await extractJolpicaObservations(
        input,
        body,
        context,
        providerMappingRegistry(),
      )
    ).observations[0]!;
    const changed = (
      await extractJolpicaObservations(
        input,
        body,
        { ...context, observedAt: '2026-11-14T12:00:00Z' },
        providerMappingRegistry(),
      )
    ).observations[0]!;
    expect(first.observationId).toBe(changed.observationId);
    const c = createIdentityObservationCollector();
    c.collect(first);
    expect(c.collect(changed)).toBe('conflict');
    expect(c.snapshot()).toEqual([first]);
    expect(c.stats().conflicts).toBe(1);
  });
  it('admits exactly the canonical UTF-8 byte boundary', async () => {
    const o = await observation();
    const bytes = utf8(canonicalJson(o)).byteLength;
    const c = createIdentityObservationCollector({ maxBytes: bytes });
    expect(c.collect(o)).toBe('collected');
    expect(c.stats().bytes).toBe(bytes);
    expect(
      createIdentityObservationCollector({ maxBytes: bytes - 1 }).collect(o),
    ).toBe('capacity');
  });
  it.each([0, -1, 1.5, NaN, Infinity])(
    'rejects invalid capacity %s',
    (value) => {
      expect(() =>
        createIdentityObservationCollector({ maxObservations: value }),
      ).toThrow();
      expect(() =>
        createIdentityObservationCollector({ maxBytes: value }),
      ).toThrow();
    },
  );
  it('has a side-effect-free inert default', async () => {
    expect(inertIdentityObservationCollector.collect(await observation())).toBe(
      'disabled',
    );
    expect(inertIdentityObservationCollector.snapshot()).toEqual([]);
  });
  it('deduplicates exact observation IDs before capacity accounting', async () => {
    const o = await observation();
    const c = createIdentityObservationCollector({ maxObservations: 1 });
    expect(c.collect(o)).toBe('collected');
    expect(c.collect(o)).toBe('duplicate');
    expect(c.snapshot()).toEqual([o]);
    expect(c.stats()).toMatchObject({
      collected: 1,
      duplicates: 1,
      dropped: 0,
    });
  });
  it('retains existing evidence and counts count-limit overflow', async () => {
    const c = createIdentityObservationCollector({ maxObservations: 1 });
    const first = await observation();
    c.collect(first);
    expect(c.collect(await observation('synthetic_other'))).toBe('capacity');
    expect(c.snapshot()).toEqual([first]);
    expect(c.stats().dropped).toBe(1);
  });
  it('enforces the byte limit and isolates instances', async () => {
    const o = await observation();
    const c = createIdentityObservationCollector({ maxBytes: 1 });
    expect(c.collect(o)).toBe('capacity');
    expect(createIdentityObservationCollector().snapshot()).toEqual([]);
  });
  it('rejects limits above the accepted per-run baselines', () => {
    expect(() =>
      createIdentityObservationCollector({ maxObservations: 2001 }),
    ).toThrow();
    expect(() =>
      createIdentityObservationCollector({ maxBytes: 2 * 1024 * 1024 + 1 }),
    ).toThrow();
  });
  it('never retains mutable caller references or exposes mutable arrays', async () => {
    const c = createIdentityObservationCollector();
    const o = await observation();
    c.collect(o);
    expect(Object.isFrozen(o)).toBe(true);
    expect(Object.isFrozen(o.key)).toBe(true);
    expect(Object.isFrozen(c.snapshot())).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
});
