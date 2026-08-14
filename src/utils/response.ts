import { Response } from 'express';
import { ErrorCode } from './errors';

export function ok(res: Response, data: Record<string, any>, statusCode = 200) {
  return res.status(statusCode).json({ success: true, ...data });
}

export function fail(res: Response, code: ErrorCode, message: string, statusCode = 400) {
  return res.status(statusCode).json({
    success: false,
    error: { code, message },
  });
}
