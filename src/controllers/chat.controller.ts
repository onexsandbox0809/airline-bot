import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { aiService } from '../ai/ai.service';
import { ok } from '../utils/response';
import { AuthedRequest } from '../middleware/auth';

const chatSchema = z.object({
  userId: z.string().optional(),
  message: z.string().min(1),
  sessionId: z.string().min(1),
});

export const chatController = {
  async chat(req: AuthedRequest, res: Response, next: NextFunction) {
    try {
      const input = chatSchema.parse(req.body);
      const result = await aiService.chat({
        userId: req.user?.id || input.userId,
        message: input.message,
        sessionId: input.sessionId,
      });
      ok(res, result);
    } catch (err) {
      next(err);
    }
  },
};
