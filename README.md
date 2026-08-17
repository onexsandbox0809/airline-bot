# Airline Bot — Backend API (Demo)

A demo backend for an airline bot: flight search, dynamic fares, booking with PNR
generation, booking history, web check-in, and boarding passes — over a mock
airline inventory.

**Stack:** Plain JavaScript (CommonJS, no TypeScript, no Node.js framework like
Express) running as **Vercel serverless functions**, backed by a **Supabase
Postgres** database accessed via the `@supabase/supabase-js` client with the
service-role key.

> **Note on scope, read this first:** This is a demo build, so a few choices
> were made deliberately simple:
> - **No authentication.** Every endpoint is open — there's no JWT, no login
>   wall. `userId` is passed directly in requests. Don't put real user data in
>   this deployment.
> - **No Prisma / TypeScript / Node framework.** Just plain `.js` files using
>   the Supabase client directly — no ORM, no build step.
> - **Mock inventory & mock payment.** Flights, fares, and seat inventory are
>   seeded fake data. Payment is simulated (`PAID` instantly) — no Razorpay/
>   Stripe integration, but the payment logic is isolated in one file so a
>   real gateway can be dropped in later.
> - **AI bot integration is *not* implemented** in this deliverable — this repo
>   is the backend API surface only. It's designed so a chatbot/agent layer
>   (or anything else) can call it later.

---

## 1. Architecture

```
Client / Bot
     │
     ▼
Vercel Serverless Functions (plain JS, file-based routing under /api)
     │
     ▼
Supabase Postgres (service-role key, no RLS enforcement in this demo)
```

Each file under `api/` is one HTTP endpoint (Vercel's file-based routing).
Shared logic lives in `lib/`:

| File | Responsibility |
|---|---|
| `lib/supabase.js` | Supabase client, initialized once from env vars |
| `lib/pricingService.js` | All fare math (seat-scarcity surcharge, totals) |
| `lib/pnrService.js` | Unique 6-character PNR generation |
| `lib/paymentService.js` | Mock payment charge/refund — swap for a real gateway later |
| `lib/validate.js` | Small input-sanity helpers (dates, cabin class, passenger count) |
| `lib/response.js` | Standard `{ success, message, data }` / error response shape |

Routes/airports live in the database (`airports`, `routes` tables) rather than
being hardcoded, so new destinations can be added with an `INSERT`, not a code
change. A real GDS integration later would replace the Supabase queries inside
the flight-search/booking handlers without changing the request/response
contracts the bot (or any client) depends on.

---

## 2. Technology Stack

- **Runtime:** Node.js 18+ (Vercel serverless function runtime) — but the
  code itself is plain JavaScript, not a hand-rolled Node/Express server.
- **Database:** Supabase (managed Postgres)
- **DB access:** `@supabase/supabase-js` (service-role key, server-side only)
- **Hosting:** Vercel
- **No build step** — deploy the `.js` files as-is.

---

## 3. Project Structure

```
airline-bot-backend/
├── api/
│   ├── health.js
│   ├── users/
│   │   └── index.js                    # GET (list) / POST (create) — helper, no auth
│   ├── flights/
│   │   ├── search.js                   # GET  /api/flights/search
│   │   └── [id].js                     # GET  /api/flights/:id
│   ├── bookings/
│   │   ├── index.js                    # POST /api/bookings
│   │   ├── [pnr].js                    # GET  /api/bookings/:pnr
│   │   ├── [pnr]/
│   │   │   └── cancel.js               # POST /api/bookings/:pnr/cancel
│   │   └── history/
│   │       └── [userId].js             # GET  /api/bookings/history/:userId
│   └── checkin/
│       ├── index.js                    # POST /api/checkin
│       └── [pnr]/
│           └── boarding-pass.js        # GET  /api/checkin/:pnr/boarding-pass
├── lib/
│   ├── supabase.js
│   ├── pricingService.js
│   ├── pnrService.js
│   ├── paymentService.js
│   ├── validate.js
│   └── response.js
├── db/
│   ├── schema.sql                      # run first
│   └── seed.sql                        # run second (dummy data)
├── tests/
│   ├── pricingService.test.js
│   ├── pnrService.test.js
│   └── validate.test.js
├── postman/
│   └── Airline-Bot-API.postman_collection.json
├── package.json
├── vercel.json
├── .env.example
└── README.md
```

---

## 4. Installation

```bash
git clone <your-repo-url>
cd airline-bot-backend
npm install
```

## 5. Environment Configuration

Copy `.env.example` to `.env` and fill in your Supabase project's values
(Supabase dashboard → Project Settings → API):

```bash
cp .env.example .env
```

```env
SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.YOUR-PROJECT-REF.supabase.co:5432/postgres
NODE_ENV=development
```

⚠️ The **service-role key** bypasses Row Level Security and must never be
shipped to a browser/frontend — it's only read server-side in `lib/supabase.js`.

## 6. Database Setup (Supabase)

No Prisma — just run the SQL directly.

1. Open your Supabase project → **SQL Editor**.
2. Paste and run `db/schema.sql` (creates all tables, constraints, indexes).
3. Paste and run `db/seed.sql` (inserts dummy data: airports, routes, ~8 users,
   ~800+ flights across the next 20 days with Economy + Business inventory,
   and two sample bookings — one confirmed, one cancelled).

Or via `psql` using `DATABASE_URL` from your `.env`:

```bash
psql "$DATABASE_URL" -f db/schema.sql
psql "$DATABASE_URL" -f db/seed.sql
```

## 7. Run Locally

```bash
npm run dev
```

This uses the Vercel CLI (`vercel dev`) to emulate the serverless routing
locally, reading env vars from `.env`. The API will be available at
`http://localhost:3000`.

```bash
curl http://localhost:3000/api/health
```

## 8. Deploy to Vercel

```bash
npm i -g vercel
vercel login
vercel link
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel --prod
```

(Or connect the GitHub repo in the Vercel dashboard and set the same two env
vars under Project Settings → Environment Variables — same effect, no CLI
needed.)

---

## 9. API Reference

Base response shape:

```json
{ "success": true, "message": "...", "data": { } }
```

```json
{ "success": false, "message": "...", "error": { "code": "...", "details": "..." } }
```

### Health
`GET /api/health`

### Users (helper endpoints — no auth in this demo)
`GET /api/users` — list demo users (grab an `id` to use as `userId`)
`POST /api/users` — `{ "name": "...", "email": "...", "phone": "..." }`

### Flight Search
`GET /api/flights/search?origin=DEL&destination=BOM&departureDate=2026-09-15&passengers=1&cabinClass=ECONOMY`

Optional: `returnDate`, `tripType=ROUND_TRIP` (returns `{ outbound: [...], return: [...] }` instead of a flat array).

Validates: origin/destination exist, aren't equal, route is supported, date isn't in the past, passenger count 1–9, cabin class is ECONOMY or BUSINESS.

### Flight Details
`GET /api/flights/:id`

### Create Booking
`POST /api/bookings`
```json
{
  "flightId": "uuid",
  "userId": "uuid",
  "cabinClass": "ECONOMY",
  "passengers": [
    { "firstName": "Puneet", "lastName": "Bhargava", "dateOfBirth": "1990-01-01",
      "gender": "MALE", "email": "user@example.com", "phone": "+919999999999", "passportNumber": null }
  ]
}
```
Validates flight & user exist, seats available, reserves seats (with a
guarded update so two simultaneous bookings can't oversell), simulates
payment, generates a unique PNR, stores the fare actually charged (so later
pricing changes never alter historical bookings).

### Get Booking by PNR
`GET /api/bookings/:pnr` → 404 if not found.

### Booking History
`GET /api/bookings/history/:userId?status=CONFIRMED&fromDate=2026-09-01&toDate=2026-09-30&destination=BOM&page=1&limit=10`

### Cancel Booking
`POST /api/bookings/:pnr/cancel` — blocks cancelling an already-cancelled
booking or one whose flight has already departed; releases seat inventory.

### Web Check-in
`POST /api/checkin`
```json
{ "pnr": "A7K9PL", "lastName": "Bhargava" }
```
Check-in window: opens 48h before departure, closes 1h before departure.
Blocks: cancelled bookings, already-checked-in passengers, wrong last name,
flights outside the check-in window.

### Boarding Pass
`GET /api/checkin/:pnr/boarding-pass` — 404 until check-in is completed.

---

## 10. Sample End-to-End Flow

```bash
BASE=http://localhost:3000

# 1. Grab a demo user id
curl "$BASE/api/users"

# 2. Search flights
curl "$BASE/api/flights/search?origin=DEL&destination=BOM&departureDate=2026-09-20&passengers=1&cabinClass=ECONOMY"

# 3. Book (use a flightId from step 2 and userId from step 1)
curl -X POST "$BASE/api/bookings" \
  -H "Content-Type: application/json" \
  -d '{"flightId":"<flight-id>","userId":"<user-id>","cabinClass":"ECONOMY","passengers":[{"firstName":"Puneet","lastName":"Bhargava","dateOfBirth":"1990-01-01","gender":"MALE"}]}'

# 4. Retrieve by PNR
curl "$BASE/api/bookings/<PNR>"

# 5. Booking history
curl "$BASE/api/bookings/history/<user-id>"

# 6. Web check-in
curl -X POST "$BASE/api/checkin" -H "Content-Type: application/json" \
  -d '{"pnr":"<PNR>","lastName":"Bhargava"}'

# 7. Boarding pass
curl "$BASE/api/checkin/<PNR>/boarding-pass"

# 8. Cancel
curl -X POST "$BASE/api/bookings/<PNR>/cancel"
```

A ready-to-import Postman collection covering this exact flow is at
`postman/Airline-Bot-API.postman_collection.json`.

Note: the seeded flight dates start "tomorrow" relative to when you run
`seed.sql`, since check-in only opens within 48h of departure and the demo
data needs to stay bookable. Adjust dates in your search calls accordingly.

---

## 11. Tests

No DB connection needed — these test the pure business logic (pricing math,
PNR format, input validation):

```bash
node tests/pricingService.test.js
node tests/pnrService.test.js
node tests/validate.test.js
```

---

## 12. AI/Bot Tool Mapping (for future integration)

This repo does not include a chatbot layer, but each endpoint maps cleanly to
a tool an AI agent could call:

| Tool | Endpoint |
|---|---|
| `search_flights` | `GET /api/flights/search` |
| `get_flight_details` | `GET /api/flights/:id` |
| `create_booking` | `POST /api/bookings` |
| `get_booking` | `GET /api/bookings/:pnr` |
| `get_booking_history` | `GET /api/bookings/history/:userId` |
| `cancel_booking` | `POST /api/bookings/:pnr/cancel` |
| `web_checkin` | `POST /api/checkin` |
| `get_boarding_pass` | `GET /api/checkin/:pnr/boarding-pass` |

Whatever agent framework calls these should still require **explicit user
confirmation** before calling `create_booking` — that's a conversation-layer
rule, not something the API itself can enforce structurally, since the API
has no way to know whether "confirmation" happened upstream.

---

## 13. Known Simplifications (be aware before using this beyond a demo)

- No authentication/authorization — anyone with the URL can read or write
  any booking. Fine for a local demo, not for production.
- No rate limiting, no request logging middleware, no centralized error
  logging service.
- Concurrency control on seat inventory uses a single guarded `UPDATE ...
  WHERE available_seats >= N`, not a DB transaction — good enough for a demo,
  but a real system should wrap booking creation in a Postgres transaction /
  RPC function.
- Gate numbers on boarding passes are derived deterministically from the
  flight id (there's no real gate-assignment system behind this demo).
- Timezone fields exist on `airports` but flight times are stored as local
  `date`/`time` without offset math applied — fine for a single-country demo,
  worth revisiting before spanning more time zones for real.
