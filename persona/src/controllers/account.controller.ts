import { Request, Response } from 'express';
import { AccountService } from '../services/account.service';

export class AccountController {
  constructor(private readonly accounts: AccountService) {}

  auditHistory = async (req: Request, res: Response): Promise<void> => {
    res.json({ data: await this.accounts.auditHistory(req.userId!) });
  };

  connections = async (req: Request, res: Response): Promise<void> => {
    res.json({ data: await this.accounts.connections(req.userId!) });
  };

  settings = async (req: Request, res: Response): Promise<void> => {
    res.json({ data: await this.accounts.settings(req.userId!) });
  };

  updateSettings = async (req: Request, res: Response): Promise<void> => {
    res.json({ data: await this.accounts.updateSettings(req.userId!, req.body) });
  };

  exportData = async (req: Request, res: Response): Promise<void> => {
    const data = await this.accounts.exportData(req.userId!);
    res.setHeader('Content-Disposition', 'attachment; filename=persona-export.json');
    res.json(data);
  };
}
