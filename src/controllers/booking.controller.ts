import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { bookingService } from '../services/booking.service';
import { ok } from '../utils/response';
import { AuthedRequest } from '../middleware/auth';

const bookingSchema = z.object({
  flightId: z.string().min(1),
  passenger: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(6),
    dateOfBirth: z.string().min(8),
  }),
});

export const bookingController = {
  async create(req: AuthedRequest, res: Response, next: NextFunction) {
    try {
      const input = bookingSchema.parse(req.body);
      const booking = await bookingService.createBooking({ userId: req.user!.id, ...input });
      ok(
        res,
        {
          bookingId: booking.bookingId,
          pnr: booking.pnr,
          status: booking.status,
          flight: {
            flightNumber: booking.flight.flightNumber,
            origin: booking.flight.originCode,
            destination: booking.flight.destinationCode,
          },
          passenger: {
            firstName: booking.passengers[0]?.firstName,
            lastName: booking.passengers[0]?.lastName,
          },
          totalAmount: Number(booking.totalAmount),
          currency: booking.currency,
        },
        201,
      );
    } catch (err) {
      next(err);
    }
  },

  async getByBookingId(req: AuthedRequest, res: Response, next: NextFunction) {
    try {
      const booking = await bookingService.getByBookingId(req.params.bookingId, req.user!.id);
      ok(res, { booking });
    } catch (err) {
      next(err);
    }
  },

  async getByPnr(req: AuthedRequest, res: Response, next: NextFunction) {
    try {
      const booking = await bookingService.getByPnr(req.params.pnr, req.user!.id);
      ok(res, { booking });
    } catch (err) {
      next(err);
    }
  },

  async history(req: AuthedRequest, res: Response, next: NextFunction) {
    try {
      const { status, fromDate, toDate, destination } = req.query as Record<string, string>;
      const bookings = await bookingService.getHistory(req.user!.id, { status, fromDate, toDate, destination });
      ok(res, {
        bookings: bookings.map((b) => ({
          bookingId: b.bookingId,
          pnr: b.pnr,
          origin: b.flight.originCode,
          destination: b.flight.destinationCode,
          departureDate: b.flight.departureTime,
          status: b.status,
          amount: Number(b.totalAmount),
        })),
      });
    } catch (err) {
      next(err);
    }
  },
};
