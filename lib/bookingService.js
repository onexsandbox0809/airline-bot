const { supabase } = require('./supabase');
const { calculateBookingTotal } = require('./pricingService');
const { generateUniquePnr } = require('./pnrService');
const { mockCharge } = require('./paymentService');
const { isValidCabinClass } = require('./validate');

function validatePassenger(p) {
  if (!p) return 'Passenger object is required';
  if (!p.firstName || !p.lastName) return 'firstName and lastName are required for every passenger';
  if (!p.dateOfBirth) return 'dateOfBirth is required for every passenger';
  if (!p.gender || !['MALE', 'FEMALE', 'OTHER'].includes(String(p.gender).toUpperCase())) {
    return 'gender must be one of MALE, FEMALE, OTHER';
  }
  return null;
}

/**
 * Creates a booking. Returns { status, body } - status is the HTTP status
 * code to send, body is { success, message, data } or { success, error }
 * shaped for the standard response helpers.
 */
async function createBooking({ flightId, userId, passengers, cabinClass }) {
  if (!flightId || !userId) {
    return { status: 400, code: 'MISSING_PARAMETERS', details: 'flightId and userId are required' };
  }
  if (!Array.isArray(passengers) || passengers.length === 0) {
    return { status: 400, code: 'MISSING_PASSENGERS', details: 'At least one passenger is required' };
  }
  if (!isValidCabinClass(cabinClass)) {
    return { status: 422, code: 'INVALID_CABIN_CLASS', details: 'cabinClass must be ECONOMY or BUSINESS' };
  }
  for (const p of passengers) {
    const err = validatePassenger(p);
    if (err) return { status: 422, code: 'INVALID_PASSENGER', details: err };
  }

  // 1. Validate user
  const { data: user, error: userErr } = await supabase
    .from('users').select('id').eq('id', userId).maybeSingle();
  if (userErr) throw userErr;
  if (!user) return { status: 404, code: 'USER_NOT_FOUND', details: 'The requested user does not exist' };

  // 2. Validate flight
  const { data: flight, error: flightErr } = await supabase
    .from('flights')
    .select('id, flight_number, departure_date, departure_time, status, routes ( origin_airport_id, destination_airport_id, origin:airports!routes_origin_airport_id_fkey(code), destination:airports!routes_destination_airport_id_fkey(code) )')
    .eq('id', flightId)
    .maybeSingle();
  if (flightErr) throw flightErr;
  if (!flight) return { status: 404, code: 'FLIGHT_NOT_FOUND', details: 'The requested flight does not exist' };
  if (flight.status === 'CANCELLED') {
    return { status: 409, code: 'FLIGHT_CANCELLED', details: 'This flight has been cancelled and cannot be booked' };
  }

  // 3. Check inventory / seat availability for requested cabin class
  const { data: inventory, error: invErr } = await supabase
    .from('flight_inventory')
    .select('id, available_seats, base_fare, taxes')
    .eq('flight_id', flightId)
    .eq('cabin_class', cabinClass.toUpperCase())
    .maybeSingle();
  if (invErr) throw invErr;
  if (!inventory) return { status: 404, code: 'INVENTORY_NOT_FOUND', details: 'No inventory for the requested cabin class on this flight' };

  const passengerCount = passengers.length;
  if (inventory.available_seats < passengerCount) {
    return { status: 409, code: 'INSUFFICIENT_SEATS', details: `Only ${inventory.available_seats} seat(s) available in ${cabinClass}` };
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
    return { status: 409, code: 'SEAT_RESERVATION_FAILED', details: 'Seats were taken by another booking, please search again' };
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

  return {
    status: 201,
    data: {
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
    },
  };
}

module.exports = { createBooking, validatePassenger };