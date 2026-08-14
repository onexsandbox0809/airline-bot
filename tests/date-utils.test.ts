import { describe, it, expect } from 'vitest';
import { resolveRelativeDate, formatDuration, hoursBetween } from '../src/utils/date-utils';

describe('date-utils', () => {
  it('resolves "tomorrow" relative to a base date', () => {
    const base = new Date('2026-08-14T00:00:00Z');
    expect(resolveRelativeDate('tomorrow', base)).toBe('2026-08-15');
  });

  it('resolves "20 August" to an ISO date', () => {
    const base = new Date('2026-08-01T00:00:00Z');
    expect(resolveRelativeDate('20 august', base)).toBe('2026-08-20');
  });

  it('formats duration in minutes as "Xh Ym"', () => {
    expect(formatDuration(225)).toBe('3h 45m');
  });

  it('computes hours between two dates', () => {
    const a = new Date('2026-08-20T12:00:00Z');
    const b = new Date('2026-08-20T10:00:00Z');
    expect(hoursBetween(a, b)).toBe(2);
  });
});
