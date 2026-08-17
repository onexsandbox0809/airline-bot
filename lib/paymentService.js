/**
 * PaymentService (mock)
 * MVP does not integrate a real payment gateway. This module simulates a
 * payment attempt and is intentionally the only place that knows about
 * payment status, so a real provider (Razorpay/Stripe/etc.) can be
 * dropped in later without touching booking logic elsewhere.
 */

const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
};

/**
 * Simulates a payment charge. Always succeeds in this MVP.
 * Swap this function's internals for a real gateway call later -
 * the return shape is what the rest of the app depends on.
 */
async function mockCharge(amount, currency) {
  return {
    status: PAYMENT_STATUS.PAID,
    reference: `MOCKPAY-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    amount,
    currency,
  };
}

async function mockRefund(amount, currency) {
  return {
    status: PAYMENT_STATUS.REFUNDED,
    reference: `MOCKREFUND-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    amount,
    currency,
  };
}

module.exports = { PAYMENT_STATUS, mockCharge, mockRefund };
