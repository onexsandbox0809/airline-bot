const { supabase } = require('./supabase');

// Excludes 0/O and 1/I to avoid confusing characters.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomPnr(length = 6) {
  let pnr = '';
  for (let i = 0; i < length; i++) {
    pnr += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return pnr;
}

/**
 * Generates a PNR guaranteed unique against the bookings table.
 * The `pnr` column also has a unique index in the DB as a hard backstop.
 */
async function generateUniquePnr() {
  const MAX_ATTEMPTS = 10;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = randomPnr();
    const { data, error } = await supabase
      .from('bookings')
      .select('id')
      .eq('pnr', candidate)
      .maybeSingle();

    if (error) throw error;
    if (!data) return candidate;
  }
  throw new Error('Unable to generate a unique PNR after multiple attempts');
}

module.exports = { generateUniquePnr, randomPnr };
