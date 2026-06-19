import { Response } from 'express';

// Sends a successful JSON payload wrapped in a `data` envelope.
export function ok<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ data });
}
