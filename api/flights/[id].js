const { supabase } = require('../../lib/supabase');
const { ok, fail, withCors, methodNotAllowed } = require('../../lib/response');
const { calculateFare } = require('../../lib/pricingService');

module.exports = async (req, res) => {
  withCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  try {
    const { id } = req.query;

    const { data: flight, error } = await supabase
      .from('flights')
      .select(
        `id, flight_number, airline, departure_date, departure_time, arrival_date, arrival_time,
         duration, stops, status,
         routes ( origin_airport_id, destination_airport_id,
           origin:airports!routes_origin_airport_id_fkey ( code, city, timezone ),
           destination:airports!routes_destination_airport_id_fkey ( code, city, timezone ) ),
         flight_inventory ( cabin_class, total_seats, available_seats, base_fare, taxes, baggage_allowance, refundable )`
      )
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!flight) return fail(res, 404, 'FLIGHT_NOT_FOUND', 'The requested flight does not exist');

    const inventory = (flight.flight_inventory || []).map((inv) => {
      const fare = calculateFare(inv.base_fare, inv.taxes, inv.available_seats);
      return {
        cabinClass: inv.cabin_class,
        availableSeats: inv.available_seats,
        totalSeats: inv.total_seats,
        baseFare: fare.baseFare,
        taxes: fare.taxes,
        totalFare: fare.totalFare,
        baggage: inv.baggage_allowance,
        refundable: inv.refundable,
      };
    });

    return ok(res, {
      flightId: flight.id,
      flightNumber: flight.flight_number,
      airline: flight.airline,
      origin: flight.routes?.origin?.code,
      destination: flight.routes?.destination?.code,
      departureDate: flight.departure_date,
      departureTime: flight.departure_time?.slice(0, 5),
      arrivalDate: flight.arrival_date,
      arrivalTime: flight.arrival_time?.slice(0, 5),
      duration: flight.duration,
      stops: flight.stops,
      status: flight.status,
      currency: 'INR',
      fares: inventory,
    });
  } catch (err) {
    console.error('flights/[id] error:', err.message);
    return fail(res, 500, 'INTERNAL_ERROR', 'Something went wrong while fetching the flight');
  }
};
