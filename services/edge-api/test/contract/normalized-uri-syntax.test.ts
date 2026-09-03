/**
 * A media URL is judged as the string the adapter emitted, not as the string
 * the parser was willing to make of it.
 *
 * `new URL()` implements the WHATWG URL Standard, which is a *repair* parser:
 * for a special scheme it removes every ASCII tab, newline and carriage return
 * anywhere in the input, strips leading and trailing C0 controls and spaces,
 * rewrites `\` as `/`, and percent-encodes the remaining forbidden characters.
 * So `new URL(value)` succeeding says only that the value *could be turned
 * into* a URL, and the protocol check then ran against that repaired result
 * while the original, unrepaired string is what is retained and published.
 *
 * `docs/api/gridview-api-v1.yaml` declares `MediaVariant.url` as
 * `format: uri`, which JSON Schema defines as valid per RFC 3986. Raw
 * whitespace, C0 controls, DEL and backslashes are not URI characters under
 * that grammar, so a value carrying one is not a `uri` and must not reach a
 * published document by way of the parser's repairs.
 *
 * The guard is deliberately lexical and deliberately small. It does not
 * re-implement RFC 3986, and it does not adopt the Flutter client's
 * `MediaUrlPolicy.strict` loading rules - HTTPS-only, a required host and no
 * userinfo - as wire-contract requirements, because no authoritative repository
 * document states them as such. That alignment is an adapter-registration
 * obligation, recorded in ADR 0024.
 */

import { describe, expect, it } from 'vitest';

import { validateMediaAsset } from '../../src/contract/normalized';

const asset: Record<string, unknown> = {
  id: 'max-verstappen-portrait',
  entityType: 'driver',
  entityId: 'max-verstappen',
  category: 'portrait',
  format: 'webp',
  variants: {
    thumbnail: { url: 'https://media.example/x.webp', width: 1, height: 1 },
  },
  aspectRatio: 1,
  version: 'v1',
  attribution: null,
  license: null,
  fallbackCategory: null,
};

function urlCodes(url: unknown): string[] {
  return validateMediaAsset(
    {
      ...asset,
      variants: { thumbnail: { url, width: null, height: null } },
    },
    'data',
  )
    .filter((issue) => issue.path === 'data.variants.thumbnail.url')
    .map((issue) => issue.code);
}

describe('a raw string the URL parser repairs is not a contract uri', () => {
  it.each([
    ['a raw embedded space', 'https://media.example/a b.webp'],
    ['a raw tab', 'https://media.example/a\tb.webp'],
    ['a raw newline', 'https://media.example/a\nb.webp'],
    ['a raw carriage return', 'https://media.example/a\rb.webp'],
    ['a raw C0 control', 'https://media.example/a\u0001b.webp'],
    ['a raw NUL', 'https://media.example/a\u0000b.webp'],
    ['a raw DEL', 'https://media.example/a\u007Fb.webp'],
    ['a raw backslash in the path', 'https://media.example\\image.webp'],
    ['a raw backslash authority', 'https:\\\\media.example\\image.webp'],
    ['leading whitespace', ' https://media.example/x.webp'],
    ['trailing whitespace', 'https://media.example/x.webp '],
    ['a leading newline', '\nhttps://media.example/x.webp'],
    ['a raw space in the query', 'https://media.example/x.webp?a=b c'],
    ['a raw newline in the host', 'https://media.\nexample/x.webp'],
  ])('rejects %s', (_label, url) => {
    expect(urlCodes(url)).toEqual(['uri']);
  });

  it('reports exactly one issue for a repaired value', () => {
    expect(
      validateMediaAsset(
        {
          ...asset,
          variants: {
            thumbnail: {
              url: 'https://media.example/a\nb.webp',
              width: null,
              height: null,
            },
          },
        },
        'data',
      ),
    ).toHaveLength(1);
  });

  it('leaks neither the value nor its host into the issue', () => {
    const serialized = JSON.stringify(
      validateMediaAsset(
        {
          ...asset,
          variants: {
            thumbnail: {
              url: 'https://secret.internal/a\u0001b.webp',
              width: null,
              height: null,
            },
          },
        },
        'data',
      ),
    );

    expect(serialized).not.toContain('secret.internal');
    expect(serialized).not.toContain('.webp');
  });

  it('does not normalize or coerce a rejected value', () => {
    const value = {
      ...asset,
      variants: {
        thumbnail: {
          url: 'https://media.example/a b.webp',
          width: null,
          height: null,
        },
      },
    };
    const before = JSON.stringify(value);
    validateMediaAsset(value, 'data');

    expect(JSON.stringify(value)).toBe(before);
  });
});

describe('percent-encoding is how a URI carries these characters', () => {
  it.each([
    ['a percent-encoded space', 'https://media.example/a%20b.webp'],
    ['a percent-encoded newline', 'https://media.example/a%0Ab.webp'],
    ['a percent-encoded control', 'https://media.example/a%01b.webp'],
    ['a percent-encoded backslash', 'https://media.example/a%5Cb.webp'],
    ['a percent-encoded space in the query', 'https://media.example/x?a=b%20c'],
    ['an ordinary https URL', 'https://media.example/x.webp'],
    ['a URL with a port and a fragment', 'https://media.example:8443/x.webp#a'],
    ['a plus sign, which is a URI character', 'https://media.example/a+b.webp'],
    ['a tilde, which is unreserved', 'https://media.example/~a/b.webp'],
  ])('accepts %s', (_label, url) => {
    expect(urlCodes(url)).toEqual([]);
  });
});

describe('every unrelated url rule is unchanged', () => {
  it.each([
    ['a value that is not a URL at all', 'not-a-url'],
    ['a relative path', '/media/x.webp'],
    ['an unsupported scheme', 'ftp://media.example/x.webp'],
    ['a data URI', 'data:image/webp;base64,AAAA'],
    ['a javascript URI', 'javascript:alert(1)'],
    ['an empty string', ''],
  ])('still rejects %s', (_label, url) => {
    expect(urlCodes(url)).toEqual(['uri']);
  });

  it('still rejects a URL beyond the length bound', () => {
    expect(urlCodes(`https://media.example/${'a'.repeat(2048)}.webp`)).toEqual([
      'uri',
    ]);
  });

  it('still reports a non-string as a type failure', () => {
    expect(urlCodes(42)).toEqual(['type']);
  });

  it('still reports null as a null failure', () => {
    expect(urlCodes(null)).toEqual(['null']);
  });

  it('stays bounded on an adversarially long repaired value', () => {
    const started = Date.now();
    const codes = urlCodes(`https://media.example/${' '.repeat(100_000)}.webp`);

    expect(codes).toEqual(['uri']);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
