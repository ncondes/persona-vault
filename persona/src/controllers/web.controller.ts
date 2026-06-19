import { Request, Response } from 'express';
import { config } from '../config/config';
import { UserRepository } from '../domain/interfaces/user.repository';
import { NameVariantKind, ProfileFieldKey } from '../domain/models';
import { signAuthToken } from '../infrastructure/auth/token';
import { AccountService } from '../services/account.service';
import { AuthService } from '../services/auth.service';
import { ProfileService, ProfileUpdate } from '../services/profile.service';
import { renderAccount, renderSignup, renderWebLogin } from '../web/views';

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: config.isProd,
  path: '/',
  maxAge: 1000 * 60 * 60 * 24 * 7,
};

const NAME_KINDS: NameVariantKind[] = ['legal', 'preferred', 'professional', 'public'];
const FIELD_KEYS: ProfileFieldKey[] = ['email', 'phone', 'address', 'dob'];

// Server-rendered pages for managing a Persona account (signup, login, profile).
export class WebController {
  constructor(
    private readonly authService: AuthService,
    private readonly profileService: ProfileService,
    private readonly accountService: AccountService,
    private readonly users: UserRepository,
  ) {}

  showSignup = (_req: Request, res: Response): void => {
    res.send(renderSignup());
  };

  showLogin = (_req: Request, res: Response): void => {
    res.send(renderWebLogin());
  };

  signup = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = await this.authService.register(req.body.email, req.body.password);
      res.cookie('token', signAuthToken(user.id), cookieOptions);
      res.redirect('/account');
    } catch {
      res
        .status(400)
        .send(renderSignup('Could not create the account — the email may be taken or the password too short.'));
    }
  };

  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = await this.authService.login(req.body.email, req.body.password);
      res.cookie('token', signAuthToken(user.id), cookieOptions);
      res.redirect('/account');
    } catch {
      res.status(401).send(renderWebLogin('Invalid email or password.'));
    }
  };

  logout = (_req: Request, res: Response): void => {
    res.clearCookie('token', cookieOptions);
    res.redirect('/login');
  };

  account = async (req: Request, res: Response): Promise<void> => {
    const userId = req.userId!;
    const [user, profile, connections, audit] = await Promise.all([
      this.users.findById(userId),
      this.profileService.getProfile(userId),
      this.accountService.connections(userId),
      this.accountService.auditHistory(userId),
    ]);
    res.send(renderAccount({ email: user?.email ?? '', profile, connections, audit }));
  };

  updateProfile = async (req: Request, res: Response): Promise<void> => {
    const names: ProfileUpdate['names'] = {};
    for (const kind of NAME_KINDS) {
      const value = req.body[`n_${kind}`];
      if (value) names[kind] = String(value);
    }
    const fields: ProfileUpdate['fields'] = {};
    for (const key of FIELD_KEYS) {
      const value = req.body[`f_${key}`];
      if (value) fields[key] = { value: String(value) };
    }
    await this.profileService.updateProfile(req.userId!, { names, fields });
    res.redirect('/account');
  };
}
