import { describe, expect, it } from 'vitest';

import {
  ConfigurationError,
  resolveJolpicaTransport,
  type Env,
} from '../../src/config/environment';

const proxy: Env = {
  JOLPICA_TRANSPORT: 'proxy',
  JOLPICA_PROXY_ORIGIN: 'https://egress.example.test',
  JOLPICA_PROXY_TOKEN: 'disposable-proxy-test-token',
};

describe('optional Jolpica transport configuration', () => {
  it('defaults to direct with no settings or secrets and ignores leftovers when disabled', () => {
    expect(resolveJolpicaTransport({})).toEqual({ mode: 'direct' });
    expect(
      resolveJolpicaTransport({ ...proxy, JOLPICA_TRANSPORT: 'direct' }),
    ).toEqual({ mode: 'direct' });
    expect(
      resolveJolpicaTransport({
        JOLPICA_PROXY_ORIGIN: 'invalid',
        JOLPICA_PROXY_TOKEN: '\n',
      }),
    ).toEqual({ mode: 'direct' });
  });

  it.each(['', 'Proxy', 'proxi', ' direct '])(
    'rejects an unknown mode %j',
    (mode) => {
      expect(() =>
        resolveJolpicaTransport({ ...proxy, JOLPICA_TRANSPORT: mode }),
      ).toThrow(ConfigurationError);
    },
  );

  it.each(['https://egress.example.test', 'https://egress.example.test/'])(
    'accepts a separate HTTPS origin %s',
    (origin) => {
      expect(
        resolveJolpicaTransport({ ...proxy, JOLPICA_PROXY_ORIGIN: origin }),
      ).toEqual({
        mode: 'proxy',
        origin: 'https://egress.example.test',
        token: proxy.JOLPICA_PROXY_TOKEN,
      });
    },
  );

  it.each([
    undefined,
    '',
    'not-a-url',
    'http://egress.example.test',
    'https://user:secret@egress.example.test',
    'https://egress.example.test/path',
    'https://egress.example.test?token=secret',
    'https://egress.example.test#secret',
    'https://egress.example.test?',
    'https://egress.example.test#',
    'https://egress.example.test:8443',
    ' https://egress.example.test',
    'https://egress.example.test/../',
    'https:\\egress.example.test',
    'https://api.jolpi.ca',
    'https://api.jolpi.ca/',
    'https://jolpi.ca',
    'https://api.jolpi.ca.',
  ])(
    'rejects an invalid or provider origin %j without echoing it',
    (origin) => {
      const resolve = () =>
        resolveJolpicaTransport({ ...proxy, JOLPICA_PROXY_ORIGIN: origin });
      expect(resolve).toThrow(ConfigurationError);
      expect(resolve).toThrow(/^JOLPICA_PROXY_ORIGIN must be/);
      try {
        resolve();
      } catch (error) {
        expect(String(error)).not.toContain('secret');
        expect(String(error)).not.toContain(proxy.JOLPICA_PROXY_TOKEN);
      }
    },
  );

  it.each([
    undefined,
    '',
    ' ',
    'token\r\nX-Injected: yes',
    'Bearer secret',
    '☃',
    'a'.repeat(4097),
  ])('rejects a missing or unsafe token (%#)', (token) => {
    expect(() =>
      resolveJolpicaTransport({ ...proxy, JOLPICA_PROXY_TOKEN: token }),
    ).toThrow('JOLPICA_PROXY_TOKEN must be a bearer token.');
  });

  it('rejects proxy plus controlled KV but keeps direct plus KV', () => {
    expect(() =>
      resolveJolpicaTransport({ ...proxy, CONTROLLED_PROVIDER_SOURCE: 'kv' }),
    ).toThrow(ConfigurationError);
    expect(
      resolveJolpicaTransport({ CONTROLLED_PROVIDER_SOURCE: 'kv' }),
    ).toEqual({ mode: 'direct' });
  });
});
