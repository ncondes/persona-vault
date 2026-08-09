import { UnitOfWork } from '../domain/interfaces/unit-of-work';
import { UserRepository } from '../domain/interfaces/user.repository';
import { ConflictError, UnauthorizedError } from '../domain/errors';
import { OtpChallenge, User } from '../domain/models';
import { hashPassword, verifyPassword } from '../infrastructure/auth/password';
import { IssuedChallenge, OtpService } from './otp.service';

export interface AuthService {
  startRegistration(
    firstName: string,
    lastName: string,
    email: string,
    password: string,
  ): Promise<IssuedChallenge>;
  completeRegistration(challengeId: string, code: string): Promise<User>;
  startLogin(email: string, password: string): Promise<IssuedChallenge>;
  completeLogin(challengeId: string, code: string): Promise<User>;
}

export class AuthServiceImpl implements AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly otp: OtpService,
  ) {}

  // Nothing is created here. The account waits in the challenge until somebody
  // reads the code out of the inbox it was sent to.
  async startRegistration(
    firstName: string,
    lastName: string,
    email: string,
    password: string,
  ): Promise<IssuedChallenge> {
    await this.rejectIfTaken(email);

    return this.otp.issue({
      purpose: 'signup',
      email,
      firstName,
      lastName,
      passwordHash: await hashPassword(password),
    });
  }

  // Creates the account and starts the vault with the essentials: the name
  // (kept as first + last parts) and the sign-up email, both as defaults.
  async completeRegistration(challengeId: string, code: string): Promise<User> {
    const challenge = await this.otp.verify(challengeId, code);
    const { email, firstName, lastName, passwordHash } = this.signupDetails(challenge);

    // Checked again: the code has been sitting in an inbox for up to ten
    // minutes, and the address could have been claimed in the meantime.
    await this.rejectIfTaken(email);

    const user = await this.unitOfWork.run(async (repos) => {
      const created = await repos.users.create({ email, passwordHash });
      await repos.vault.create({
        userId: created.id,
        kind: 'name',
        value: `${firstName} ${lastName}`.trim(),
        detail: { firstName, lastName },
        nameContext: 'preferred',
        isDefault: true,
      });
      await repos.vault.create({ userId: created.id, kind: 'email', value: email, isDefault: true });
      return created;
    });

    await this.otp.consume(challenge.id);
    return user;
  }

  async startLogin(email: string, password: string): Promise<IssuedChallenge> {
    const user = await this.users.findByEmail(email);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }
    return this.otp.issue({ purpose: 'login', email: user.email, userId: user.id });
  }

  async completeLogin(challengeId: string, code: string): Promise<User> {
    const challenge = await this.otp.verify(challengeId, code);
    if (challenge.purpose !== 'login' || !challenge.userId) {
      throw new UnauthorizedError('That code has expired', 'CHALLENGE_NOT_FOUND');
    }

    const user = await this.users.findById(challenge.userId);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    await this.otp.consume(challenge.id);
    return user;
  }

  private async rejectIfTaken(email: string): Promise<void> {
    if (await this.users.findByEmail(email)) {
      throw new ConflictError('An account with that email already exists', 'EMAIL_TAKEN');
    }
  }

  // The columns are nullable because one table holds both flows; a sign-up row
  // always has them. Answering with the generic expiry error keeps a caller from
  // learning anything by feeding a sign-in challenge to the sign-up endpoint.
  private signupDetails(challenge: OtpChallenge): {
    email: string;
    firstName: string;
    lastName: string;
    passwordHash: string;
  } {
    const { email, firstName, lastName, passwordHash } = challenge;
    if (challenge.purpose !== 'signup' || !firstName || !lastName || !passwordHash) {
      throw new UnauthorizedError('That code has expired', 'CHALLENGE_NOT_FOUND');
    }
    return { email, firstName, lastName, passwordHash };
  }
}
