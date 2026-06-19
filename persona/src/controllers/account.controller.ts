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
}
