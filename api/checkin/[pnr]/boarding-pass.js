const { supabase } = require('../../../lib/supabase');
const { ok, fail, withCors, methodNotAllowed } = require('../../../lib/response');

// Gate isn't stored in the schema (kept intentionally out of scope for MVP);
// derive a stable mock gate number from the flight id so it doesn't
// change between requests for the same flight.
function mockGate(flightId) {
  let hash = 0;
  for (const ch of String(flightId)) hash = (hash * 31 + ch.charCodeAt(0)) % 20;
  return `G${hash + 1}`;
}

module.exports = async (req, res) => {
  withCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  try {
    const pnr = String(req.query.pnr || '').toUpperCase();

    const { data: booking, error } = await supabase
      .from('bookings')
      .select(
        `id, booking_status,
         flights ( id, flight_number, departure_date, departure_time,
           routes ( origin:airports!routes_origin_airport_id_fkey(code), destination:airports!routes_destination_airport_id_fkey(code) ) ),
         passengers ( first_name, last_name, checkins ( check_in_status, seat_number, boarding_group, boarding_pass_id ) )`
      )
      .eq('pnr', pnr)
      .maybeSingle();
    if (error) throw error;
    if (!booking) return fail(res, 404, 'PNR_NOT_FOUND', `No booking found for PNR ${pnr}`);

    const checkedInPassenger = (booking.passengers || []).find(
      (p) => p.checkins?.[0]?.check_in_status === 'COMPLETED'
    );
    if (!checkedInPassenger) {
      return fail(res, 404, 'BOARDING_PASS_NOT_AVAILABLE', 'No completed check-in found for this booking. Please check in first.');
    }

    const checkin = checkedInPassenger.checkins[0];
    const status = booking.booking_status === 'CANCELLED' ? 'INVALID' : 'VALID';

    return ok(res, {
      boardingPassId: checkin.boarding_pass_id,
      pnr,
      passengerName: `${checkedInPassenger.first_name} ${checkedInPassenger.last_name}`,
      flightNumber: booking.flights.flight_number,
      origin: booking.flights.routes?.origin?.code,
      destination: booking.flights.routes?.destination?.code,
      date: booking.flights.departure_date,
      departureTime: booking.flights.departure_time?.slice(0, 5),
      seat: checkin.seat_number,
      boardingGroup: checkin.boarding_group,
      gate: mockGate(booking.flights.id),
      status,
    });
  } catch (err) {
    console.error('boarding-pass error:', err.message);
    return fail(res, 500, 'INTERNAL_ERROR', 'Something went wrong while fetching the boarding pass');
  }
};
