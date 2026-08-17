/**
 * Plain Node assert-based tests (no test framework dependency needed).
 * Run with: node tests/pricingService.test.js
 */
const assert = require('assert');
const { calculateFare, calculateBookingTotal, surchargeMultiplier } = require('../lib/pricingService');

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

console.log('PricingService');

test('no surcharge when seats > 30', () => {
  assert.strictEqual(surchargeMultiplier(31), 1.0);
  assert.strictEqual(calculateFare(4500, 810, 40).baseFare, 4500);
});

test('+10% surcharge when 15 < seats <= 30', () => {
  assert.strictEqual(surchargeMultiplier(30), 1.10);
  assert.strictEqual(calculateFare(4500, 810, 20).baseFare, 4950);
});

test('+25% surcharge when 5 < seats <= 15', () => {
  assert.strictEqual(surchargeMultiplier(15), 1.25);
  assert.strictEqual(calculateFare(4500, 810, 10).baseFare, 5625);
});

test('+40% surcharge when seats <= 5', () => {
  assert.strictEqual(surchargeMultiplier(5), 1.40);
  assert.strictEqual(calculateFare(4500, 810, 1).baseFare, 6300);
});

test('total fare adds taxes on top of surcharged base fare', () => {
  const fare = calculateFare(4500, 810, 40);
  assert.strictEqual(fare.totalFare, 5310);
});

test('booking total multiplies per-passenger total fare by passenger count', () => {
  const { totalAmount } = calculateBookingTotal(4500, 810, 40, 3);
  assert.strictEqual(totalAmount, 5310 * 3);
});

console.log('Done.\n');
