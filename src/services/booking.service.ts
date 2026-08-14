import { prisma } from '../config/prisma';
import { Errors } from '../utils/errors';
import { generateBookingId, generatePnrCandidate } from '../utils/pnr-generator';

export interface CreateBookingInput {
  userId: string;
  flightId: string;
  passenger: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
  };
}

export interface HistoryFilters {
  status?: string;
  fromDate?: string;
  toDate?: string;
  destination?: string;
}

async function generateUniquePnr(tx: typeof prisma): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generatePnrCandidate();
    const exists = await tx.booking.findUnique({ where: { pnr: candidate } });
    if (!exists) return candidate;
  }
  throw Errors.internal('Failed to generate a unique PNR after multiple attempts.');
}

export const bookingService = {
  async createBooking(input: CreateBookingInput) {
    return prisma.$transaction(async (tx) => {
      const flight = await tx.flight.findUnique({ where: { id: input.flightId } });
      if (!flight || flight.status !== 'ACTIVE') throw Errors.flightNotFound();
      if (flight.availableSeats < 1) throw Errors.noSeats();

      const pnr = await generateUniquePnr(tx as any);
      const bookingId = generateBookingId();

      const booking = await tx.booking.create({
        data: {
          bookingId,
          pnr,
          userId: input.userId,
          flightId: flight.id,
          status: 'CONFIRMED',
          totalAmount: flight.basePrice,
          currency: flight.currency,
          passengers: {
            create: {
              firstName: input.passenger.firstName,
              lastName: input.passenger.lastName,
              email: input.passenger.email,
              phone: input.passenger.phone,
              dateOfBirth: new Date(input.passenger.dateOfBirth),
            },
          },
        },
        include: { passengers: true, flight: true },
      });

      await tx.flight.update({
        where: { id: flight.id },
        data: { availableSeats: { decrement: 1 } },
      });

      return booking;
    });
  },

  async getByBookingId(bookingId: string, userId?: string) {
    const booking = await prisma.booking.findUnique({
      where: { bookingId },
      include: { passengers: true, flight: true, checkin: true },
    });
    if (!booking) throw Errors.bookingNotFound();
    if (userId && booking.userId !== userId) throw Errors.unauthorized('This booking does not belong to you.');
    return booking;
  },

  async getByPnr(pnr: string, userId?: string) {
    const booking = await prisma.booking.findUnique({
      where: { pnr: pnr.toUpperCase() },
      include: { passengers: true, flight: true, checkin: true },
    });
    if (!booking) throw Errors.invalidPnr();
    if (userId && booking.userId !== userId) throw Errors.unauthorized('This booking does not belong to you.');
    return booking;
  },

  async getHistory(userId: string, filters: HistoryFilters) {
    const where: any = { userId };
    if (filters.status) where.status = filters.status;
    if (filters.destination) where.flight = { destinationCode: filters.destination.toUpperCase() };
    if (filters.fromDate || filters.toDate) {
      where.flight = {
        ...(where.flight || {}),
        departureTime: {
          ...(filters.fromDate ? { gte: new Date(filters.fromDate) } : {}),
          ...(filters.toDate ? { lte: new Date(filters.toDate) } : {}),
        },
      };
    }

    return prisma.booking.findMany({
      where,
      include: { flight: true },
      orderBy: { createdAt: 'desc' },
    });
  },
};
