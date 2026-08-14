export const INTENTS = [
  'SEARCH_FLIGHT',
  'SHOW_FLIGHTS',
  'BOOK_FLIGHT',
  'BOOKING_DETAILS',
  'BOOKING_HISTORY',
  'CHECK_IN',
  'CANCEL_BOOKING',
  'HELP',
  'GREETING',
  'UNKNOWN',
] as const;

export type Intent = (typeof INTENTS)[number];

export interface ExtractedEntities {
  origin?: string | null;
  destination?: string | null;
  departureDate?: string | null;
  returnDate?: string | null;
  passengers?: number | null;
  cabinClass?: string | null;
  tripType?: 'ONE_WAY' | 'ROUND_TRIP' | null;
  flightOrdinal?: number | null; // "the first one", "second flight"
  pnr?: string | null;
  lastName?: string | null;
  firstName?: string | null;
  email?: string | null;
  phone?: string | null;
  dateOfBirth?: string | null;
  bookingStatus?: string | null;
}

export interface StructuredIntent {
  intent: Intent;
  entities: ExtractedEntities;
  missingFields: string[];
}

export const REQUIRED_FIELDS: Partial<Record<Intent, (keyof ExtractedEntities)[]>> = {
  SEARCH_FLIGHT: ['origin', 'destination', 'departureDate'],
  BOOK_FLIGHT: ['firstName', 'lastName', 'email', 'phone'],
  CHECK_IN: ['pnr', 'lastName'],
  BOOKING_DETAILS: ['pnr'],
};
