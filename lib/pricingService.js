/**
 * PricingService
 * All fare-calculation logic lives here, kept out of route handlers/controllers
 * so pricing rules can change in one place.
 */

/**
 * Applies a seat-scarcity surcharge on top of the stored base fare.
 *   available > 30        -> base fare
 *   15 < available <= 30   -> +10%
 *   5  < available <= 15   -> +25%
 *   available <= 5         -> +40%
 */
function surchargeMultiplier(availableSeats) {
  if (availableSeats > 30) return 1.0;
  if (availableSeats > 15) return 1.10;
  if (availableSeats > 5) return 1.25;
  return 1.40;
}

/**
 * @param {number} baseFare - stored base fare for the cabin class
 * @param {number} taxes - stored taxes for the cabin class
 * @param {number} availableSeats - current available seats for that inventory row
 * @returns {{ baseFare: number, taxes: number, totalFare: number, appliedMultiplier: number }}
 */
function calculateFare(baseFare, taxes, availableSeats) {
  const multiplier = surchargeMultiplier(availableSeats);
  const adjustedBase = round2(Number(baseFare) * multiplier);
  const totalFare = round2(adjustedBase + Number(taxes));
  return {
    baseFare: adjustedBase,
    taxes: Number(taxes),
    totalFare,
    appliedMultiplier: multiplier,
  };
}

/**
 * Fare used at booking time for N passengers of a given cabin class.
 * The computed total is what gets persisted on the booking so that
 * later fare/pricing changes never retroactively alter historical bookings.
 */
function calculateBookingTotal(baseFare, taxes, availableSeats, passengerCount) {
  const perPax = calculateFare(baseFare, taxes, availableSeats);
  return {
    perPassenger: perPax,
    totalAmount: round2(perPax.totalFare * passengerCount),
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { calculateFare, calculateBookingTotal, surchargeMultiplier };
