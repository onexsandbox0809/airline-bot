import { randomUUID } from 'crypto';
import { airlineProvider } from '../providers/mock-airline.provider';
import { FlightSearchRequest } from '../providers/airline-provider.interface';
import { Errors } from '../utils/errors';
import { prisma } from '../config/prisma';

// In-memory search result cache keyed by searchId (fine for MVP / single instance;
// swap for Redis if deploying multi-instance).
const searchCache = new Map<string, { request: FlightSearchRequest; flightIds: string[]; createdAt: number }>();

export const flightService = {
  async searchFlights(request: FlightSearchRequest) {
    if (!request.origin || !request.destination) {
      throw Errors.invalidRequest('origin and destination are required.');
    }
    if (request.origin.toUpperCase() === request.destination.toUpperCase()) {
      throw Errors.invalidRequest('origin and destination must be different.');
    }
    if (!request.departureDate) {
      throw Errors.invalidRequest('departureDate is required.');
    }
    const departure = new Date(`${request.departureDate}T00:00:00.000Z`);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (isNaN(departure.getTime())) {
      throw Errors.invalidRequest('departureDate must be a valid date (YYYY-MM-DD).');
    }
    if (departure < today) {
      throw Errors.invalidRequest('departureDate cannot be in the past.');
    }

    const originExists = await prisma.airport.findUnique({ where: { code: request.origin.toUpperCase() } });
    const destExists = await prisma.airport.findUnique({ where: { code: request.destination.toUpperCase() } });
    if (!originExists || !destExists) {
      throw Errors.invalidRequest('Unknown origin or destination airport code.');
    }

    const flights = await airlineProvider.searchFlights({
      ...request,
      origin: request.origin.toUpperCase(),
      destination: request.destination.toUpperCase(),
      passengers: request.passengers || 1,
    });

    const searchId = `search_${randomUUID().slice(0, 8)}`;
    searchCache.set(searchId, {
      request,
      flightIds: flights.map((f) => f.flightId),
      createdAt: Date.now(),
    });

    return { searchId, flights };
  },

  async getFlight(flightId: string) {
    const flight = await airlineProvider.getFlight(flightId);
    if (!flight) throw Errors.flightNotFound();
    return flight;
  },

  /** Resolve an ordinal reference ("the first one", "second flight") from a prior search */
  resolveFromSearch(searchId: string, ordinal: number): string | null {
    const cached = searchCache.get(searchId);
    if (!cached) return null;
    return cached.flightIds[ordinal - 1] ?? null;
  },

  cacheGet(searchId: string) {
    return searchCache.get(searchId);
  },
};
