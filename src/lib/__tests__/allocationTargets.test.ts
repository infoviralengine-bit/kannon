import { describe, expect, it } from 'vitest';
import { parsePlanningTarget } from '@/lib/allocationTargets';

describe('allocation planning targets', () => {
  it('accepts an unset target and zero as distinct values', () => {
    expect(parsePlanningTarget('')).toBeNull();
    expect(parsePlanningTarget('0')).toBe(0);
    expect(parsePlanningTarget('500')).toBe(500);
  });
  it('rejects invalid or fractional targets', () => {
    for (const value of ['-1', '2.5', 'hello', '1e4', '9007199254740992']) {
      expect(() => parsePlanningTarget(value)).toThrow();
    }
  });
});