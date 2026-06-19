import { Request, Response } from 'express';
import { UserRepository } from '../domain/interfaces/user.repository';
import { NotFoundError } from '../domain/errors';
import { User } from '../domain/models';
import { AuthService } from '../services/auth.service';

interface PublicUser {
  id: string;
  email: string;
  createdAt: Date;
}

// Drops the password hash before sending a user back to the client.
function toPublicUser(user: User): PublicUser {
  return { id: user.id, email: user.email, createdAt: user.createdAt };
}

export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly users: UserRepository,
  ) {}

  register = async (req: Request, res: Response): Promise<void> => {
    const user = await this.authService.register(req.body.email, req.body.password);
    req.session.userId = user.id;
    res.status(201).json({ data: toPublicUser(user) });
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const user = await this.authService.login(req.body.email, req.body.password);
    req.session.userId = user.id;
    res.json({ data: toPublicUser(user) });
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
      req.session.destroy((err) => (err ? reject(err) : resolve()));
    });
    res.status(204).send();
  };

  me = async (req: Request, res: Response): Promise<void> => {
    const user = await this.users.findById(req.userId!);
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }
    res.json({ data: toPublicUser(user) });
  };
}
