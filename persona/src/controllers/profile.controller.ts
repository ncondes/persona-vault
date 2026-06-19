import { Request, Response } from 'express';
import { ProfileService } from '../services/profile.service';

export class ProfileController {
  constructor(private readonly profiles: ProfileService) {}

  get = async (req: Request, res: Response): Promise<void> => {
    res.json({ data: await this.profiles.getProfile(req.userId!) });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    res.json({ data: await this.profiles.updateProfile(req.userId!, req.body) });
  };
}
