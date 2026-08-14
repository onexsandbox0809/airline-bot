import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { flightService } from '../services/flight.service';
import { ok } from '../utils/response';

const searchSchema = z.object({
  origin: z.string().min(2),
  destination: z.string().min(2),
  departureDate: z.string().min(8),
  returnDate: z.string().nullable().optional(),
  passengers: z.number().int().min(1).max(9).optional().default(1),
  cabinClass: z.enum(['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST']).optional(),
});

export const flightController = {
  async search(req: Request, res: Response, next: NextFunction) {
    try {
      const input = searchSchema.parse(req.body);
      const result = await flightService.searchFlights(input);
      ok(res, result);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const flight = await flightService.getFlight(req.params.id);
      ok(res, { flight });
    } catch (err) {
      next(err);
    }
  },
};
