const { supabase } = require('../../lib/supabase');
const { ok, fail, withCors, methodNotAllowed } = require('../../lib/response');
const { calculateFare } = require('../../lib/pricingService');
const {
  isValidDateString,
  isPastDate,
  isValidCabinClass,
  isValidPassengerCount,
} = require('../../lib/validate');

async function findAirport(code) {
  if (!code) return null;
  const { data, error } = await supabase
    .from('airports')
    .select('id, code, name, city, country, timezone')
    .eq('code', String(code).toUpperCase())
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function findActiveRoute(originId, destinationId) {
  const { data, error } = await supabase
    .from('routes')
    .select('id, active')
    .eq('origin_airport_id', originId)
    .eq('destination_airport_id', destinationId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function searchLeg({ originAirport, destinationAirport, route, date, cabinClass, passengers }) {
  let query = supabase
    .from('flights')
    .select(
      `id, flight_number, airline, departure_date, departure_time, arrival_date, arrival_time,
       duration, stops, status,
       flight_inventory ( id, cabin_class, available_seats, base_fare, taxes, baggage_allowance, refundable )`
    )
    .eq('route_id', route.id)
    .eq('departure_date', date)
    .neq('status', 'CANCELLED');

  const { data, error } = await query;
  if (error) throw error;

  const results = [];
  for (const flight of data || []) {
    const inv = (flight.flight_inventory || []).find(
      (i) => i.cabin_class === cabinClass.toUpperCase()
    );
    if (!inv) continue;
    if (inv.available_seats < passengers) continue;

    const fare = calculateFare(inv.base_fare, inv.taxes, inv.available_seats);

    results.push({
      flightId: flight.id,
      flightNumber: flight.flight_number,
      airline: flight.airline,
      origin: originAirport.code,
      destination: destinationAirport.code,
      departureDate: flight.departure_date,
      departureTime: flight.departure_time?.slice(0, 5),
      arrivalTime: flight.arrival_time?.slice(0, 5),
      duration: flight.duration,
      stops: flight.stops,
      cabinClass: inv.cabin_class,
      availableSeats: inv.available_seats,
      baseFare: fare.baseFare,
      taxes: fare.taxes,
      totalFare: fare.totalFare,
      currency: 'INR',
      baggage: inv.baggage_allowance,
      refundable: inv.refundable,
      flightStatus: flight.status,
    });
  }

  results.sort((a, b) => a.totalFare - b.totalFare);
  return results;
}

module.exports = async (req, res) => {
  withCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  try {
    const {
      origin,
      destination,
      departureDate,
      returnDate,
      tripType = 'ONE_WAY',
      passengers = '1',
      cabinClass = 'ECONOMY',
    } = req.query;

    if (!origin || !destination) {
      return fail(res, 400, 'MISSING_PARAMETERS', 'origin and destination are required');
    }
    if (String(origin).toUpperCase() === String(destination).toUpperCase()) {
      return fail(res, 400, 'INVALID_ROUTE', 'Origin and destination cannot be the same');
    }
    if (!isValidDateString(departureDate)) {
      return fail(res, 400, 'INVALID_DATE', 'departureDate must be a valid YYYY-MM-DD date');
    }
    if (isPastDate(departureDate)) {
      return fail(res, 400, 'PAST_DATE', 'departureDate cannot be in the past');
    }
    if (!isValidPassengerCount(passengers)) {
      return fail(res, 422, 'INVALID_PASSENGER_COUNT', 'passengers must be an integer between 1 and 9');
    }
    if (!isValidCabinClass(cabinClass)) {
      return fail(res, 422, 'INVALID_CABIN_CLASS', 'cabinClass must be ECONOMY or BUSINESS');
    }
    if (String(tripType).toUpperCase() === 'ROUND_TRIP') {
      if (!returnDate || !isValidDateString(returnDate)) {
        return fail(res, 400, 'INVALID_RETURN_DATE', 'returnDate is required and must be valid for ROUND_TRIP');
      }
      if (returnDate < departureDate) {
        return fail(res, 400, 'INVALID_RETURN_DATE', 'returnDate cannot be before departureDate');
      }
    }

    const originAirport = await findAirport(origin);
    if (!originAirport) return fail(res, 404, 'AIRPORT_NOT_FOUND', `Origin airport '${origin}' does not exist`);

    const destinationAirport = await findAirport(destination);
    if (!destinationAirport) return fail(res, 404, 'AIRPORT_NOT_FOUND', `Destination airport '${destination}' does not exist`);

    const outboundRoute = await findActiveRoute(originAirport.id, destinationAirport.id);
    if (!outboundRoute || !outboundRoute.active) {
      return fail(res, 404, 'ROUTE_NOT_SUPPORTED', `Route ${origin}-${destination} is not currently supported`);
    }

    const passengerCount = Number(passengers);

    const outbound = await searchLeg({
      originAirport,
      destinationAirport,
      route: outboundRoute,
      date: departureDate,
      cabinClass,
      passengers: passengerCount,
    });

    if (String(tripType).toUpperCase() === 'ROUND_TRIP') {
      const returnRoute = await findActiveRoute(destinationAirport.id, originAirport.id);
      if (!returnRoute || !returnRoute.active) {
        return fail(res, 404, 'ROUTE_NOT_SUPPORTED', `Return route ${destination}-${origin} is not currently supported`);
      }
      const inbound = await searchLeg({
        originAirport: destinationAirport,
        destinationAirport: originAirport,
        route: returnRoute,
        date: returnDate,
        cabinClass,
        passengers: passengerCount,
      });
      return ok(res, { outbound, return: inbound });
    }

    return ok(res, outbound);
  } catch (err) {
    console.error('flights/search error:', err.message);
    return fail(res, 500, 'INTERNAL_ERROR', 'Something went wrong while searching flights');
  }
};
