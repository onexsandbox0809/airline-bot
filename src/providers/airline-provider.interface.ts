export interface FlightSearchRequest {
  origin: string;
  destination: string;
  departureDate: string; // YYYY-MM-DD
  returnDate?: string | null;
  passengers: number;
  cabinClass?: string;
}

export interface FlightDTO {
  flightId: string;
  airline: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  cabinClass: string;
  availableSeats: number;
  price: number;
  currency: string;
}

export interface BookingRequest {
  flightId: string;
  userId: string;
  passenger: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
  };
}

export interface CheckInRequest {
  pnr: string;
  lastName: string;
}

export interface CheckInResult {
  pnr: string;
  checkInStatus: 'COMPLETED';
  seat: string;
  boardingPassId: string;
}

/**
 * Any airline/GDS backend (mock, Amadeus, Sabre, Travelport, direct airline NDC API)
 * must implement this interface. The business logic layer only ever talks to this
 * interface, never to a concrete provider — swapping providers requires no changes
 * above this layer.
 */
export interface AirlineProvider {
  searchFlights(request: FlightSearchRequest): Promise<FlightDTO[]>;
  getFlight(flightId: string): Promise<FlightDTO | null>;
  checkAvailability(flightId: string, passengers: number): Promise<boolean>;
}
