import { Request, Response } from 'express';
import { ClientService } from '../services/client.service';

// The developer console's view of registered relying parties. Every handler is
// scoped to the signed-in developer by the service.
export class AppController {
  constructor(private readonly clients: ClientService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    res.json({ data: await this.clients.listForOwner(req.userId!) });
  };

  get = async (req: Request, res: Response): Promise<void> => {
    res.json({ data: await this.clients.get(req.userId!, String(req.params.id)) });
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const app = await this.clients.create(req.userId!, req.body);
    res.status(201).json({ data: app });
  };

  rotateSecret = async (req: Request, res: Response): Promise<void> => {
    res.json({ data: await this.clients.rotateSecret(req.userId!, String(req.params.id)) });
  };

  preview = async (req: Request, res: Response): Promise<void> => {
    const preview = await this.clients.preview(req.userId!, req.body.purpose, req.body.scopes);
    res.json({ data: preview });
  };

  activity = async (req: Request, res: Response): Promise<void> => {
    res.json({ data: await this.clients.activity(req.userId!, String(req.params.id)) });
  };
}
