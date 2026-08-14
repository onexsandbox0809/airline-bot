import dotenv from 'dotenv';
dotenv.config();

// Intentionally does NOT throw at import time. Throwing here would break importing
// this module (and anything that transitively imports it, e.g. the NLU parser)
// in contexts where the DB/JWT aren't needed yet — including unit tests and
// serverless cold-start module loading. Instead, callers that truly require a
// value (prisma.ts, auth.service.ts) will fail loudly and specifically when
// that value is actually used and missing.
function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

export const env = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: optional('DATABASE_URL'),
  jwtSecret: optional('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  checkinOpensHoursBefore: parseInt(process.env.CHECKIN_OPENS_HOURS_BEFORE || '48', 10),
  checkinClosesHoursBefore: parseInt(process.env.CHECKIN_CLOSES_HOURS_BEFORE || '2', 10),
};
