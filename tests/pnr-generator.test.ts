import { describe, it, expect } from 'vitest';
import { generatePnrCandidate, generateBookingId, generateBoardingPassId } from '../src/utils/pnr-generator';

describe('pnr-generator', () => {
  it('generates a 6-character alphanumeric PNR', () => {
    const pnr = generatePnrCandidate();
    expect(pnr).toHaveLength(6);
    expect(pnr).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('generates PNRs that are highly unlikely to collide across many draws', () => {
    const set = new Set(Array.from({ length: 2000 }, () => generatePnrCandidate()));
    // With ~33^6 possible values, 2000 draws should essentially never collide
    expect(set.size).toBeGreaterThan(1990);
  });

  it('generates a booking ID in the BK-YYYYMMDD-XXXXX format', () => {
    const id = generateBookingId(new Date('2026-08-20T00:00:00Z'));
    expect(id).toMatch(/^BK-20260820-\d{5}$/);
  });

  it('generates a boarding pass ID in the BP-XXXXXX format', () => {
    const id = generateBoardingPassId();
    expect(id).toMatch(/^BP-\d{6}$/);
  });
});
