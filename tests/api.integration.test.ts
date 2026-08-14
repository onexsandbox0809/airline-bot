import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

// These tests hit a real database via Prisma, so they only run when DATABASE_URL
// is configured (e.g. against a Supabase test project or local Postgres that has
// been migrated + seeded). They are skipped automatically otherwise so `npm test`
// still passes in environments without a DB (e.g. a bare CI checkout).
const hasDb = !!process.env.DATABASE_URL;
const d = hasDb ? describe : describe.skip;

d('API integration', () => {
  let app: any;
  let token: string;
  const email = `test-${Date.now()}@example.com`;

  beforeAll(async () => {
    const { createApp } = await import('../src/app');
    app = createApp();
  });

  it('registers a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email, password: 'Passw0rd!' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    token = res.body.token;
  });

  it('rejects flight search with a past date', async () => {
    const res = await request(app)
      .post('/api/flights/search')
      .send({ origin: 'DEL', destination: 'BOM', departureDate: '2020-01-01' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
  });

  it('rejects flight search for an unknown airport', async () => {
    const res = await request(app)
      .post('/api/flights/search')
      .send({ origin: 'DEL', destination: 'ZZZ', departureDate: '2026-09-01' });
    expect(res.status).toBe(400);
  });

  it('searches flights for a seeded route', async () => {
    const res = await request(app)
      .post('/api/flights/search')
      .send({ origin: 'DEL', destination: 'BOM', departureDate: '2026-09-01' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.flights)).toBe(true);
  });

  it('requires auth for booking history', async () => {
    const res = await request(app).get('/api/bookings/history');
    expect(res.status).toBe(401);
  });

  it('returns empty booking history for a fresh user', async () => {
    const res = await request(app)
      .get('/api/bookings/history')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.bookings).toEqual([]);
  });

  it('rejects check-in with an invalid PNR', async () => {
    const res = await request(app)
      .post('/api/checkin')
      .set('Authorization', `Bearer ${token}`)
      .send({ pnr: 'ZZZZZZ', lastName: 'Nobody' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('INVALID_PNR');
  });

  it('handles a full chat search flow', async () => {
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Show me flights from Delhi to Mumbai on 1 September', sessionId: `sess-${Date.now()}` });
    expect(res.status).toBe(200);
    expect(res.body.intent).toBe('SEARCH_FLIGHT');
  });
});
