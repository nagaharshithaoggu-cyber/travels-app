import { describe, expect, it } from 'vitest';
import { formatDuration, formatMoney, validateRouteSearch } from './travel';

describe('travel helpers', () => {
  it('formats prices from integer paise without floating-point fare math', () => {
    expect(formatMoney(599900)).toContain('5,999');
    expect(formatMoney(0)).toContain('0');
  });

  it('formats journey duration', () => {
    expect(formatDuration(130)).toBe('2h 10m');
    expect(formatDuration(120)).toBe('2h');
  });

  it('rejects invalid route and past dates', () => {
    expect(validateRouteSearch('Mumbai', 'mumbai', '2026-10-20', '2026-10-17')).toContain('different');
    expect(validateRouteSearch('Mumbai', 'Pune', '2026-10-16', '2026-10-17')).toContain('valid date');
    expect(validateRouteSearch('Mumbai', 'Pune', '2026-10-20', '2026-10-17')).toBeNull();
  });
});
