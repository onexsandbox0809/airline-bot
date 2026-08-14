export type ErrorCode =
  | 'INVALID_REQUEST'
  | 'FLIGHT_NOT_FOUND'
  | 'NO_SEATS_AVAILABLE'
  | 'BOOKING_NOT_FOUND'
  | 'INVALID_PNR'
  | 'CHECKIN_NOT_AVAILABLE'
  | 'CHECKIN_CLOSED'
  | 'ALREADY_CHECKED_IN'
  | 'INVALID_PASSENGER'
  | 'UNAUTHORIZED'
  | 'DUPLICATE_BOOKING'
  | 'USER_EXISTS'
  | 'INVALID_CREDENTIALS'
  | 'INTERNAL_SERVER_ERROR';

export class ApiError extends Error {
  code: ErrorCode;
  statusCode: number;

  constructor(code: ErrorCode, message: string, statusCode = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export const Errors = {
  invalidRequest: (msg = 'The request is invalid.') => new ApiError('INVALID_REQUEST', msg, 400),
  flightNotFound: (msg = 'The selected flight is no longer available.') =>
    new ApiError('FLIGHT_NOT_FOUND', msg, 404),
  noSeats: (msg = 'No seats available for this flight.') =>
    new ApiError('NO_SEATS_AVAILABLE', msg, 409),
  bookingNotFound: (msg = 'Booking not found.') => new ApiError('BOOKING_NOT_FOUND', msg, 404),
  invalidPnr: (msg = 'Invalid PNR.') => new ApiError('INVALID_PNR', msg, 404),
  checkinNotAvailable: (msg = 'Check-in is not yet open for this flight.') =>
    new ApiError('CHECKIN_NOT_AVAILABLE', msg, 409),
  checkinClosed: (msg = 'Check-in has closed for this flight.') =>
    new ApiError('CHECKIN_CLOSED', msg, 409),
  alreadyCheckedIn: (msg = 'This booking is already checked in.') =>
    new ApiError('ALREADY_CHECKED_IN', msg, 409),
  invalidPassenger: (msg = 'Passenger details do not match this booking.') =>
    new ApiError('INVALID_PASSENGER', msg, 400),
  unauthorized: (msg = 'Unauthorized.') => new ApiError('UNAUTHORIZED', msg, 401),
  duplicateBooking: (msg = 'A booking for this flight already exists.') =>
    new ApiError('DUPLICATE_BOOKING', msg, 409),
  userExists: (msg = 'A user with this email already exists.') =>
    new ApiError('USER_EXISTS', msg, 409),
  invalidCredentials: (msg = 'Invalid email or password.') =>
    new ApiError('INVALID_CREDENTIALS', msg, 401),
  internal: (msg = 'Something went wrong.') => new ApiError('INTERNAL_SERVER_ERROR', msg, 500),
};
