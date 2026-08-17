const { supabase } = require('../../lib/supabase');
const { ok, fail, withCors, methodNotAllowed } = require('../../lib/response');

module.exports = async (req, res) => {
  withCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  try {
    const pnr = String(req.query.pnr || '').toUpperCase();

    const { data: booking, error } = await supabase
      .from('bookings')
      .select(
        `id, pnr, booking_status, payment_status, cabin_class, total_amount, currency, created_at,
         flights ( flight_number, airline, departure_date, departure_time, arrival_date, arrival_time, status,
           routes ( origin:airports!routes_origin_airport_id_fkey(code), destination:airports!routes_destination_airport_id_fkey(code) ) ),
         passengers ( id, first_name, last_name, gender, date_of_birth, passport_number,
           checkins ( check_in_status, seat_number, boarding_group, boarding_pass_id, checked_in_at ) ),
         flight_id`
      )
      .eq('pnr', pnr)
      .maybeSingle();

    if (error) throw error;
    if (!booking) return fail(res, 404, 'PNR_NOT_FOUND', `No booking found for PNR ${pnr}`);

    // grab baggage allowance for the booked cabin class
    const { data: inventory } = await supabase
      .from('flight_inventory')
      .select('baggage_allowance')
      .eq('flight_id', booking.flight_id)
      .eq('cabin_class', booking.cabin_class)
      .maybeSingle();

    return ok(res, {
      pnr: booking.pnr,
      bookingStatus: booking.booking_status,
      paymentStatus: booking.payment_status,
      flightNumber: booking.flights?.flight_number,
      airline: booking.flights?.airline,
      origin: booking.flights?.routes?.origin?.code,
      destination: booking.flights?.routes?.destination?.code,
      departureDate: booking.flights?.departure_date,
      departureTime: booking.flights?.departure_time?.slice(0, 5),
      arrivalTime: booking.flights?.arrival_time?.slice(0, 5),
      flightStatus: booking.flights?.status,
      cabinClass: booking.cabin_class,
      fare: booking.total_amount,
      currency: booking.currency,
      baggage: inventory?.baggage_allowance || null,
      createdAt: booking.created_at,
      passengers: (booking.passengers || []).map((p) => ({
        firstName: p.first_name,
        lastName: p.last_name,
        gender: p.gender,
        dateOfBirth: p.date_of_birth,
        checkInStatus: p.checkins?.[0]?.check_in_status || 'NOT_CHECKED_IN',
        seat: p.checkins?.[0]?.seat_number || null,
        boardingGroup: p.checkins?.[0]?.boarding_group || null,
        boardingPassId: p.checkins?.[0]?.boarding_pass_id || null,
      })),
    });
  } catch (err) {
    console.error('bookings/[pnr] error:', err.message);
    return fail(res, 500, 'INTERNAL_ERROR', 'Something went wrong while fetching the booking');
  }
};
