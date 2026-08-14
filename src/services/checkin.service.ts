import { prisma } from '../config/prisma';
import { Errors } from '../utils/errors';
import { env } from '../config/env';
import { generateBoardingPassId } from '../utils/pnr-generator';
import { hoursBetween } from '../utils/date-utils';

function randomSeat(): string {
  const row = Math.floor(Math.random() * 30) + 1;
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  const letter = letters[Math.floor(Math.random() * letters.length)];
  return `${row}${letter}`;
}

export const checkinService = {
  async checkIn(pnr: string, lastName: string) {
    return prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { pnr: pnr.toUpperCase() },
        include: { passengers: true, flight: true, checkin: true },
      });
      if (!booking) throw Errors.invalidPnr();

      const nameMatches = booking.passengers.some(
        (p) => p.lastName.toLowerCase() === lastName.toLowerCase().trim(),
      );
      if (!nameMatches) throw Errors.invalidPassenger();

      if (booking.status === 'CHECKED_IN' || booking.checkin) throw Errors.alreadyCheckedIn();
      if (booking.status === 'CANCELLED') {
        throw Errors.checkinNotAvailable('This booking has been cancelled.');
      }

      const now = new Date();
      const hoursUntilDeparture = hoursBetween(booking.flight.departureTime, now);
      // hoursUntilDeparture is negative once we're past departure

      if (hoursUntilDeparture > env.checkinOpensHoursBefore) {
        throw Errors.checkinNotAvailable(
          `Check-in opens ${env.checkinOpensHoursBefore} hours before departure.`,
        );
      }
      if (hoursUntilDeparture < env.checkinClosesHoursBefore) {
        throw Errors.checkinClosed(
          `Check-in closes ${env.checkinClosesHoursBefore} hours before departure.`,
        );
      }

      const checkin = await tx.checkin.create({
        data: {
          bookingId: booking.id,
          seatNumber: randomSeat(),
          boardingPassId: generateBoardingPassId(),
          status: 'COMPLETED',
        },
      });

      await tx.booking.update({ where: { id: booking.id }, data: { status: 'CHECKED_IN' } });

      return checkin;
    });
  },
};
