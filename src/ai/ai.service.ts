import { conversationManager, SessionState } from './conversation-manager';
import { extractStructuredIntent } from './parser';
import { flightService } from '../services/flight.service';
import { bookingService } from '../services/booking.service';
import { checkinService } from '../services/checkin.service';
import { ApiError } from '../utils/errors';
import { Intent } from './intents';

export interface ChatRequest {
  userId?: string;
  message: string;
  sessionId: string;
}

export interface ChatResponse {
  sessionId: string;
  intent: Intent;
  response: string;
  data?: Record<string, any>;
}

function fmtPrice(amount: number, currency: string) {
  return `${currency === 'INR' ? '₹' : currency + ' '}${Number(amount).toLocaleString('en-IN')}`;
}

function askFor(field: string): string {
  const prompts: Record<string, string> = {
    origin: 'Where will you be flying from?',
    destination: 'Where would you like to fly to?',
    departureDate: 'What date would you like to travel?',
    firstName: "Please share the passenger's first name.",
    lastName: "Please share the passenger's last name.",
    email: "What's the passenger's email address?",
    phone: "What's the passenger's mobile number?",
    pnr: 'Could you share your booking PNR?',
  };
  return prompts[field] || `Could you provide ${field}?`;
}

export const aiService = {
  async chat(req: ChatRequest): Promise<ChatResponse> {
    const session = await conversationManager.getOrCreateSession(req.sessionId, req.userId);
    const state = conversationManager.getState(session);
    const history = await conversationManager.getRecentMessages(session.id);

    await conversationManager.recordMessage(session.id, 'USER', req.message);

    const structured = await extractStructuredIntent(req.message, history, state);
    let { intent, entities, missingFields } = structured;

    // Merge newly extracted entities into persisted session state (slot filling)
    const merged: SessionState = { ...state };
    for (const [k, v] of Object.entries(entities)) {
      if (v !== null && v !== undefined) (merged as any)[k] = v;
    }

    // If we were mid-flow on a prior intent and this message doesn't clearly
    // start a new one, keep resolving the pending intent.
    if (intent === 'UNKNOWN' && state.pendingIntent) {
      intent = state.pendingIntent as Intent;
    }

    let response = '';
    let data: Record<string, any> | undefined;

    try {
      switch (intent) {
        case 'GREETING': {
          response = "Hi! I'm your airline booking assistant. I can search flights, book tickets, check booking status, show your booking history, or help you check in. What would you like to do?";
          break;
        }

        case 'HELP': {
          response =
            'I can help you: search flights, book a flight, check a booking (PNR), see your booking history, or complete web check-in. Just tell me what you need — e.g. "Show flights from Delhi to Dubai tomorrow".';
          break;
        }

        case 'SEARCH_FLIGHT':
        case 'SHOW_FLIGHTS': {
          const needed = ['origin', 'destination', 'departureDate'].filter((f) => !(merged as any)[f]);
          if (needed.length > 0) {
            merged.pendingIntent = 'SEARCH_FLIGHT';
            response = askFor(needed[0]);
            missingFields = needed;
            break;
          }

          const result = await flightService.searchFlights({
            origin: merged.origin!,
            destination: merged.destination!,
            departureDate: merged.departureDate!,
            passengers: merged.passengers || 1,
            cabinClass: merged.cabinClass || undefined,
          });

          merged.lastSearchId = result.searchId;
          merged.pendingIntent = null;
          data = { searchId: result.searchId, flightCount: result.flights.length, flights: result.flights };

          if (result.flights.length === 0) {
            response = `I couldn't find any flights from ${merged.origin} to ${merged.destination} on ${merged.departureDate}. Would you like to try a different date?`;
          } else {
            const cheapest = result.flights[0];
            const lines = result.flights
              .slice(0, 5)
              .map((f, i) => `${i + 1}. ${f.flightNumber} — ${new Date(f.departureTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} — ${fmtPrice(f.price, f.currency)}`)
              .join('\n');
            response = `I found ${result.flights.length} flight${result.flights.length > 1 ? 's' : ''} from ${merged.origin} to ${merged.destination} on ${merged.departureDate}. Prices start from ${fmtPrice(cheapest.price, cheapest.currency)}.\n\n${lines}\n\nWhich flight would you like?`;
          }
          break;
        }

        case 'BOOK_FLIGHT': {
          if (!merged.selectedFlightId) {
            if (merged.flightOrdinal && merged.lastSearchId) {
              const flightId = flightService.resolveFromSearch(merged.lastSearchId, merged.flightOrdinal);
              if (flightId) merged.selectedFlightId = flightId;
            }
          }

          if (!merged.selectedFlightId) {
            merged.pendingIntent = 'BOOK_FLIGHT';
            response = 'Which flight would you like to book? You can say e.g. "the first one".';
            break;
          }

          const needed = ['firstName', 'lastName', 'email', 'phone'].filter((f) => !(merged as any)[f]);
          if (needed.length > 0) {
            merged.pendingIntent = 'BOOK_FLIGHT';
            response = askFor(needed[0]);
            missingFields = needed;
            break;
          }

          if (!req.userId) {
            response = 'To complete your booking, please sign in first.';
            break;
          }

          const booking = await bookingService.createBooking({
            userId: req.userId,
            flightId: merged.selectedFlightId,
            passenger: {
              firstName: merged.firstName!,
              lastName: merged.lastName!,
              email: merged.email!,
              phone: merged.phone!,
              dateOfBirth: merged.dateOfBirth || '1990-01-01',
            },
          });

          data = { bookingId: booking.bookingId, pnr: booking.pnr, status: booking.status };
          response = `Your booking is confirmed! 🎉\n\nPNR: ${booking.pnr}\nFlight: ${booking.flight.flightNumber}\n${booking.flight.originCode} → ${booking.flight.destinationCode}\nTotal: ${fmtPrice(Number(booking.totalAmount), booking.currency)}`;

          // reset flow
          merged.pendingIntent = null;
          merged.selectedFlightId = null;
          merged.firstName = null;
          merged.lastName = null;
          merged.email = null;
          merged.phone = null;
          break;
        }

        case 'BOOKING_DETAILS': {
          if (!merged.pnr) {
            merged.pendingIntent = 'BOOKING_DETAILS';
            response = askFor('pnr');
            missingFields = ['pnr'];
            break;
          }
          const booking = await bookingService.getByPnr(merged.pnr, req.userId);
          data = { booking };
          response = `Booking ${booking.pnr}: ${booking.flight.originCode} → ${booking.flight.destinationCode} on ${new Date(booking.flight.departureTime).toDateString()}. Status: ${booking.status}.`;
          merged.pendingIntent = null;
          merged.pnr = null;
          break;
        }

        case 'BOOKING_HISTORY': {
          if (!req.userId) {
            response = 'Please sign in to view your booking history.';
            break;
          }
          const bookings = await bookingService.getHistory(req.userId, {});
          data = { bookings };
          if (bookings.length === 0) {
            response = "You don't have any previous bookings yet.";
          } else {
            const lines = bookings
              .slice(0, 5)
              .map((b) => `• ${b.pnr}: ${b.flight.originCode} → ${b.flight.destinationCode} (${b.status})`)
              .join('\n');
            response = `Here are your recent bookings:\n\n${lines}`;
          }
          break;
        }

        case 'CHECK_IN': {
          const needed = ['pnr', 'lastName'].filter((f) => !(merged as any)[f]);
          if (needed.length > 0) {
            merged.pendingIntent = 'CHECK_IN';
            response = askFor(needed[0]);
            missingFields = needed;
            break;
          }
          const checkin = await checkinService.checkIn(merged.pnr!, merged.lastName!);
          data = { checkin };
          response = `You're checked in! ✈️\n\nSeat: ${checkin.seatNumber}\nBoarding pass: ${checkin.boardingPassId}`;
          merged.pendingIntent = null;
          merged.pnr = null;
          merged.lastName = null;
          break;
        }

        case 'CANCEL_BOOKING': {
          response = "Cancellations aren't available yet in this version — please contact support to cancel a booking.";
          break;
        }

        default: {
          response = "I'm not sure I understood that. I can search flights, book a flight, check a PNR, show booking history, or help with check-in. What would you like to do?";
        }
      }
    } catch (err) {
      if (err instanceof ApiError) {
        response = err.message;
      } else {
        response = 'Something went wrong on my end. Please try again in a moment.';
        throw err;
      }
    } finally {
      await conversationManager.updateState(session.id, merged);
      await conversationManager.recordMessage(session.id, 'ASSISTANT', response, intent, data);
    }

    return { sessionId: req.sessionId, intent, response, data: { ...data, missingFields } };
  },
};
