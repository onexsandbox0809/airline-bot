import { prisma } from '../config/prisma';
import { formatDuration } from '../utils/date-utils';
import {
  AirlineProvider,
  FlightDTO,
  FlightSearchRequest,
} from './airline-provider.interface';

function toDto(flight: any): FlightDTO {
  return {
    flightId: flight.id,
    airline: flight.airline,
    flightNumber: flight.flightNumber,
    origin: flight.originCode,
    destination: flight.destinationCode,
    departureTime: flight.departureTime.toISOString(),
    arrivalTime: flight.arrivalTime.toISOString(),
    duration: formatDuration(flight.durationMinutes),
    cabinClass: flight.cabinClass,
    availableSeats: flight.availableSeats,
    price: Number(flight.basePrice),
    currency: flight.currency,
  };
}

/**
 * MVP inventory provider. Reads/writes the local `flights` table that was seeded
 * with mock data. To go live with a real GDS/NDC provider (Amadeus, Sabre,
 * Travelport, or a direct airline API), implement AirlineProvider against that
 * provider's SDK/REST API and swap the instance created in flight.service.ts —
 * no other layer needs to change.
 */
export class MockAirlineProvider implements AirlineProvider {
  async searchFlights(request: FlightSearchRequest): Promise<FlightDTO[]> {
    const startOfDay = new Date(`${request.departureDate}T00:00:00.000Z`);
    const endOfDay = new Date(`${request.departureDate}T23:59:59.999Z`);

    const flights = await prisma.flight.findMany({
      where: {
        originCode: request.origin.toUpperCase(),
        destinationCode: request.destination.toUpperCase(),
        departureTime: { gte: startOfDay, lte: endOfDay },
        availableSeats: { gte: request.passengers || 1 },
        status: 'ACTIVE',
        ...(request.cabinClass ? { cabinClass: request.cabinClass as any } : {}),
      },
      orderBy: { basePrice: 'asc' },
    });

    return flights.map(toDto);
  }

  async getFlight(flightId: string): Promise<FlightDTO | null> {
    const flight = await prisma.flight.findUnique({ where: { id: flightId } });
    return flight ? toDto(flight) : null;
  }

  async checkAvailability(flightId: string, passengers: number): Promise<boolean> {
    const flight = await prisma.flight.findUnique({ where: { id: flightId } });
    if (!flight || flight.status !== 'ACTIVE') return false;
    return flight.availableSeats >= passengers;
  }
}

export const airlineProvider = new MockAirlineProvider();
