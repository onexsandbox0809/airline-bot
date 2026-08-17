const { supabase } = require('../../../lib/supabase');
const { ok, fail, withCors, methodNotAllowed } = require('../../../lib/response');

module.exports = async (req, res) => {
  withCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  try {
    const { userId } = req.query;
    const {
      status,
      fromDate,
      toDate,
      destination,
      page = '1',
      limit = '10',
    } = req.query;

    const { data: user, error: userErr } = await supabase
      .from('users').select('id').eq('id', userId).maybeSingle();
    if (userErr) throw userErr;
    if (!user) return fail(res, 404, 'USER_NOT_FOUND', 'The requested user does not exist');

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;

    let query = supabase
      .from('bookings')
      .select(
        `pnr, booking_status, total_amount, currency, created_at,
         flights ( flight_number, departure_date,
           routes ( origin:airports!routes_origin_airport_id_fkey(code), destination:airports!routes_destination_airport_id_fkey(code) ) )`,
        { count: 'exact' }
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status) query = query.eq('booking_status', String(status).toUpperCase());
    if (fromDate) query = query.gte('flights.departure_date', fromDate);
    if (toDate) query = query.lte('flights.departure_date', toDate);

    const { data, error, count } = await query;
    if (error) throw error;

    let results = (data || []).map((b) => ({
      pnr: b.pnr,
      origin: b.flights?.routes?.origin?.code,
      destination: b.flights?.routes?.destination?.code,
      departureDate: b.flights?.departure_date,
      flightNumber: b.flights?.flight_number,
      bookingStatus: b.booking_status,
      totalAmount: b.total_amount,
      currency: b.currency,
    }));

    if (destination) {
      results = results.filter((r) => r.destination === String(destination).toUpperCase());
    }

    return ok(res, {
      bookings: results,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count ?? results.length,
        totalPages: Math.ceil((count ?? results.length) / limitNum),
      },
    });
  } catch (err) {
    console.error('bookings/history error:', err.message);
    return fail(res, 500, 'INTERNAL_ERROR', 'Something went wrong while fetching booking history');
  }
};
