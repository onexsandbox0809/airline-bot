const { supabase } = require('../../../lib/supabase');
const { ok, fail, withCors, methodNotAllowed } = require('../../../lib/response');
const { mockRefund } = require('../../../lib/paymentService');

module.exports = async (req, res) => {
  withCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  try {
    const pnr = String(req.query.pnr || '').toUpperCase();

    const { data: booking, error } = await supabase
      .from('bookings')
      .select(
        `id, booking_status, cabin_class, total_amount, currency,
         flights ( id, departure_date, departure_time ),
         passengers ( id )`
      )
      .eq('pnr', pnr)
      .maybeSingle();
    if (error) throw error;
    if (!booking) return fail(res, 404, 'PNR_NOT_FOUND', `No booking found for PNR ${pnr}`);

    if (booking.booking_status === 'CANCELLED') {
      return fail(res, 409, 'ALREADY_CANCELLED', 'This booking has already been cancelled');
    }

    const departureDateTime = new Date(
      `${booking.flights.departure_date}T${booking.flights.departure_time}`
    );
    if (departureDateTime.getTime() <= Date.now()) {
      return fail(res, 409, 'FLIGHT_ALREADY_DEPARTED', 'Cannot cancel a booking after the flight has departed');
    }

    const passengerCount = (booking.passengers || []).length || 1;

    // Release inventory
    const { data: inv } = await supabase
      .from('flight_inventory')
      .select('id, available_seats')
      .eq('flight_id', booking.flights.id)
      .eq('cabin_class', booking.cabin_class)
      .maybeSingle();

    if (inv) {
      await supabase
        .from('flight_inventory')
        .update({ available_seats: inv.available_seats + passengerCount })
        .eq('id', inv.id);
    }

    const refund = await mockRefund(booking.total_amount, booking.currency);

    const { error: updateErr } = await supabase
      .from('bookings')
      .update({ booking_status: 'CANCELLED', payment_status: refund.status, updated_at: new Date().toISOString() })
      .eq('id', booking.id);
    if (updateErr) throw updateErr;

    return ok(res, { pnr, status: 'CANCELLED' }, 'Booking cancelled successfully');
  } catch (err) {
    console.error('bookings/cancel error:', err.message);
    return fail(res, 500, 'INTERNAL_ERROR', 'Something went wrong while cancelling the booking');
  }
};
