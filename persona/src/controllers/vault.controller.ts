import { Request, Response } from 'express';
import { VaultService } from '../services/vault.service';

export class VaultController {
  constructor(private readonly vault: VaultService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    res.json({ data: { items: await this.vault.list(req.userId!) } });
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const item = await this.vault.addItem(req.userId!, req.body);
    res.status(201).json({ data: item });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const item = await this.vault.updateItem(req.userId!, String(req.params.id), req.body);
    res.json({ data: item });
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    await this.vault.removeItem(req.userId!, String(req.params.id));
    res.status(204).send();
  };
}
