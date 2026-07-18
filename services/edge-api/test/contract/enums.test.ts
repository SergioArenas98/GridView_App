import { describe, expect, it } from 'vitest';

import {
  EVENT_STATUSES,
  SESSION_TYPES,
  WEEKEND_FORMATS,
  parseEnum,
} from '../../src/contract/enums';

describe('parseEnum', () => {
  it('keeps a recognised value', () => {
    expect(parseEnum('sprint', WEEKEND_FORMATS, 'unknown')).toBe('sprint');
    expect(parseEnum('race', SESSION_TYPES, 'unknown')).toBe('race');
    expect(parseEnum('in_progress', EVENT_STATUSES, 'unknown')).toBe(
      'in_progress',
    );
  });

  it('maps an unrecognised value to the fallback', () => {
    expect(parseEnum('red_flagged', EVENT_STATUSES, 'unknown')).toBe('unknown');
    expect(parseEnum('super_sprint', SESSION_TYPES, 'unknown')).toBe('unknown');
  });

  it('maps a non-string value to the fallback', () => {
    expect(parseEnum(null, WEEKEND_FORMATS, 'unknown')).toBe('unknown');
    expect(parseEnum(42, WEEKEND_FORMATS, 'unknown')).toBe('unknown');
    expect(parseEnum(undefined, WEEKEND_FORMATS, 'unknown')).toBe('unknown');
  });
});
