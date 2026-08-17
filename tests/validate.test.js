/**
 * Run with: node tests/validate.test.js
 */
const assert = require('assert');
const {
  isValidDateString,
  isPastDate,
  isValidCabinClass,
  isValidPassengerCount,
} = require('../lib/validate');

console.log('Validate helpers');

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

test('rejects malformed dates', () => {
  assert.strictEqual(isValidDateString('2026-13-40'), false);
  assert.strictEqual(isValidDateString('not-a-date'), false);
  assert.strictEqual(isValidDateString(undefined), false);
});

test('accepts well-formed dates', () => {
  assert.strictEqual(isValidDateString('2026-09-15'), true);
});

test('flags past dates', () => {
  assert.strictEqual(isPastDate('2020-01-01'), true);
  assert.strictEqual(isPastDate('2099-01-01'), false);
});

test('cabin class must be ECONOMY or BUSINESS', () => {
  assert.strictEqual(isValidCabinClass('ECONOMY'), true);
  assert.strictEqual(isValidCabinClass('business'), true);
  assert.strictEqual(isValidCabinClass('FIRST'), false);
});

test('passenger count must be an integer between 1 and 9', () => {
  assert.strictEqual(isValidPassengerCount('1'), true);
  assert.strictEqual(isValidPassengerCount('9'), true);
  assert.strictEqual(isValidPassengerCount('0'), false);
  assert.strictEqual(isValidPassengerCount('10'), false);
  assert.strictEqual(isValidPassengerCount('abc'), false);
});

console.log('Done.\n');
