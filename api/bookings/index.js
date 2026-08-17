const { supabase } = require('../../lib/supabase');
const { ok, created, fail, withCors, methodNotAllowed } = require('../../lib/response');
const { calculateBookingTotal } = require('../../lib/pricingService');
const { generateUniquePnr } = require('../../lib/pnrService');
const { mockCharge } = require('../../lib/paymentService');
const { isValidCabinClass } = require('../../lib/validate');

function validatePassenger(p) {
  if (!p) return 'Passenger object is required';
  if (!p.firstName || !p.lastName) return 'firstName and lastName are required for every passenger';
  if (!p.dateOfBirth) return 'dateOfBirth is required for every passenger';
  if (!p.gender || !['MALE', 'FEMALE', 'OTHER'].includes(String(p.gender).toUpperCase())) {
    return 'gender must be one of MALE, FEMALE, OTHER';
  }
  return null;
}

module.exports = async (req, res) => {
  withCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  try {
    const { flightId, userId, passengers, cabinClass } = req.body || {};

    if (!flightId || !userId) {
      return fail(res, 400, 'MISSING_PARAMETERS', 'flightId and userId are required');
    }
    if (!Array.isArray(passengers) || passengers.length === 0) {
      return fail(res, 400, 'MISSING_PASSENGERS', 'At least one passenger is required');
    }
    if (!isValidCabinClass(cabinClass)) {
      return fail(res, 422, 'INVALID_CABIN_CLASS', 'cabinClass must be ECONOMY or BUSINESS');
    }
    for (const p of passengers) {
      const err = validatePassenger(p);
      if (err) return fail(res, 422, 'INVALID_PASSENGER', err);
    }

    // 1. Validate user
    const { data: user, error: userErr } = await supabase
      .from('users').select('id').eq('id', userId).maybeSingle();
    if (userErr) throw userErr;
    if (!user) return fail(res, 404, 'USER_NOT_FOUND', 'The requested user does not exist');

    // 2. Validate flight
    const { data: flight, error: flightErr } = await supabase
      .from('flights')
      .select('id, flight_number, departure_date, departure_time, status, routes ( origin_airport_id, destination_airport_id, origin:airports!routes_origin_airport_id_fkey(code), destination:airports!routes_destination_airport_id_fkey(code) )')
      .eq('id', flightId)
      .maybeSingle();
    if (flightErr) throw flightErr;
    if (!flight) return fail(res, 404, 'FLIGHT_NOT_FOUND', 'The requested flight does not exist');
    if (flight.status === 'CANCELLED') {
      return fail(res, 409, 'FLIGHT_CANCELLED', 'This flight has been cancelled and cannot be booked');
    }

    // 3. Check inventory / seat availability for requested cabin class
    const { data: inventory, error: invErr } = await supabase
      .from('flight_inventory')
      .select('id, available_seats, base_fare, taxes')
      .eq('flight_id', flightId)
      .eq('cabin_class', cabinClass.toUpperCase())
      .maybeSingle();
    if (invErr) throw invErr;
    if (!inventory) return fail(res, 404, 'INVENTORY_NOT_FOUND', 'No inventory for the requested cabin class on this flight');

    const passengerCount = passengers.length;
    if (inventory.available_seats < passengerCount) {
      return fail(res, 409, 'INSUFFICIENT_SEATS', `Only ${inventory.available_seats} seat(s) available in ${cabinClass}`);
    }

    // 4. Calculate fare (based on availability at time of booking; stored, not recalculated later)
    const { totalAmount } = calculateBookingTotal(
      inventory.base_fare,
      inventory.taxes,
      inventory.available_seats,
      passengerCount
    );

    // 5. Reserve seats atomically: only succeeds if seats are still available
    const { data: reserved, error: reserveErr } = await supabase
      .from('flight_inventory')
      .update({ available_seats: inventory.available_seats - passengerCount })
      .eq('id', inventory.id)
      .gte('available_seats', passengerCount)
      .select('id, available_seats')
      .maybeSingle();
    if (reserveErr) throw reserveErr;
    if (!reserved) {
      return fail(res, 409, 'SEAT_RESERVATION_FAILED', 'Seats were taken by another booking, please search again');
    }

    // 6. Mock payment
    const payment = await mockCharge(totalAmount, 'INR');

    // 7. Generate unique PNR
    const pnr = await generateUniquePnr();

    // 8. Create booking
    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .insert({
        pnr,
        user_id: userId,
        flight_id: flightId,
        booking_status: 'CONFIRMED',
        payment_status: payment.status,
        cabin_class: cabinClass.toUpperCase(),
        total_amount: totalAmount,
        currency: 'INR',
      })
      .select()
      .single();
    if (bookingErr) {
      // roll back seat reservation if booking insert somehow fails
      await supabase.from('flight_inventory').update({ available_seats: inventory.available_seats }).eq('id', inventory.id);
      throw bookingErr;
    }

    // 9. Create passenger records
    const passengerRows = passengers.map((p) => ({
      booking_id: booking.id,
      first_name: p.firstName,
      last_name: p.lastName,
      date_of_birth: p.dateOfBirth,
      gender: String(p.gender).toUpperCase(),
      email: p.email || null,
      phone: p.phone || null,
      passport_number: p.passportNumber || null,
    }));
    const { data: insertedPassengers, error: paxErr } = await supabase
      .from('passengers')
      .insert(passengerRows)
      .select();
    if (paxErr) throw paxErr;

    // 10. Create NOT_CHECKED_IN check-in placeholder rows for each passenger
    const checkinRows = insertedPassengers.map((p) => ({
      booking_id: booking.id,
      passenger_id: p.id,
      check_in_status: 'NOT_CHECKED_IN',
    }));
    await supabase.from('checkins').insert(checkinRows);

    return created(res, {
      bookingId: booking.id,
      pnr: booking.pnr,
      bookingStatus: booking.booking_status,
      flightNumber: flight.flight_number,
      origin: flight.routes?.origin?.code,
      destination: flight.routes?.destination?.code,
      departureDate: flight.departure_date,
      departureTime: flight.departure_time?.slice(0, 5),
      passengers: passengerCount,
      totalAmount,
      currency: 'INR',
      paymentStatus: payment.status,
    }, 'Booking confirmed successfully');
  } catch (err) {
    console.error('bookings/create error:', err.message);
    return fail(res, 500, 'INTERNAL_ERROR', 'Something went wrong while creating the booking');
  }
};
