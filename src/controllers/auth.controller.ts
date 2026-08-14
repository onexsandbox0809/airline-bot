import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth.service';
import { ok } from '../utils/response';
import { AuthedRequest } from '../middleware/auth';

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authController = {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const input = registerSchema.parse(req.body);
      const result = await authService.register(input);
      ok(res, result, 201);
    } catch (err) {
      next(err);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const input = loginSchema.parse(req.body);
      const result = await authService.login(input);
      ok(res, result);
    } catch (err) {
      next(err);
    }
  },

  async me(req: AuthedRequest, res: Response, next: NextFunction) {
    try {
      const user = await authService.me(req.user!.id);
      ok(res, { user });
    } catch (err) {
      next(err);
    }
  },
};
