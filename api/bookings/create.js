const { ok, created, fail, withCors, methodNotAllowed } = require('../../lib/response');
const { createBooking } = require('../../lib/bookingService');

/**
 * GET /api/bookings/create
 *
 * A GET-based mirror of POST /api/bookings, provided purely for convenience -
 * so a booking can be triggered straight from a browser URL bar or a plain
 * link, the same way flight search works.
 *
 * NOTE: creating a resource via GET is unconventional REST practice (GET
 * requests are supposed to be side-effect-free; browsers, proxies, and link
 * previews can pre-fetch GET URLs, which could trigger unintended bookings).
 * Prefer POST /api/bookings for anything beyond quick manual testing.
 *
 * Single passenger (flat query params):
 *   /api/bookings/create?flightId=...&userId=...&cabinClass=ECONOMY
 *     &firstName=Puneet&lastName=Bhargava&dateOfBirth=1990-01-01&gender=MALE
 *     &email=user@example.com&phone=%2B919999999999
 *
 * Multiple passengers (JSON-encoded array in one query param):
 *   /api/bookings/create?flightId=...&userId=...&cabinClass=ECONOMY
 *     &passengers=%5B%7B%22firstName%22%3A%22A%22...%7D%5D
 *   (i.e. passengers=<URL-encoded JSON array>) - takes priority over the
 *   flat single-passenger params if both are present.
 */
module.exports = async (req, res) => {
  withCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  try {
    const {
      flightId,
      userId,
      cabinClass,
      passengers: passengersRaw,
      firstName,
      lastName,
      dateOfBirth,
      gender,
      email,
      phone,
      passportNumber,
    } = req.query;

    let passengers;
    if (passengersRaw) {
      try {
        passengers = JSON.parse(passengersRaw);
      } catch {
        return fail(res, 400, 'INVALID_PASSENGERS_JSON', 'passengers must be a URL-encoded JSON array');
      }
    } else if (firstName || lastName || dateOfBirth || gender) {
      passengers = [{
        firstName,
        lastName,
        dateOfBirth,
        gender,
        email: email || undefined,
        phone: phone || undefined,
        passportNumber: passportNumber || null,
      }];
    }

    const result = await createBooking({ flightId, userId, passengers, cabinClass });

    if (result.status >= 400) {
      return fail(res, result.status, result.code, result.details);
    }
    return created(res, result.data, 'Booking confirmed successfully');
  } catch (err) {
    console.error('bookings/create (GET) error:', err.message);
    return fail(res, 500, 'INTERNAL_ERROR', 'Something went wrong while creating the booking');
  }
};