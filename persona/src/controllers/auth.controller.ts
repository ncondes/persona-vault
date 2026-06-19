import { Request, Response } from 'express';
import { config } from '../config/config';
import { UserRepository } from '../domain/interfaces/user.repository';
import { NotFoundError } from '../domain/errors';
import { User } from '../domain/models';
import { signAuthToken } from '../infrastructure/auth/token';
import { AuthService } from '../services/auth.service';

const TOKEN_COOKIE = 'token';
const COOKIE_MAX_AGE = 1000 * 60 * 60 * 24 * 7; // 7 days

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: config.isProd,
  path: '/',
};

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
    res.cookie(TOKEN_COOKIE, signAuthToken(user.id), { ...cookieOptions, maxAge: COOKIE_MAX_AGE });
    res.status(201).json({ data: toPublicUser(user) });
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const user = await this.authService.login(req.body.email, req.body.password);
    res.cookie(TOKEN_COOKIE, signAuthToken(user.id), { ...cookieOptions, maxAge: COOKIE_MAX_AGE });
    res.json({ data: toPublicUser(user) });
  };

  logout = async (_req: Request, res: Response): Promise<void> => {
    res.clearCookie(TOKEN_COOKIE, cookieOptions);
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
