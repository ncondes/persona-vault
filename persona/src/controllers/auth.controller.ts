import { Request, Response } from 'express';
import { UserRepository } from '../domain/interfaces/user.repository';
import { NotFoundError } from '../domain/errors';
import { User } from '../domain/models';
import { AUTH_COOKIE, authCookieOptions, authCookieSetOptions } from '../infrastructure/auth/cookie';
import { signAuthToken } from '../infrastructure/auth/token';
import { AuthService } from '../services/auth.service';
import { IssuedChallenge, OtpService } from '../services/otp.service';

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
    private readonly otpService: OtpService,
    private readonly users: UserRepository,
  ) {}

  // 202, not 201: the request was taken, but nothing exists yet. Whether an
  // account appears depends on the code that just went out by email.
  private accepted(res: Response, challenge: IssuedChallenge): void {
    res.status(202).json({ data: challenge });
  }

  register = async (req: Request, res: Response): Promise<void> => {
    this.accepted(
      res,
      await this.authService.startRegistration(
        req.body.firstName,
        req.body.lastName,
        req.body.email,
        req.body.password,
      ),
    );
  };

  verifyRegistration = async (req: Request, res: Response): Promise<void> => {
    const user = await this.authService.completeRegistration(
      req.body.challengeId,
      req.body.code,
    );
    res.cookie(AUTH_COOKIE, signAuthToken(user.id), authCookieSetOptions);
    res.status(201).json({ data: toPublicUser(user) });
  };

  login = async (req: Request, res: Response): Promise<void> => {
    this.accepted(res, await this.authService.startLogin(req.body.email, req.body.password));
  };

  // Development only: returns a working login code for an address so the flow
  // can be driven without a reachable inbox. Its route is not mounted in
  // production; see buildAuthRoutes.
  devLogin = async (req: Request, res: Response): Promise<void> => {
    res.json({ data: await this.authService.startLoginForDev(req.body.email) });
  };

  verifyLogin = async (req: Request, res: Response): Promise<void> => {
    const user = await this.authService.completeLogin(req.body.challengeId, req.body.code);
    res.cookie(AUTH_COOKIE, signAuthToken(user.id), authCookieSetOptions);
    res.json({ data: toPublicUser(user) });
  };

  resendCode = async (req: Request, res: Response): Promise<void> => {
    this.accepted(res, await this.otpService.resend(req.body.challengeId));
  };

  logout = async (_req: Request, res: Response): Promise<void> => {
    res.clearCookie(AUTH_COOKIE, authCookieOptions);
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
