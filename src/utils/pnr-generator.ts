import crypto from 'crypto';

// Excludes ambiguous chars (0, O, 1, I) for readability
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generatePnrCandidate(length = 6): string {
  const bytes = crypto.randomBytes(length);
  let pnr = '';
  for (let i = 0; i < length; i++) {
    pnr += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return pnr;
}

export function generateBookingId(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const rand = crypto.randomInt(10000, 99999);
  return `BK-${y}${m}${d}-${rand}`;
}

export function generateBoardingPassId(): string {
  const rand = crypto.randomInt(100000, 999999);
  return `BP-${rand}`;
}
