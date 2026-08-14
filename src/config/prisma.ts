import { PrismaClient } from '@prisma/client';

// Prevent exhausting DB connections during Vercel serverless cold starts / hot reload
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

if (!process.env.DATABASE_URL) {
  // Thrown here (not in config/env.ts) so that modules which only need other
  // env values — like the NLU parser, which just reads OPENAI_API_KEY — can
  // still be imported and unit-tested without a database configured.
  throw new Error(
    'Missing required environment variable: DATABASE_URL. Set it in your .env file ' +
      '(see .env.example) to your Supabase/Postgres connection string.',
  );
}

export const prisma =
  global.__prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}
