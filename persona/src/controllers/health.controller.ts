import { Request, Response } from 'express';

// Liveness check used by the dev workflow and uptime monitors.
export class HealthController {
  check(_req: Request, res: Response): void {
    res.json({ status: 'ok' });
  }
}
