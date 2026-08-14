# AI Airline Booking Bot — Backend API

Production-ready, API-first backend for an AI-powered airline booking chatbot.
Built with Express + TypeScript + Prisma, designed to run on **Supabase**
(Postgres) and deploy to **Vercel** as serverless functions, and to plug into
any conversational channel (WhatsApp, web chat, mobile) via `POST /api/chat`.

## Architecture

```
User → /api/chat → Conversation Manager → NLU (rule-based, optional LLM)
     → Structured Intent JSON → Business Logic Services
     → Mock Airline Provider (swappable) → Database
     → Response Formatter → Natural-language reply
```

Key design decisions:

- **AI layer is fully decoupled from business logic.** `src/ai/*` only ever
  calls into `src/services/*`; it never touches Prisma directly. The LLM
  cannot invent prices, PNRs, or booking confirmations — those only ever come
  from the business logic layer after a real DB operation.
- **Airline inventory sits behind an interface** (`AirlineProvider` in
  `src/providers/airline-provider.interface.ts`). The MVP ships a
  `MockAirlineProvider` reading seeded data; swapping in Amadeus/Sabre/
  Travelport/a real airline API later means writing one new class and
  changing one line in `flight.service.ts` — nothing else changes.
- **NLU works with zero external dependencies.** `src/ai/parser.ts` has a
  rule-based extractor that handles all example scenarios in the spec
  (city names, "tomorrow", "20 August", passenger counts, ordinals like "the
  first one", PNRs, emails, phone numbers). If `OPENAI_API_KEY` is set, it
  additionally calls OpenAI for higher-quality extraction and merges results,
  falling back to the rule-based parser on any failure.

## Project structure

```
src/
├── controllers/     # HTTP request/response handling
├── services/         # Business logic (DB transactions, validation)
├── ai/                # NLU parser, conversation manager, prompts, orchestration
├── providers/         # AirlineProvider interface + mock implementation
├── middleware/        # auth (JWT), error handling, validation
├── routes/            # Express routers
├── utils/             # PNR generator, date utils, response/error helpers
├── config/            # env.ts, prisma.ts (singleton client)
├── app.ts             # Express app assembly (used by both server.ts and api/index.ts)
└── server.ts           # Local dev entrypoint
api/
└── index.ts            # Vercel serverless entrypoint (wraps the same Express app)
prisma/
├── schema.prisma        # Full DB schema
└── seed.ts               # Seeds airports + ~60 days of flights across all routes
tests/                    # Unit tests (no DB) + integration tests (require DB)
openapi.yaml               # Swagger/OpenAPI spec, served at /api-docs
```

## Prerequisites

- Node.js 18+
- A Supabase account (free tier is enough)
- A GitHub account
- A Vercel account
- (Optional) An OpenAI API key, for LLM-backed NLU instead of the built-in
  rule-based parser

---

## 1. Push this project to GitHub

```bash
cd airline-bot
git init
git add .
git commit -m "Initial commit: AI airline booking bot backend"
gh repo create airline-booking-bot --private --source=. --remote=origin --push
```

(No `gh` CLI? Create an empty repo on github.com, then:)

```bash
git remote add origin https://github.com/<your-username>/airline-booking-bot.git
git branch -M main
git push -u origin main
```

---

## 2. Set up Supabase

1. Go to [supabase.com](https://supabase.com) → **New project**. Pick a name,
   database password (save it), and region.
2. Once provisioned, go to **Project Settings → Database → Connection string**.
3. Copy **two** connection strings:
   - **Connection pooling** (port `6543`, `?pgbouncer=true`) → this is your
     `DATABASE_URL` (used by the running app — serverless needs pooling).
   - **Direct connection** (port `5432`) → this is your `DIRECT_URL` (used
     only by `prisma migrate` to run schema changes).
4. Create `.env` locally from the template:
   ```bash
   cp .env.example .env
   ```
   Fill in `DATABASE_URL`, `DIRECT_URL`, and generate a `JWT_SECRET`:
   ```bash
   openssl rand -base64 48
   ```
5. Install dependencies and push the schema:
   ```bash
   npm install
   npx prisma generate
   npx prisma migrate dev --name init
   npm run prisma:seed
   ```
   This creates all tables (`users`, `airports`, `flights`, `bookings`,
   `passengers`, `checkins`, `chat_sessions`, `chat_messages`) and seeds 8
   airports (Delhi, Mumbai, Chennai, Bangalore, Pune, Kolkata, Dubai,
   Singapore) plus flights across every valid route pair for the next ~60
   days with varied pricing.
6. Verify in Supabase's **Table Editor** that `flights` has thousands of rows.

To add more airports/routes later: insert a row into `airports`, add its
route pricing in `prisma/seed.ts`'s `BASE_FARES` map, and re-run the seed (or
insert `flights` rows directly — the schema has no hardcoded airport list).

---

## 3. Run locally

```bash
npm run dev
```

- API: `http://localhost:3000`
- Swagger docs: `http://localhost:3000/api-docs`
- Health check: `http://localhost:3000/health`

Try it:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Puneet Bhargava","email":"puneet@example.com","password":"Passw0rd!"}'

curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"I want to fly from Delhi to Dubai tomorrow","sessionId":"sess-1"}'
```

---

## 4. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New → Project** → import
   the GitHub repo you pushed in step 1.
2. Vercel will detect `vercel.json` (routes all traffic to `api/index.ts`,
   which wraps the same Express app used locally).
3. Under **Environment Variables**, add (Production + Preview):
   ```
   DATABASE_URL      = <Supabase pooled connection string>
   DIRECT_URL        = <Supabase direct connection string>
   JWT_SECRET         = <same value you generated earlier>
   JWT_EXPIRES_IN      = 7d
   OPENAI_API_KEY       = <optional>
   OPENAI_MODEL          = gpt-4o-mini
   CHECKIN_OPENS_HOURS_BEFORE  = 48
   CHECKIN_CLOSES_HOURS_BEFORE = 2
   NODE_ENV                     = production
   ```
4. Build command is already set via `vercel-build` in `package.json`
   (`prisma generate && prisma migrate deploy && tsc`) — this applies any
   pending migrations on every deploy, so keep `DIRECT_URL` set in Vercel too.
5. Deploy. Once live, your API is at `https://<your-project>.vercel.app/api/...`
   and Swagger docs at `https://<your-project>.vercel.app/api-docs`.

**Note on serverless + Postgres connections:** Supabase's connection pooler
(`pgbouncer=true`, port 6543) is required for Vercel because each serverless
invocation can open a new connection; the direct port-5432 URL would exhaust
Postgres's connection limit under load. `src/config/prisma.ts` also reuses a
single `PrismaClient` per warm serverless instance to minimize this further.

---

## 5. Postman collection

Import `postman/airline-bot.postman_collection.json` into Postman. It
includes every endpoint with example bodies and a `{{baseUrl}}` /
`{{token}}` variable pair — set `baseUrl` to `http://localhost:3000` or your
Vercel URL, run **Register** or **Login** first, and the token auto-populates
via a test script for subsequent requests.

---

## 6. Testing

```bash
npm test
```

- `tests/parser.test.ts`, `tests/pnr-generator.test.ts`, `tests/date-utils.test.ts`
  run with no external dependencies.
- `tests/api.integration.test.ts` runs against a real, migrated + seeded
  database — it auto-skips if `DATABASE_URL` isn't set, so `npm test` is
  always safe to run, but for full coverage point it at a disposable Supabase
  project or local Postgres:
  ```bash
  DATABASE_URL=<test-db-url> npm test
  ```

---

## API summary

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | – | Create account, returns JWT |
| POST | `/api/auth/login` | – | Login, returns JWT |
| GET | `/api/auth/me` | ✅ | Current user |
| POST | `/api/flights/search` | – | Search flights |
| GET | `/api/flights/:id` | – | Get a flight |
| POST | `/api/bookings` | ✅ | Create booking, generates PNR |
| GET | `/api/bookings/:bookingId` | ✅ | Get booking by booking ID |
| GET | `/api/bookings/pnr/:pnr` | ✅ | Get booking by PNR |
| GET | `/api/bookings/history` | ✅ | Booking history (filters: status, fromDate, toDate, destination) |
| POST | `/api/checkin` | ✅ | Web check-in |
| POST | `/api/chat` | optional | Main conversational endpoint |

All error responses follow: `{ "success": false, "error": { "code", "message" } }`
with the codes listed in the spec (`FLIGHT_NOT_FOUND`, `NO_SEATS_AVAILABLE`,
`INVALID_PNR`, `CHECKIN_CLOSED`, etc.).

## Known MVP scope notes

- `CANCEL_BOOKING` intent is recognized by the NLU but the cancellation flow
  itself isn't implemented yet (booking status enum and DB support it — the
  service method is the next piece to add).
- Flight-search results are cached in-memory per `searchId` for ordinal
  resolution ("book the first one"). Fine for a single Vercel region/instance
  at MVP scale; swap for Redis if you need this to work reliably across many
  concurrent serverless instances.
- Seed data samples flights every 3rd day (not literally every single day)
  across all 56 valid route pairs to keep seed volume reasonable — still
  thousands of realistic, varied-price flights for testing.
