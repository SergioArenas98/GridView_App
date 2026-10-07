/**
 * Deterministic JSON text for season-batch outputs, and their digests.
 *
 * The same value always yields the same bytes, whatever order its keys were
 * built in: object keys are sorted by UTF-8 byte order, indentation is two
 * spaces, line endings are `\n` and the text ends with one newline. Readable
 * review diffs and a stable SHA-256 come from the same text.
 *
 * Only JSON values are accepted. `undefined` object members are omitted, as
 * `JSON.stringify` omits them; anything else that JSON cannot represent - a
 * non-finite number, `undefined` in an array, a function, a symbol, a bigint,
 * a non-plain object - is refused rather than silently converted.
 */

import { compareUtf8 } from '../../src/publication/canonical/ordering';

export class CanonicalJsonError extends Error {
  constructor() {
    super('The value is not representable as canonical JSON.');
    this.name = 'CanonicalJsonError';
  }
}

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

function write(value: unknown, indent: string): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(value)) throw new CanonicalJsonError();
      return JSON.stringify(value);
    case 'string':
      return JSON.stringify(value);
    case 'object':
      break;
    default:
      throw new CanonicalJsonError();
  }
  const inner = `${indent}  `;
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map((item: unknown) => {
      if (item === undefined) throw new CanonicalJsonError();
      return `${inner}${write(item, inner)}`;
    });
    return `[\n${items.join(',\n')}\n${indent}]`;
  }
  if (!isPlainObject(value)) throw new CanonicalJsonError();
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort(compareUtf8);
  if (keys.length === 0) return '{}';
  const members = keys.map(
    (key) => `${inner}${JSON.stringify(key)}: ${write(record[key], inner)}`,
  );
  return `{\n${members.join(',\n')}\n${indent}}`;
}

/** The canonical text of `value`, ending in exactly one `\n`. */
export function canonicalJson(value: unknown): string {
  return `${write(value, '')}\n`;
}

/** Lower-case hexadecimal SHA-256 of `bytes`. */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** The UTF-8 bytes of `text`. */
export function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}
