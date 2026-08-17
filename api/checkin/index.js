const { supabase } = require('../../lib/supabase');
const { ok, fail, withCors, methodNotAllowed } = require('../../lib/response');

// Check-in window: opens 48h before departure, closes 1h before departure.
const CHECKIN_OPENS_HOURS_BEFORE = 48;
const CHECKIN_CLOSES_HOURS_BEFORE = 1;

const SEAT_ROWS = 30;
const SEAT_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const BOARDING_GROUPS = ['A', 'B', 'C'];

function randomSeat() {
  const row = Math.floor(Math.random() * SEAT_ROWS) + 1;
  const letter = SEAT_LETTERS[Math.floor(Math.random() * SEAT_LETTERS.length)];
  return `${row}${letter}`;
}

function randomBoardingGroup() {
  return BOARDING_GROUPS[Math.floor(Math.random() * BOARDING_GROUPS.length)];
}

function randomBoardingPassId() {
  return `BP-${Math.floor(10000 + Math.random() * 90000)}`;
}

module.exports = async (req, res) => {
  withCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  try {
    const { pnr, lastName } = req.body || {};
    if (!pnr || !lastName) {
      return fail(res, 400, 'MISSING_PARAMETERS', 'pnr and lastName are required');
    }

    const { data: booking, error } = await supabase
      .from('bookings')
      .select(
        `id, booking_status,
         flights ( id, departure_date, departure_time, status ),
         passengers ( id, first_name, last_name, checkins ( id, check_in_status, seat_number, boarding_group, boarding_pass_id ) )`
      )
      .eq('pnr', String(pnr).toUpperCase())
      .maybeSingle();
    if (error) throw error;
    if (!booking) return fail(res, 404, 'PNR_NOT_FOUND', `No booking found for PNR ${pnr}`);

    if (booking.booking_status === 'CANCELLED') {
      return fail(res, 409, 'BOOKING_CANCELLED', 'Cancelled bookings cannot be checked in');
    }
    if (booking.booking_status !== 'CONFIRMED') {
      return fail(res, 409, 'BOOKING_NOT_CONFIRMED', 'Only confirmed bookings can be checked in');
    }

    const passenger = (booking.passengers || []).find(
      (p) => p.last_name.toLowerCase() === String(lastName).trim().toLowerCase()
    );
    if (!passenger) {
      return fail(res, 404, 'PASSENGER_NOT_FOUND', 'No passenger on this booking matches that last name');
    }

    const checkin = passenger.checkins?.[0];
    if (checkin && checkin.check_in_status === 'COMPLETED') {
      return fail(res, 409, 'ALREADY_CHECKED_IN', 'This passenger has already checked in');
    }

    if (booking.flights.status === 'CANCELLED') {
      return fail(res, 409, 'FLIGHT_CANCELLED', 'This flight has been cancelled');
    }

    const departureDateTime = new Date(`${booking.flights.departure_date}T${booking.flights.departure_time}`);
    const now = new Date();
    const hoursUntilDeparture = (departureDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilDeparture > CHECKIN_OPENS_HOURS_BEFORE) {
      return fail(res, 409, 'CHECKIN_NOT_OPEN', `Check-in opens ${CHECKIN_OPENS_HOURS_BEFORE} hours before departure`);
    }
    if (hoursUntilDeparture < CHECKIN_CLOSES_HOURS_BEFORE) {
      return fail(res, 409, 'CHECKIN_CLOSED', `Check-in has closed for this flight`);
    }

    const seatNumber = randomSeat();
    const boardingGroup = randomBoardingGroup();
    const boardingPassId = randomBoardingPassId();

    const updatePayload = {
      check_in_status: 'COMPLETED',
      seat_number: seatNumber,
      boarding_group: boardingGroup,
      boarding_pass_id: boardingPassId,
      checked_in_at: new Date().toISOString(),
    };

    let updateResult;
    if (checkin) {
      updateResult = await supabase.from('checkins').update(updatePayload).eq('id', checkin.id);
    } else {
      updateResult = await supabase.from('checkins').insert({
        booking_id: booking.id,
        passenger_id: passenger.id,
        ...updatePayload,
      });
    }
    if (updateResult.error) throw updateResult.error;

    return ok(res, {
      pnr: String(pnr).toUpperCase(),
      checkInStatus: 'COMPLETED',
      seatNumber,
      boardingGroup,
      boardingPassId,
    }, 'Web check-in completed successfully');
  } catch (err) {
    console.error('checkin error:', err.message);
    return fail(res, 500, 'INTERNAL_ERROR', 'Something went wrong during check-in');
  }
};
