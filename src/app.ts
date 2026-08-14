import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import path from 'path';
import fs from 'fs';
import YAML from 'yamljs';

import authRoutes from './routes/auth.routes';
import flightRoutes from './routes/flight.routes';
import bookingRoutes from './routes/booking.routes';
import checkinRoutes from './routes/checkin.routes';
import chatRoutes from './routes/chat.routes';
import { errorHandler, notFoundHandler } from './middleware/error-handler';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('tiny'));
  }

  const limiter = rateLimit({ windowMs: 60 * 1000, max: 120 });
  app.use('/api', limiter);

  app.get('/health', (_req, res) => res.json({ success: true, status: 'ok', time: new Date().toISOString() }));

  app.use('/api/auth', authRoutes);
  app.use('/api/flights', flightRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/checkin', checkinRoutes);
  app.use('/api/chat', chatRoutes);

  // Swagger docs
  try {
    const openapiPath = path.join(__dirname, '..', 'openapi.yaml');
    if (fs.existsSync(openapiPath)) {
      const swaggerDoc = YAML.load(openapiPath);
      app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));
    }
  } catch {
    // swagger docs are optional; app should still boot without them
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
