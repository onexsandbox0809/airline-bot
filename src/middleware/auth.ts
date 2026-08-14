import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { Errors } from '../utils/errors';

export interface AuthedRequest extends Request {
  user?: { id: string; email: string };
}

export function authenticate(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!env.jwtSecret) {
    return next(Errors.internal('Server misconfiguration: JWT_SECRET is not set.'));
  }
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(Errors.unauthorized('Missing or invalid Authorization header.'));
  }
  const token = header.slice('Bearer '.length);
  try {
    const payload = jwt.verify(token, env.jwtSecret) as { sub: string; email: string };
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    next(Errors.unauthorized('Invalid or expired token.'));
  }
}

/** Optional auth: attaches user if a valid token is present, but never blocks the request. */
export function optionalAuthenticate(req: AuthedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(header.slice(7), env.jwtSecret) as { sub: string; email: string };
      req.user = { id: payload.sub, email: payload.email };
    } catch {
      // ignore invalid token in optional mode
    }
  }
  next();
}
