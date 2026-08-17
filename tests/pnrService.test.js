/**
 * Run with: node tests/pnrService.test.js
 * Requires SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars to be set
 * (even dummy values are fine for the randomPnr format test, since it
 * doesn't hit the network).
 */
const assert = require('assert');
const { randomPnr } = require('../lib/pnrService');

console.log('PNRService');

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

test('PNR is exactly 6 characters', () => {
  assert.strictEqual(randomPnr().length, 6);
});

test('PNR is uppercase alphanumeric only', () => {
  assert.match(randomPnr(), /^[A-Z0-9]+$/);
});

test('PNR never contains confusing characters 0, O, 1, I', () => {
  for (let i = 0; i < 500; i++) {
    const pnr = randomPnr();
    assert.doesNotMatch(pnr, /[01OI]/, `PNR ${pnr} contained a confusing character`);
  }
});

console.log('Done.\n');
