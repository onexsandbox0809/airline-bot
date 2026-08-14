import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { checkinService } from '../services/checkin.service';
import { ok } from '../utils/response';
import { AuthedRequest } from '../middleware/auth';

const checkinSchema = z.object({
  pnr: z.string().min(6),
  lastName: z.string().min(1),
});

export const checkinController = {
  async checkIn(req: AuthedRequest, res: Response, next: NextFunction) {
    try {
      const input = checkinSchema.parse(req.body);
      const checkin = await checkinService.checkIn(input.pnr, input.lastName);
      ok(res, {
        pnr: input.pnr.toUpperCase(),
        checkInStatus: checkin.status,
        seat: checkin.seatNumber,
        boardingPassId: checkin.boardingPassId,
      });
    } catch (err) {
      next(err);
    }
  },
};
