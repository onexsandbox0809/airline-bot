import { env } from '../config/env';
import { resolveRelativeDate } from '../utils/date-utils';
import { EXTRACTION_INSTRUCTIONS } from './prompts';
import { ExtractedEntities, Intent, REQUIRED_FIELDS, StructuredIntent } from './intents';

// City / common alias -> IATA-ish code map. Extend as more airports are seeded.
const CITY_CODE_MAP: Record<string, string> = {
  delhi: 'DEL', newdelhi: 'DEL', del: 'DEL',
  mumbai: 'BOM', bombay: 'BOM', bom: 'BOM',
  chennai: 'MAA', madras: 'MAA', maa: 'MAA',
  bangalore: 'BLR', bengaluru: 'BLR', blr: 'BLR',
  pune: 'PNQ', pnq: 'PNQ',
  kolkata: 'CCU', calcutta: 'CCU', ccu: 'CCU',
  dubai: 'DXB', dxb: 'DXB',
  singapore: 'SIN', sin: 'SIN',
};

function normalize(word: string): string {
  return word.toLowerCase().replace(/[^a-z]/g, '');
}

function findCityCodes(text: string): string[] {
  const found: string[] = [];
  const words = text.toLowerCase().split(/\s+/);
  // check bigrams first (e.g. "new delhi") then unigrams
  for (let i = 0; i < words.length; i++) {
    const bigram = normalize(words[i] + (words[i + 1] || ''));
    if (CITY_CODE_MAP[bigram]) {
      found.push(CITY_CODE_MAP[bigram]);
      i++;
      continue;
    }
    const uni = normalize(words[i]);
    if (CITY_CODE_MAP[uni]) found.push(CITY_CODE_MAP[uni]);
  }
  return found;
}

function detectIntentRuleBased(message: string): Intent {
  const m = message.toLowerCase();
  if (/\b(hi|hello|hey|good morning|good evening)\b/.test(m)) return 'GREETING';
  if (/\b(help|what can you do|options)\b/.test(m)) return 'HELP';
  if (/\bcheck[\s-]?in\b/.test(m) || /\bcheck\b.{0,15}\bin\b/.test(m)) return 'CHECK_IN';
  if (/\b(cancel)\b/.test(m)) return 'CANCEL_BOOKING';
  if (/\b(history|previous bookings?|past bookings?|my bookings?|booked before|bookings? i have|coming up)\b/.test(m)) return 'BOOKING_HISTORY';
  if (/\bpnr\b|\bbooking (id|reference|details)\b|\bstatus of my (booking|flight)\b/.test(m)) return 'BOOKING_DETAILS';
  if (/\bbook\b|\breserve\b|\bconfirm (the|this) flight\b/.test(m)) return 'BOOK_FLIGHT';
  if (/\bshow\b.*\bflight/.test(m) && /\b(option|again|those|them)\b/.test(m)) return 'SHOW_FLIGHTS';
  if (/\b(fly|flight|flights|travel|search)\b/.test(m)) return 'SEARCH_FLIGHT';
  return 'UNKNOWN';
}

function extractPassengers(message: string): number | null {
  const m = message.match(/(\d+)\s*(passenger|people|person|adults?|pax)/i);
  if (m) return parseInt(m[1], 10);
  if (/\b(a|one)\s+(passenger|person|adult)\b/i.test(message)) return 1;
  return null;
}

function extractCabinClass(message: string): ExtractedEntities['cabinClass'] {
  const m = message.toLowerCase();
  if (/business/.test(m)) return 'BUSINESS';
  if (/first class/.test(m)) return 'FIRST';
  if (/premium economy/.test(m)) return 'PREMIUM_ECONOMY';
  if (/economy/.test(m)) return 'ECONOMY';
  return null;
}

function extractOrdinal(message: string): number | null {
  const m = message.toLowerCase();
  if (/\bfirst\b|\b1st\b|\bone\b(?!\s*(passenger|person))/.test(m)) return 1;
  if (/\bsecond\b|\b2nd\b/.test(m)) return 2;
  if (/\bthird\b|\b3rd\b/.test(m)) return 3;
  const digitMatch = m.match(/\bflight\s*#?(\d+)\b/);
  if (digitMatch) return parseInt(digitMatch[1], 10);
  return null;
}

function extractPnr(message: string): string | null {
  const m = message.match(/\b([A-Z0-9]{6})\b/);
  return m ? m[1] : null;
}

function extractEmail(message: string): string | null {
  const m = message.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  return m ? m[0] : null;
}

function extractPhone(message: string): string | null {
  const m = message.match(/(\+?\d[\d\s-]{8,14}\d)/);
  return m ? m[0].replace(/\s|-/g, '') : null;
}

function extractName(message: string): { firstName: string | null; lastName: string | null } {
  // Only trust a bare "Firstname Lastname" style message (2-3 capitalized-looking words)
  const trimmed = message.trim();
  const words = trimmed.split(/\s+/);
  if (words.length >= 2 && words.length <= 3 && words.every((w) => /^[A-Za-z'-]+$/.test(w))) {
    return { firstName: words[0], lastName: words[words.length - 1] };
  }
  return { firstName: null, lastName: null };
}

/** Rule-based fallback extraction. Always runs; used directly if no OPENAI_API_KEY,
 *  otherwise used to sanity-check/backfill the LLM's output. */
export function ruleBasedExtract(message: string, priorContext?: Partial<ExtractedEntities>): StructuredIntent {
  const intent = detectIntentRuleBased(message);
  const codes = findCityCodes(message);

  const entities: ExtractedEntities = {
    origin: priorContext?.origin ?? null,
    destination: priorContext?.destination ?? null,
    departureDate: priorContext?.departureDate ?? null,
    returnDate: priorContext?.returnDate ?? null,
    passengers: priorContext?.passengers ?? null,
    cabinClass: priorContext?.cabinClass ?? null,
    tripType: priorContext?.tripType ?? 'ONE_WAY',
    flightOrdinal: null,
    pnr: null,
    lastName: null,
    firstName: null,
    email: null,
    phone: null,
    dateOfBirth: null,
    bookingStatus: null,
  };

  // "from X to Y" pattern takes priority for origin/destination ordering
  const fromToMatch = message.toLowerCase().match(/from\s+([a-z\s]+?)\s+to\s+([a-z\s]+?)(\s|$|,|\.|on|tomorrow|for)/);
  if (fromToMatch) {
    const originCodes = findCityCodes(fromToMatch[1]);
    const destCodes = findCityCodes(fromToMatch[2]);
    if (originCodes[0]) entities.origin = originCodes[0];
    if (destCodes[0]) entities.destination = destCodes[0];
  } else if (/\bto\s+([a-z]+)/i.test(message) && codes.length === 1) {
    entities.destination = codes[0];
  } else if (codes.length >= 2) {
    entities.origin = codes[0];
    entities.destination = codes[1];
  } else if (codes.length === 1 && !entities.origin && !entities.destination) {
    entities.destination = codes[0];
  }

  const dateStr = resolveRelativeDate(message);
  if (dateStr) entities.departureDate = dateStr;

  const passengers = extractPassengers(message);
  if (passengers) entities.passengers = passengers;

  const cabin = extractCabinClass(message);
  if (cabin) entities.cabinClass = cabin;

  if (/round[\s-]?trip|return flight/i.test(message)) entities.tripType = 'ROUND_TRIP';
  if (/one[\s-]?way/i.test(message)) entities.tripType = 'ONE_WAY';

  entities.flightOrdinal = extractOrdinal(message);
  entities.pnr = extractPnr(message);
  entities.email = extractEmail(message);
  entities.phone = extractPhone(message);

  if (intent === 'BOOK_FLIGHT' || intent === 'CHECK_IN') {
    const { firstName, lastName } = extractName(message);
    entities.firstName = firstName;
    entities.lastName = lastName;
  }

  const requiredFields = REQUIRED_FIELDS[intent] || [];
  const missingFields = requiredFields.filter((f) => !entities[f]);

  return { intent, entities, missingFields };
}

/** Uses OpenAI's chat completions API for higher-quality extraction when configured.
 *  Falls back to rule-based extraction on any error or missing API key. */
export async function extractStructuredIntent(
  message: string,
  conversationHistory: { role: string; content: string }[],
  priorContext?: Partial<ExtractedEntities>,
): Promise<StructuredIntent> {
  const fallback = ruleBasedExtract(message, priorContext);

  if (!env.openaiApiKey) {
    return fallback;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: env.openaiModel,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: EXTRACTION_INSTRUCTIONS },
          ...conversationHistory.slice(-8),
          {
            role: 'user',
            content: `Known context so far: ${JSON.stringify(priorContext || {})}\nLatest message: ${message}`,
          },
        ],
      }),
    });

    if (!response.ok) return fallback;

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return fallback;

    const parsed = JSON.parse(content) as StructuredIntent;
    // Merge: prefer LLM values, backfill with rule-based where LLM left nulls
    const merged: StructuredIntent = {
      intent: parsed.intent || fallback.intent,
      entities: { ...fallback.entities, ...stripNulls(parsed.entities) },
      missingFields: [],
    };
    const requiredFields = REQUIRED_FIELDS[merged.intent] || [];
    merged.missingFields = requiredFields.filter((f) => !merged.entities[f]);
    return merged;
  } catch {
    return fallback;
  }
}

function stripNulls(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v !== null && v !== undefined) out[k] = v;
  }
  return out;
}
