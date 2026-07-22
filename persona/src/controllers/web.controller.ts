import { Request, Response } from 'express';
import { config } from '../config/config';
import { Repositories } from '../domain/interfaces/unit-of-work';
import { signAuthToken } from '../infrastructure/auth/token';
import { AccountService } from '../services/account.service';
import { AuthService } from '../services/auth.service';
import { renderAccount, renderSignup, renderWebLogin } from '../web/views';

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: config.isProd,
  path: '/',
  maxAge: 1000 * 60 * 60 * 24 * 7,
};

// Server-rendered Persona pages (signup, login, account overview). The vault is
// managed through the JSON API; the account page shows it read-only.
export class WebController {
  constructor(
    private readonly authService: AuthService,
    private readonly accountService: AccountService,
    private readonly repositories: Repositories,
  ) {}

  showSignup = (_req: Request, res: Response): void => {
    res.send(renderSignup());
  };

  showLogin = (_req: Request, res: Response): void => {
    res.send(renderWebLogin());
  };

  signup = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = await this.authService.register(
        req.body.firstName,
        req.body.lastName,
        req.body.email,
        req.body.password,
      );
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
    const [user, items, connections, audit] = await Promise.all([
      this.repositories.users.findById(userId),
      this.repositories.vault.listForUser(userId),
      this.accountService.connections(userId),
      this.accountService.auditHistory(userId),
    ]);
    res.send(renderAccount({ email: user?.email ?? '', items, connections, audit }));
  };
}
